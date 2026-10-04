from decimal import Decimal

from flashloan_engine.config import Config
from flashloan_engine.orchestrator import FlashLoanOrchestrator
from flashloan_engine.models import Chain


def test_capabilities_are_explicit():
    c = FlashLoanOrchestrator().capabilities()
    assert c["ethereum"] == "Aave V3"
    assert c["polygon"] == "Aave V3"
    assert c["gnosis"] == "Aave V3"
    assert c["binance"] != "flash-loan lender"
    assert c["live_execution"] is False


def test_economic_gate_rejects_high_slippage():
    cfg = Config(max_slippage_bps="10", min_profit_usd="1")
    o = FlashLoanOrchestrator(cfg).evaluate(
        chain=Chain.ETHEREUM, asset="USDC", borrow_amount="100000",
        gross_spread_bps="50", loan_fee_bps="5", swap_fee_bps="10",
        gas_cost_usd="5", slippage_bps="20", priority_cost_usd="1",
    )
    assert not o.executable
    assert o.reason == "slippage_limit"
