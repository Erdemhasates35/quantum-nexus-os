"""Source-bound, quote-denominated profitability threshold for Nexus.

This module performs deterministic arithmetic. It does not fetch market data,
verify provider signatures, validate quote freshness, simulate a transaction,
or submit an order. Those duties belong to source adapters and execution gates.
"""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation, localcontext
from typing import Literal, Mapping

BPS_DENOMINATOR = Decimal("10000")
MICRO_LAMPORTS_PER_LAMPORT = 1_000_000
LAMPORTS_PER_SOL = 1_000_000_000

QuoteUnit = Literal["quote_asset", "basis_points"]
EvidenceKind = Literal["live", "test", "symbolic"]


def _decimal(name: str, value: object) -> Decimal:
    if isinstance(value, bool):
        raise TypeError(f"{name} must be decimal-compatible, not bool")
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"{name} is not a valid decimal value") from None
    if not parsed.is_finite():
        raise ValueError(f"{name} must be finite")
    return parsed


def _nonnegative_integer(name: str, value: object, *, allow_zero: bool = True) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError(f"{name} must be an integer, not bool or another numeric type")
    if value < 0 or (not allow_zero and value == 0):
        comparator = "greater than zero" if not allow_zero else "non-negative"
        raise ValueError(f"{name} must be {comparator}")
    return value


def _json_ready(value: object) -> object:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if is_dataclass(value):
        return _json_ready(asdict(value))
    if isinstance(value, Mapping):
        return {str(key): _json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_ready(item) for item in value]
    return value


def solana_base_fee_lamports(*, signature_count: int, lamports_per_signature: int) -> int:
    """Compute Solana base fee from live/runtime signature parameters.

    lamports_per_signature is deliberately supplied by the caller; a quoted
    historical default is not embedded as an immutable protocol constant.
    """
    count = _nonnegative_integer("signature_count", signature_count, allow_zero=False)
    rate = _nonnegative_integer("lamports_per_signature", lamports_per_signature, allow_zero=False)
    return count * rate


def solana_v0_priority_fee_lamports(
    *,
    compute_unit_price_micro_lamports: int,
    requested_compute_unit_limit: int,
) -> int:
    """Legacy/v0 priority fee: ceil(CU_price_micro_lamports * requested_CU / 1e6)."""
    price = _nonnegative_integer("compute_unit_price_micro_lamports", compute_unit_price_micro_lamports)
    limit = _nonnegative_integer("requested_compute_unit_limit", requested_compute_unit_limit, allow_zero=False)
    product = price * limit
    return (product + MICRO_LAMPORTS_PER_LAMPORT - 1) // MICRO_LAMPORTS_PER_LAMPORT


def solana_v1_priority_fee_lamports(*, absolute_priority_fee_lamports: int) -> int:
    """v1 message fee is an absolute lamport amount, not the legacy/v0 CU formula."""
    return _nonnegative_integer("absolute_priority_fee_lamports", absolute_priority_fee_lamports)


def lamports_to_quote(*, lamports: int, quote_per_sol: object) -> Decimal:
    """Convert lamports into quote-asset units using a timestamp-bound SOL quote."""
    amount = _nonnegative_integer("lamports", lamports)
    price = _decimal("quote_per_sol", quote_per_sol)
    if price <= 0:
        raise ValueError("quote_per_sol must be greater than zero")
    with localcontext() as ctx:
        ctx.prec = 50
        return Decimal(amount) * price / Decimal(LAMPORTS_PER_SOL)


@dataclass(frozen=True)
class SourceEvidence:
    """A field-level source binding; this is not cryptographic source attestation."""

    source_ref: str
    source_kind: EvidenceKind
    observed_at: str
    raw_value: Decimal | str | int
    unit: QuoteUnit
    quote_asset: str | None = None


@dataclass(frozen=True)
class KappaInputs:
    """Every monetary amount is normalized to quote_asset.

    gross_spread_bps must be PRE-fee and PRE-price-impact. The existing
    gas_cost_quote input is retained for compatibility; it represents the
    network base fee (signature/network charge), not EVM gas on Solana.
    """
    quote_asset: str
    principal_quote: Decimal
    gross_spread_bps: Decimal
    flash_loan_fee_bps: Decimal | None
    dex_fee_quote: Decimal
    slippage_quote: Decimal
    gas_cost_quote: Decimal
    priority_fee_quote: Decimal
    jito_tip_quote: Decimal
    source_refs: Mapping[str, str]
    source_evidence: Mapping[str, SourceEvidence]
    allow_non_live_evidence: bool = False
    additional_costs_quote: Mapping[str, Decimal] = field(default_factory=dict)
    flash_loan_fee_quote: Decimal | None = None
    gross_spread_basis: str = "pre_fee_pre_impact"

    @property
    def network_base_fee_quote(self) -> Decimal:
        """Explicit semantic alias for the legacy gas_cost_quote input."""
        return self.gas_cost_quote


