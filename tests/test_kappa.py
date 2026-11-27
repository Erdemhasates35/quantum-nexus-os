"""Deterministic κ and fee-normalization tests; fixtures are explicitly symbolic."""
import json
from decimal import Decimal

import pytest

from flashloan_engine.kappa import (
    KappaInputs,
    SourceEvidence,
    calculate_kappa,
    lamports_to_quote,
    solana_base_fee_lamports,
    solana_v0_priority_fee_lamports,
    solana_v1_priority_fee_lamports,
)

QUOTE = "UNIT_TEST_QUOTE"
OBSERVED_AT = "2026-01-01T00:00:00Z"
BASE_VALUES = {
    "principal_quote": Decimal("1000"),
    "gross_spread_bps": Decimal("100"),
    "flash_loan_fee_bps": Decimal("10"),
    "dex_fee_quote": Decimal("2"),
    "slippage_quote": Decimal("1"),
    "gas_cost_quote": Decimal("1"),
    "priority_fee_quote": Decimal("1"),
    "jito_tip_quote": Decimal("1"),
}
UNITS = {
    "principal_quote": "quote_asset",
    "gross_spread_bps": "basis_points",
    "flash_loan_fee_bps": "basis_points",
    "dex_fee_quote": "quote_asset",
    "slippage_quote": "quote_asset",
    "gas_cost_quote": "quote_asset",
    "priority_fee_quote": "quote_asset",
    "jito_tip_quote": "quote_asset",
}


def make_symbolic_evidence(values, refs, extra_costs=None):
    all_values = dict(values)
    all_units = dict(UNITS)
    if "flash_loan_fee_quote" in all_values:
        all_units.pop("flash_loan_fee_bps", None)
        all_units["flash_loan_fee_quote"] = "quote_asset"
    for name, amount in (extra_costs or {}).items():
        key = f"additional_costs_quote.{name}"
        all_values[key] = amount
        all_units[key] = "quote_asset"
    return {
        key: SourceEvidence(
            source_ref=refs.get(key, f"symbolic://missing-reference/{key}"),
            source_kind="symbolic",
            observed_at=OBSERVED_AT,
            raw_value=value,
            unit=all_units[key],
            quote_asset=QUOTE,
        )
        for key, value in all_values.items()
    }


def symbolic_inputs(**overrides):
    values = dict(
        quote_asset=QUOTE,
        **BASE_VALUES,
        source_refs={key: f"symbolic://unit-tests/{key}" for key in BASE_VALUES},
        allow_non_live_evidence=True,
        additional_costs_quote={},
        flash_loan_fee_quote=None,
    )
    values.update(overrides)
    refs = dict(values["source_refs"])
    expected = {key: values[key] for key in BASE_VALUES if key in values}
    if values["flash_loan_fee_quote"] is not None:
        expected.pop("flash_loan_fee_bps", None)
        expected["flash_loan_fee_quote"] = values["flash_loan_fee_quote"]
        refs.pop("flash_loan_fee_bps", None)
        refs["flash_loan_fee_quote"] = "symbolic://unit-tests/flash_loan_fee_quote"
    for name in values["additional_costs_quote"]:
        refs[f"additional_costs_quote.{name}"] = f"symbolic://unit-tests/additional_costs_quote/{name}"
    values["source_refs"] = refs
    if "source_evidence" not in overrides:
        values["source_evidence"] = make_symbolic_evidence(
            expected, refs, values["additional_costs_quote"]
        )
    return KappaInputs(**values)


def test_kappa_uses_all_cost_components():
    result = calculate_kappa(symbolic_inputs())
    assert result.gross_edge_quote == Decimal("10")
    assert result.flash_loan_fee_quote == Decimal("1")
    assert result.total_cost_quote == Decimal("7")
    assert result.net_edge_quote == Decimal("3")
    assert abs(result.kappa - (Decimal(3) / Decimal(7))) < Decimal("1e-27")
    assert result.profitable_before_risk_gate is True
    assert result.network_base_fee_quote == Decimal("1")


def test_zero_spread_is_not_profitable():
    result = calculate_kappa(symbolic_inputs(gross_spread_bps=Decimal("0")))
    assert result.kappa == Decimal("-1")
    assert result.profitable_before_risk_gate is False


def test_negative_spread_is_preserved_as_negative_edge():
    result = calculate_kappa(symbolic_inputs(gross_spread_bps=Decimal("-5")))
    assert result.net_edge_quote < 0
    assert not result.profitable_before_risk_gate


