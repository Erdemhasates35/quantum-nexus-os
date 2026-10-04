from flashloan_engine.orchestrator import FlashLoanOrchestrator
from flashloan_engine.config import Config

if __name__ == "__main__":
    engine = FlashLoanOrchestrator(Config())
    print(engine.capabilities())
