"""Evidence-gated, quote-denominated profitability threshold for Nexus.

All monetary inputs MUST already be normalized into the same quote asset.
This module performs arithmetic only; it does not fetch market, oracle, fee,
or chain data and therefore cannot certify that an opportunity is executable.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from decimal import Decimal, InvalidOperation, localcontext
from typing import Mapping

BPS_DENOMINATOR = Decimal("10000")
REQUIRED_PROVENANCE_FIELDS = frozenset({
    "principal_quote", "gross_spread_bps", "flash_loan_fee_bps",
    "dex_fee_quote", "slippage_quote", "gas_cost_quote",
    "priority_fee_quote", "jito_tip_quote",
})


def _decimal(name: str, value: object) -> Decimal:
    if isinstance(value, bool):
        raise TypeError(f"{name} must be a decimal-compatible numeric value, not bool")
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        raise ValueError(f"{name} is not a valid decimal value") from None
    if not parsed.is_finite():
        raise ValueError(f"{name} must be finite")
    return parsed


@dataclass(frozen=True)
class KappaInputs:
    """All monetary values use quote_asset units.

    DEX fees and slippage are route-level quote amounts from executable
    quotes, not hard-coded fee-tier assumptions. Network base cost, priority
    fee and Jito tip remain separate to prevent omission or double counting.
    """
    quote_asset: str
    principal_quote: Decimal
    gross_spread_bps: Decimal
    flash_loan_fee_bps: Decimal
    dex_fee_quote: Decimal
    slippage_quote: Decimal
    gas_cost_quote: Decimal
    priority_fee_quote: Decimal
    jito_tip_quote: Decimal
    source_refs: Mapping[str, str]


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
    total_cost_quote: Decimal
    net_edge_quote: Decimal
    break_even_spread_bps: Decimal
    kappa: Decimal
    profitable_before_risk_gate: bool
    source_refs: Mapping[str, str]

    def to_dict(self) -> dict[str, object]:
        result = asdict(self)
        result["source_refs"] = dict(self.source_refs)
        return result


def calculate_kappa(inputs: KappaInputs) -> KappaResult:
    """Compute κ = (gross edge − all-in cost) / all-in cost.

    κ is dimensionless. κ > 0 means positive modeled edge before separate
    risk and authorization gates; it is not a probability or guarantee.
    """
    if not isinstance(inputs.quote_asset, str) or not inputs.quote_asset.strip():
        raise ValueError("quote_asset must be a non-empty asset identifier")

    refs = dict(inputs.source_refs)
    missing = REQUIRED_PROVENANCE_FIELDS.difference(refs)
    empty = {key for key in REQUIRED_PROVENANCE_FIELDS if not str(refs.get(key, "")).strip()}
    if missing or empty:
        raise ValueError(f"missing source provenance for: {', '.join(sorted(missing | empty))}")

    values = {
        "principal_quote": _decimal("principal_quote", inputs.principal_quote),
        "gross_spread_bps": _decimal("gross_spread_bps", inputs.gross_spread_bps),
        "flash_loan_fee_bps": _decimal("flash_loan_fee_bps", inputs.flash_loan_fee_bps),
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

    with localcontext() as ctx:
        ctx.prec = 50
        gross = values["principal_quote"] * values["gross_spread_bps"] / BPS_DENOMINATOR
        loan_fee = values["principal_quote"] * values["flash_loan_fee_bps"] / BPS_DENOMINATOR
        costs = (
            loan_fee + values["dex_fee_quote"] + values["slippage_quote"]
            + values["gas_cost_quote"] + values["priority_fee_quote"]
            + values["jito_tip_quote"]
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
        total_cost_quote=costs,
        net_edge_quote=net,
        break_even_spread_bps=break_even_bps,
        kappa=kappa,
        profitable_before_risk_gate=net > 0,
        source_refs=refs,
    )
