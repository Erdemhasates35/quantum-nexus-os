"""Unit tests use symbolic fixtures only; no market data or trade is simulated."""
from decimal import Decimal
import pytest
from flashloan_engine.kappa import KappaInputs, calculate_kappa

SYMBOLIC_REFS = {
    "principal_quote": "unit-test:symbolic-principal",
    "gross_spread_bps": "unit-test:symbolic-spread",
    "flash_loan_fee_bps": "unit-test:symbolic-loan-fee",
    "dex_fee_quote": "unit-test:symbolic-dex-fee",
    "slippage_quote": "unit-test:symbolic-slippage",
    "gas_cost_quote": "unit-test:symbolic-network-cost",
    "priority_fee_quote": "unit-test:symbolic-priority-fee",
    "jito_tip_quote": "unit-test:symbolic-jito-tip",
}


def symbolic_inputs(**overrides):
    values = dict(
        quote_asset="UNIT_TEST_QUOTE",
        principal_quote=Decimal("1000"),
        gross_spread_bps=Decimal("100"),
        flash_loan_fee_bps=Decimal("10"),
        dex_fee_quote=Decimal("2"),
        slippage_quote=Decimal("1"),
        gas_cost_quote=Decimal("1"),
        priority_fee_quote=Decimal("1"),
        jito_tip_quote=Decimal("1"),
        source_refs=SYMBOLIC_REFS,
    )
    values.update(overrides)
    return KappaInputs(**values)


def test_kappa_uses_all_cost_components():
    result = calculate_kappa(symbolic_inputs())
    assert result.gross_edge_quote == Decimal("10")
    assert result.flash_loan_fee_quote == Decimal("1")
    assert result.total_cost_quote == Decimal("7")
    assert result.net_edge_quote == Decimal("3")
    assert result.kappa == Decimal(3) / Decimal(7)
    assert result.profitable_before_risk_gate is True


def test_zero_spread_is_not_profitable():
    result = calculate_kappa(symbolic_inputs(gross_spread_bps=Decimal("0")))
    assert result.kappa == Decimal("-1")
    assert result.profitable_before_risk_gate is False


def test_negative_spread_is_preserved_as_negative_edge():
    result = calculate_kappa(symbolic_inputs(gross_spread_bps=Decimal("-5")))
    assert result.net_edge_quote < 0
    assert not result.profitable_before_risk_gate


@pytest.mark.parametrize("field", [
    "flash_loan_fee_bps", "dex_fee_quote", "slippage_quote",
    "gas_cost_quote", "priority_fee_quote", "jito_tip_quote",
])
def test_negative_costs_are_rejected(field):
    with pytest.raises(ValueError, match="non-negative"):
        calculate_kappa(symbolic_inputs(**{field: Decimal("-0.01")}))


def test_zero_principal_is_rejected():
    with pytest.raises(ValueError, match="greater than zero"):
        calculate_kappa(symbolic_inputs(principal_quote=Decimal("0")))


def test_missing_provenance_is_rejected():
    refs = dict(SYMBOLIC_REFS)
    refs.pop("jito_tip_quote")
    with pytest.raises(ValueError, match="source provenance"):
        calculate_kappa(symbolic_inputs(source_refs=refs))


def test_empty_provenance_is_rejected():
    refs = dict(SYMBOLIC_REFS)
    refs["gas_cost_quote"] = ""
    with pytest.raises(ValueError, match="source provenance"):
        calculate_kappa(symbolic_inputs(source_refs=refs))


def test_zero_total_cost_is_rejected():
    with pytest.raises(ValueError, match="all-in cost"):
        calculate_kappa(symbolic_inputs(
            flash_loan_fee_bps=Decimal("0"), dex_fee_quote=Decimal("0"),
            slippage_quote=Decimal("0"), gas_cost_quote=Decimal("0"),
            priority_fee_quote=Decimal("0"), jito_tip_quote=Decimal("0"),
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


def test_result_serialization_preserves_provenance():
    result = calculate_kappa(symbolic_inputs())
    payload = result.to_dict()
    assert payload["quote_asset"] == "UNIT_TEST_QUOTE"
    assert payload["source_refs"] == SYMBOLIC_REFS
    assert payload["kappa"] == result.kappa