@pytest.mark.parametrize(
    "field",
    [
        "dex_fee_quote",
        "slippage_quote",
        "gas_cost_quote",
        "priority_fee_quote",
        "jito_tip_quote",
    ],
)
def test_negative_costs_are_rejected(field):
    with pytest.raises(ValueError, match="non-negative"):
        calculate_kappa(symbolic_inputs(**{field: Decimal("-0.01")}))


def test_negative_flash_loan_rate_is_rejected():
    with pytest.raises(ValueError, match="non-negative"):
        calculate_kappa(symbolic_inputs(flash_loan_fee_bps=Decimal("-1")))


def test_zero_principal_is_rejected():
    with pytest.raises(ValueError, match="greater than zero"):
        calculate_kappa(symbolic_inputs(principal_quote=Decimal("0")))


def test_missing_provenance_is_rejected():
    values = symbolic_inputs()
    refs = dict(values.source_refs)
    refs.pop("jito_tip_quote")
    with pytest.raises(ValueError, match="missing source evidence"):
        calculate_kappa(symbolic_inputs(source_refs=refs))


def test_empty_provenance_is_rejected():
    values = symbolic_inputs()
    refs = dict(values.source_refs)
    refs["gas_cost_quote"] = ""
    with pytest.raises(ValueError, match="missing source evidence"):
        calculate_kappa(symbolic_inputs(source_refs=refs))


def test_source_reference_must_match_bound_evidence():
    values = symbolic_inputs()
    evidence = dict(values.source_evidence)
    evidence["jito_tip_quote"] = SourceEvidence(
        source_ref="symbolic://different-source",
        source_kind="symbolic",
        observed_at=OBSERVED_AT,
        raw_value=Decimal("1"),
        unit="quote_asset",
        quote_asset=QUOTE,
    )
    with pytest.raises(ValueError, match="does not match source_refs"):
        calculate_kappa(symbolic_inputs(source_evidence=evidence))


def test_source_value_must_match_numeric_input():
    values = symbolic_inputs()
    evidence = dict(values.source_evidence)
    evidence["jito_tip_quote"] = SourceEvidence(
        source_ref=values.source_refs["jito_tip_quote"],
        source_kind="symbolic",
        observed_at=OBSERVED_AT,
        raw_value=Decimal("9"),
        unit="quote_asset",
        quote_asset=QUOTE,
    )
    with pytest.raises(ValueError, match="does not match the numeric input"):
        calculate_kappa(symbolic_inputs(source_evidence=evidence))


def test_non_live_evidence_requires_explicit_opt_in():
    with pytest.raises(ValueError, match="non-live evidence"):
        calculate_kappa(symbolic_inputs(allow_non_live_evidence=False))


def test_timestamp_requires_timezone_offset():
    values = symbolic_inputs()
    evidence = dict(values.source_evidence)
    evidence["principal_quote"] = SourceEvidence(
        source_ref=values.source_refs["principal_quote"],
        source_kind="symbolic",
        observed_at="2026-01-01T00:00:00",
        raw_value=Decimal("1000"),
        unit="quote_asset",
        quote_asset=QUOTE,
    )
    with pytest.raises(ValueError, match="UTC offset"):
        calculate_kappa(symbolic_inputs(source_evidence=evidence))


def test_source_quote_asset_must_match():
    values = symbolic_inputs()
    evidence = dict(values.source_evidence)
    evidence["principal_quote"] = SourceEvidence(
        source_ref=values.source_refs["principal_quote"],
        source_kind="symbolic",
        observed_at=OBSERVED_AT,
        raw_value=Decimal("1000"),
        unit="quote_asset",
        quote_asset="OTHER_ASSET",
    )
    with pytest.raises(ValueError, match="quote_asset"):
        calculate_kappa(symbolic_inputs(source_evidence=evidence))


def test_wrong_source_unit_is_rejected():
    values = symbolic_inputs()
    evidence = dict(values.source_evidence)
    evidence["gross_spread_bps"] = SourceEvidence(
        source_ref=values.source_refs["gross_spread_bps"],
        source_kind="symbolic",
        observed_at=OBSERVED_AT,
        raw_value=Decimal("100"),
        unit="quote_asset",
        quote_asset=QUOTE,
    )
    with pytest.raises(ValueError, match="basis_points"):
        calculate_kappa(symbolic_inputs(source_evidence=evidence))


