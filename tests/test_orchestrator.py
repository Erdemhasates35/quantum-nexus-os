from flashloan_engine.orchestrator import FlashLoanOrchestrator

def test_capabilities_are_explicit():
    c=FlashLoanOrchestrator().capabilities()
    assert c["ethereum"] == "Aave V3"
    assert c["polygon"] == "Aave V3"
    assert c["gnosis"] == "Aave V3"
    assert c["binance"] != "flash-loan lender"
    assert c["live_execution"] is False
