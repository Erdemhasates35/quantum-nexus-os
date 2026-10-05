from decimal import Decimal

from flashloan_engine.gas_sponsorship import (
    GasQuote,
    SponsorMode,
    choose_mode,
    evaluate_sponsorship,
)


def test_relayer_can_front_gas_when_trade_remains_profitable():
    d = evaluate_sponsorship(
        gross_profit=Decimal("100"),
        non_gas_costs=Decimal("20"),
        gas_quote=GasQuote(Decimal("10")),
        minimum_profit=Decimal("1"),
        mode=SponsorMode.RELAYER_REIMBURSED,
    )
    assert d.approved
    assert d.required_fronted_value == Decimal("10")
    assert d.reimbursed_value == Decimal("10")
    assert d.net_profit_after_gas == Decimal("70")


def test_sponsorship_rejects_trade_that_only_looks_profitable_before_gas():
    d = evaluate_sponsorship(
        gross_profit=Decimal("30"),
        non_gas_costs=Decimal("20"),
        gas_quote=GasQuote(Decimal("11")),
        minimum_profit=Decimal("1"),
        mode=SponsorMode.PAYMASTER,
    )
    assert not d.approved
    assert d.reason == "insufficient_net_profit"


def test_paymaster_is_preferred_when_available():
    d = choose_mode(
        gross_profit=Decimal("100"),
        non_gas_costs=Decimal("20"),
        gas_quote=GasQuote(Decimal("10")),
        minimum_profit=Decimal("1"),
        paymaster_available=True,
        relayer_available=True,
    )
    assert d.mode is SponsorMode.PAYMASTER


def test_builder_fallback_is_economically_gated():
    d = choose_mode(
        gross_profit=Decimal("100"),
        non_gas_costs=Decimal("20"),
        gas_quote=GasQuote(Decimal("10")),
        minimum_profit=Decimal("1"),
        builder_available=True,
    )
    assert d.mode is SponsorMode.BUILDER_BUNDLE


def test_zero_balance_does_not_mean_zero_cost():
    d = evaluate_sponsorship(
        gross_profit=Decimal("100"),
        non_gas_costs=Decimal("20"),
        gas_quote=GasQuote(Decimal("10")),
        minimum_profit=Decimal("1"),
        mode=SponsorMode.RELAYER_REIMBURSED,
    )
    assert d.required_fronted_value > 0
    assert d.net_profit_after_gas > 0
