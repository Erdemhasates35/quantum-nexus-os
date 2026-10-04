from __future__ import annotations

from decimal import Decimal

import requests


class JupiterQuotes:
    def __init__(self, quote_url: str):
        self.quote_url = quote_url

    def quote(self, input_mint: str, output_mint: str, amount_atomic: int, slippage_bps: int = 20) -> dict:
        r = requests.get(self.quote_url, params={
            "inputMint": input_mint,
            "outputMint": output_mint,
            "amount": str(amount_atomic),
            "slippageBps": str(slippage_bps),
        }, timeout=5)
        r.raise_for_status()
        return r.json()

    @staticmethod
    def implied_return(quote: dict, input_decimals: int, output_decimals: int) -> Decimal:
        amount_in = Decimal(str(quote["inAmount"])) / (Decimal(10) ** input_decimals)
        amount_out = Decimal(str(quote["outAmount"])) / (Decimal(10) ** output_decimals)
        return amount_out / amount_in if amount_in else Decimal(0)
