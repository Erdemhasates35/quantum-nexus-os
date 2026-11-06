from flashloan_engine.config import Config
from flashloan_engine.orchestrator import FlashLoanOrchestrator
from flashloan_engine.models import Chain


def test_capabilities_report_runtime_state_without_overclaiming():
    c = FlashLoanOrchestrator().capabilities()
    assert c["ethereum"]["provider"] == "Aave V3"
    assert c["polygon"]["provider"] == "Aave V3"
    assert c["gnosis"]["provider"] == "Aave V3"
    assert c["ethereum"]["rpc_configured"] is False
    assert c["polygon"]["rpc_configured"] is False
    assert c["gnosis"]["rpc_configured"] is False
    assert c["binance"]["flash_loan_lender"] is False
    assert c["solana"]["flash_loan_execution_implemented"] is False
    assert c["live_execution"] is False
    assert c["live_submission_implemented"] is False


def test_economic_gate_rejects_high_slippage():
    cfg = Config(max_slippage_bps="10", min_profit_usd="1")
    o = FlashLoanOrchestrator(cfg).evaluate(
        chain=Chain.ETHEREUM, asset="USDC", borrow_amount="100000",
        gross_spread_bps="50", loan_fee_bps="5", swap_fee_bps="10",
        gas_cost_usd="5", slippage_bps="20", priority_cost_usd="1",
    )
    assert not o.executable
    assert o.reason == "slippage_limit"