@dataclass(frozen=True)
class KappaResult:
    quote_asset: str
    gross_edge_quote: Decimal
    flash_loan_fee_quote: Decimal
    dex_fee_quote: Decimal
    slippage_quote: Decimal
    gas_cost_quote: Decimal
    priority_fee_quote: Decimal
    jito_tip_quote: Decimal
    additional_costs_quote: Mapping[str, Decimal]
    total_cost_quote: Decimal
    net_edge_quote: Decimal
    break_even_spread_bps: Decimal
    kappa: Decimal
    profitable_before_risk_gate: bool
    source_refs: Mapping[str, str]
    source_evidence: Mapping[str, SourceEvidence]

    @property
    def network_base_fee_quote(self) -> Decimal:
        return self.gas_cost_quote

    def to_dict(self) -> dict[str, object]:
        return _json_ready(self)  # type: ignore[return-value]

    def to_json(self, *, indent: int | None = 2) -> str:
        """Serialize exact Decimal values as strings for interoperable JSON."""
        return json.dumps(self.to_dict(), ensure_ascii=False, sort_keys=True, indent=indent)


def _validate_timestamp(field_name: str, value: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{field_name}.observed_at must be an ISO-8601 timestamp")
    normalized = value[:-1] + "+00:00" if value.endswith("Z") else value
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        raise ValueError(f"{field_name}.observed_at must be an ISO-8601 timestamp") from None
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"{field_name}.observed_at must include a UTC offset")


def _validate_evidence(
    inputs: KappaInputs,
    expected_values: Mapping[str, Decimal],
    expected_units: Mapping[str, QuoteUnit],
) -> tuple[dict[str, str], dict[str, SourceEvidence]]:
    refs = dict(inputs.source_refs)
    evidence = dict(inputs.source_evidence)
    required_fields = set(expected_values)
    missing_refs = required_fields.difference(refs)
    missing_evidence = required_fields.difference(evidence)
    empty_refs = {key for key in required_fields if not str(refs.get(key, "")).strip()}
    if missing_refs or missing_evidence or empty_refs:
        absent = sorted(missing_refs | missing_evidence | empty_refs)
        raise ValueError(f"missing source evidence or reference for: {', '.join(absent)}")

    validated: dict[str, SourceEvidence] = {}
    for name, expected in expected_values.items():
        item = evidence[name]
        if not isinstance(item, SourceEvidence):
            raise TypeError(f"source_evidence[{name!r}] must be a SourceEvidence record")
        if not item.source_ref.strip() or item.source_ref != refs[name]:
            raise ValueError(f"{name} source_ref does not match source_refs")
        if item.source_kind not in {"live", "test", "symbolic"}:
            raise ValueError(f"{name} has unsupported source_kind")
        if item.source_kind != "live" and not inputs.allow_non_live_evidence:
            raise ValueError(f"{name} uses non-live evidence without explicit opt-in")
        _validate_timestamp(name, item.observed_at)
        if item.unit != expected_units[name]:
            raise ValueError(f"{name} evidence unit must be {expected_units[name]}")
        if item.unit == "quote_asset" and item.quote_asset != inputs.quote_asset:
            raise ValueError(f"{name} evidence quote_asset does not match calculation quote_asset")
        if item.unit == "basis_points" and item.quote_asset not in {None, inputs.quote_asset}:
            raise ValueError(f"{name} evidence quote_asset context does not match calculation quote_asset")
        observed_value = _decimal(f"{name}.raw_value", item.raw_value)
        if observed_value != expected:
            raise ValueError(f"{name} source value does not match the numeric input")
        validated[name] = item
    return refs, validated


