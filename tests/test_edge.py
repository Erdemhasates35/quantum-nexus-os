from decimal import Decimal
from flashloan_engine.edge import break_even_spread_bps, max_slippage_bps


def test_break_even_edge_is_exact():
    x = break_even_spread_bps(
        loan_fee_bps=Decimal("5"), swap_fee_bps=Decimal("10"),
        slippage_bps=Decimal("5"), gas_cost=Decimal("2"),
        priority_cost=Decimal("1"), amount=Decimal("1000"))
    assert x == Decimal("220")


def test_max_slippage_is_explicit():
    x = max_slippage_bps(
        spread_bps=Decimal("50"), loan_fee_bps=Decimal("5"),
        swap_fee_bps=Decimal("10"), gas_cost=Decimal("2"),
        priority_cost=Decimal("1"), amount=Decimal("1000"))
    assert x == Decimal("5")
