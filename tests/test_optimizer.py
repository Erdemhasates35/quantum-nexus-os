from decimal import Decimal
from flashloan_engine.optimizer import best_size, rank_opportunity


def test_best_size_prefers_profitable_size():
    x = best_size(minimum=Decimal("1000"), maximum=Decimal("100000"),
                  spread_bps=Decimal("20"), variable_cost_bps=Decimal("5"),
                  fixed_cost=Decimal("2"), min_profit=Decimal("0.1"))
    assert x is not None
    assert x.amount > Decimal("1000")


def test_rank_rejects_stale_latency():
    assert rank_opportunity(net_profit=Decimal("2"), gas_cost=Decimal("1"),
                            roi=Decimal("0.001"), latency_ms=2000) == Decimal("-1")
