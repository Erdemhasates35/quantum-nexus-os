from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    ethereum_rpc: str = os.getenv("FLASH_ETHEREUM_RPC", "")
    polygon_rpc: str = os.getenv("FLASH_POLYGON_RPC", "")
    gnosis_rpc: str = os.getenv("FLASH_GNOSIS_RPC", "")
    solana_rpc: str = os.getenv("FLASH_SOLANA_RPC", "")
    jupiter_quote_url: str = os.getenv("JUPITER_QUOTE_URL", "https://quote-api.jup.ag/v6/quote")
    binance_api_key: str = os.getenv("BINANCE_API_KEY", "")
    binance_api_secret: str = os.getenv("BINANCE_API_SECRET", "")
    min_profit_usd: str = os.getenv("FLASH_MIN_PROFIT_USD", "1")
    live_execution: bool = os.getenv("FLASHLOAN_LIVE_EXECUTION", "false").lower() == "true"

    def validate(self) -> None:
        if self.live_execution and not self.ethereum_rpc and not self.polygon_rpc and not self.gnosis_rpc and not self.solana_rpc:
            raise ValueError("live execution requires at least one configured chain RPC")
