from __future__ import annotations
from .config import Config
from .evm import NETWORKS
class FlashLoanOrchestrator:
    """Coordinates opportunity research; it does not silently submit transactions."""
    def __init__(self, config: Config | None = None): self.config = config or Config(); self.config.validate()
    def capabilities(self) -> dict:
        return {"ethereum": NETWORKS["ethereum"].flash_loan_provider, "polygon": NETWORKS["polygon"].flash_loan_provider, "gnosis": NETWORKS["gnosis"].flash_loan_provider, "solana": "Jupiter Lend adapter", "binance": "market-data / account observer; not a flash-loan lender", "live_execution": self.config.live_execution}
