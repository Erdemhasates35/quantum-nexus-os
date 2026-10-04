from decimal import Decimal

from flashloan_engine.economics import build_opportunity
from flashloan_engine.models import Chain


def test_net_profit_includes_all_costs():
    o = build_opportunity(chain=Chain.ETHEREUM, asset="USDC", borrow_amount="100000",
                          gross_spread="30", loan_fee_bps="5", swap_fee_bps="12",
                          gas_cost="8", slippage_bps="3", priority_cost="2", min_profit="1")
    assert o.gross_spread == Decimal("300")
    assert o.total_cost == Decimal("210")
    assert o.net_profit == Decimal("90.00000000")
    assert o.executable


def test_negative_edge_is_rejected():
    o = build_opportunity(chain=Chain.POLYGON, asset="USDC", borrow_amount="1000",
                          gross_spread="5", loan_fee_bps="5", swap_fee_bps="60",
                          gas_cost="1", slippage_bps="10", priority_cost="1", min_profit="1")
    assert not o.executable
    assert o.net_profit < 0


def test_zero_amount_never_executes():
    o = build_opportunity(chain=Chain.GNOSIS, asset="USDC", borrow_amount="0",
                          gross_spread="100", loan_fee_bps="5", swap_fee_bps="0",
                          gas_cost="0", slippage_bps="0", priority_cost="0", min_profit="0")
    assert not o.executable