def calculate_kappa(inputs: KappaInputs) -> KappaResult:
    """Compute κ = (gross edge − all-in cost) / all-in cost.

    κ is dimensionless. κ > 0 means the modeled gross edge exceeds modeled
    costs, before separate risk/confidence and execution-authorization gates.
    It is not a probability, risk-adjusted expected value or landing guarantee.
    """
    if not isinstance(inputs.quote_asset, str) or not inputs.quote_asset.strip():
        raise ValueError("quote_asset must be a non-empty chain-qualified asset identifier")
    if inputs.gross_spread_basis != "pre_fee_pre_impact":
        raise ValueError("gross_spread_basis must be pre_fee_pre_impact to prevent cost double counting")

    values = {
        "principal_quote": _decimal("principal_quote", inputs.principal_quote),
        "gross_spread_bps": _decimal("gross_spread_bps", inputs.gross_spread_bps),
        "dex_fee_quote": _decimal("dex_fee_quote", inputs.dex_fee_quote),
        "slippage_quote": _decimal("slippage_quote", inputs.slippage_quote),
        "gas_cost_quote": _decimal("gas_cost_quote", inputs.gas_cost_quote),
        "priority_fee_quote": _decimal("priority_fee_quote", inputs.priority_fee_quote),
        "jito_tip_quote": _decimal("jito_tip_quote", inputs.jito_tip_quote),
    }
    if values["principal_quote"] <= 0:
        raise ValueError("principal_quote must be greater than zero")
    for name, value in values.items():
        if name not in {"principal_quote", "gross_spread_bps"} and value < 0:
            raise ValueError(f"{name} must be non-negative")

    if inputs.flash_loan_fee_quote is not None and inputs.flash_loan_fee_bps is not None:
        raise ValueError("provide either flash_loan_fee_quote or flash_loan_fee_bps, not both")
    if inputs.flash_loan_fee_quote is None and inputs.flash_loan_fee_bps is None:
        raise ValueError("one of flash_loan_fee_quote or flash_loan_fee_bps is required")

    if inputs.flash_loan_fee_quote is not None:
        loan_fee = _decimal("flash_loan_fee_quote", inputs.flash_loan_fee_quote)
        if loan_fee < 0:
            raise ValueError("flash_loan_fee_quote must be non-negative")
        expected_values = {**values, "flash_loan_fee_quote": loan_fee}
        expected_units: dict[str, QuoteUnit] = {
            key: ("basis_points" if key == "gross_spread_bps" else "quote_asset")
            for key in expected_values
        }
    else:
        loan_rate = _decimal("flash_loan_fee_bps", inputs.flash_loan_fee_bps)
        if loan_rate < 0:
            raise ValueError("flash_loan_fee_bps must be non-negative")
        expected_values = {**values, "flash_loan_fee_bps": loan_rate}
        expected_units = {
            key: ("basis_points" if key in {"gross_spread_bps", "flash_loan_fee_bps"} else "quote_asset")
            for key in expected_values
        }

    additional: dict[str, Decimal] = {}
    for name, raw_amount in inputs.additional_costs_quote.items():
        if not isinstance(name, str) or not name.strip():
            raise ValueError("additional cost names must be non-empty strings")
        key = f"additional_costs_quote.{name}"
        amount = _decimal(key, raw_amount)
        if amount < 0:
            raise ValueError(f"{key} must be non-negative")
        additional[name] = amount
        expected_values[key] = amount
        expected_units[key] = "quote_asset"

    refs, validated_evidence = _validate_evidence(inputs, expected_values, expected_units)

    with localcontext() as ctx:
        ctx.prec = 50
        gross = values["principal_quote"] * values["gross_spread_bps"] / BPS_DENOMINATOR
        if inputs.flash_loan_fee_quote is None:
            loan_fee = values["principal_quote"] * loan_rate / BPS_DENOMINATOR
        total_additional = sum(additional.values(), Decimal("0"))
        costs = (
            loan_fee + values["dex_fee_quote"] + values["slippage_quote"]
            + values["gas_cost_quote"] + values["priority_fee_quote"]
            + values["jito_tip_quote"] + total_additional
        )
        if costs <= 0:
            raise ValueError("all-in cost must be greater than zero to define finite κ")
        net = gross - costs
        break_even_bps = costs / values["principal_quote"] * BPS_DENOMINATOR
        kappa = net / costs

    return KappaResult(
        quote_asset=inputs.quote_asset.strip(),
        gross_edge_quote=gross,
        flash_loan_fee_quote=loan_fee,
        dex_fee_quote=values["dex_fee_quote"],
        slippage_quote=values["slippage_quote"],
        gas_cost_quote=values["gas_cost_quote"],
        priority_fee_quote=values["priority_fee_quote"],
        jito_tip_quote=values["jito_tip_quote"],
        additional_costs_quote=additional,
        total_cost_quote=costs,
        net_edge_quote=net,
        break_even_spread_bps=break_even_bps,
        kappa=kappa,
        profitable_before_risk_gate=net > 0,
        source_refs=refs,
        source_evidence=validated_evidence,
    )