def test_zero_total_cost_is_rejected():
    refs = {
        "principal_quote": "symbolic://principal",
        "gross_spread_bps": "symbolic://spread",
        "flash_loan_fee_bps": "symbolic://loan-rate",
        "dex_fee_quote": "symbolic://dex",
        "slippage_quote": "symbolic://slippage",
        "gas_cost_quote": "symbolic://network",
        "priority_fee_quote": "symbolic://priority",
        "jito_tip_quote": "symbolic://tip",
    }
    zeroes = {
        "principal_quote": Decimal("1000"),
        "gross_spread_bps": Decimal("100"),
        "flash_loan_fee_bps": Decimal("0"),
        "dex_fee_quote": Decimal("0"),
        "slippage_quote": Decimal("0"),
        "gas_cost_quote": Decimal("0"),
        "priority_fee_quote": Decimal("0"),
        "jito_tip_quote": Decimal("0"),
    }
    evidence = make_symbolic_evidence(zeroes, refs)
    with pytest.raises(ValueError, match="all-in cost"):
        calculate_kappa(KappaInputs(
            quote_asset=QUOTE,
            **zeroes,
            source_refs=refs,
            source_evidence=evidence,
            allow_non_live_evidence=True,
        ))


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity"])
def test_non_finite_inputs_are_rejected(value):
    with pytest.raises(ValueError, match="finite"):
        calculate_kappa(symbolic_inputs(gross_spread_bps=value))


def test_boolean_is_not_accepted_as_numeric_input():
    with pytest.raises(TypeError, match="not bool"):
        calculate_kappa(symbolic_inputs(principal_quote=True))


def test_break_even_spread_matches_cost_to_principal():
    result = calculate_kappa(symbolic_inputs())
    assert result.break_even_spread_bps == Decimal("70")


def test_exact_flash_loan_fee_quote_is_supported():
    result = calculate_kappa(symbolic_inputs(
        flash_loan_fee_bps=None,
        flash_loan_fee_quote=Decimal("1"),
    ))
    assert result.flash_loan_fee_quote == Decimal("1")
    assert result.total_cost_quote == Decimal("7")


def test_rate_and_exact_flash_loan_fee_cannot_be_double_counted():
    with pytest.raises(ValueError, match="either"):
        calculate_kappa(symbolic_inputs(flash_loan_fee_quote=Decimal("1")))


def test_additional_route_costs_are_included_and_evidence_bound():
    result = calculate_kappa(symbolic_inputs(
        additional_costs_quote={"token_2022_transfer_fee": Decimal("0.5")},
    ))
    assert result.additional_costs_quote["token_2022_transfer_fee"] == Decimal("0.5")
    assert result.total_cost_quote == Decimal("7.5")


def test_additional_costs_reject_negative_values():
    with pytest.raises(ValueError, match="non-negative"):
        calculate_kappa(symbolic_inputs(
            additional_costs_quote={"protocol_fee": Decimal("-0.1")},
        ))


def test_gross_spread_basis_prevents_double_counting():
    with pytest.raises(ValueError, match="pre_fee_pre_impact"):
        calculate_kappa(symbolic_inputs(gross_spread_basis="already_net_of_fees"))


def test_result_json_uses_exact_decimal_strings_and_includes_evidence():
    result = calculate_kappa(symbolic_inputs())
    payload = json.loads(result.to_json())
    assert payload["quote_asset"] == QUOTE
    assert payload["kappa"] == str(result.kappa)
    assert payload["source_evidence"]["principal_quote"]["raw_value"] == "1000"


def test_solana_base_fee_uses_dynamic_signature_price():
    assert solana_base_fee_lamports(signature_count=2, lamports_per_signature=5000) == 10000


def test_solana_v0_priority_fee_uses_requested_limit_and_ceiling():
    assert solana_v0_priority_fee_lamports(
        compute_unit_price_micro_lamports=1500,
        requested_compute_unit_limit=200000,
    ) == 300
    assert solana_v0_priority_fee_lamports(
        compute_unit_price_micro_lamports=1,
        requested_compute_unit_limit=1,
    ) == 1


def test_solana_v1_priority_fee_is_absolute_lamports():
    assert solana_v1_priority_fee_lamports(absolute_priority_fee_lamports=300) == 300


def test_lamports_conversion_uses_quote_per_sol():
    assert lamports_to_quote(lamports=1_000_000_000, quote_per_sol="12.5") == Decimal("12.5")


def test_invalid_lamports_values_are_rejected():
    with pytest.raises(TypeError):
        solana_v0_priority_fee_lamports(
            compute_unit_price_micro_lamports=True,
            requested_compute_unit_limit=100000,
        )
