from __future__ import annotations

import os
from dataclasses import dataclass


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default).lower()).strip().lower() == "true"


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
    max_slippage_bps: str = os.getenv("FLASH_MAX_SLIPPAGE_BPS", "30")
    max_gas_cost_usd: str = os.getenv("FLASH_MAX_GAS_USD", "25")
    max_quote_age_ms: int = int(os.getenv("FLASH_MAX_QUOTE_AGE_MS", "1500"))
    live_execution: bool = _bool("FLASHLOAN_LIVE_EXECUTION")

    def validate(self) -> None:
        for name, value in {
            "FLASH_MIN_PROFIT_USD": self.min_profit_usd,
            "FLASH_MAX_SLIPPAGE_BPS": self.max_slippage_bps,
            "FLASH_MAX_GAS_USD": self.max_gas_cost_usd,
        }.items():
            if float(value) < 0:
                raise ValueError(f"{name} must be non-negative")
        if self.max_quote_age_ms <= 0:
            raise ValueError("FLASH_MAX_QUOTE_AGE_MS must be positive")
        if self.live_execution and not any((self.ethereum_rpc, self.polygon_rpc, self.gnosis_rpc, self.solana_rpc)):
            raise ValueError("live execution requires at least one configured chain RPC")
