from __future__ import annotations

import hashlib
import hmac
import time
from urllib.parse import urlencode

import requests


class BinanceMarket:
    def __init__(self, base_url: str = "https://api.binance.com", api_key: str = "", api_secret: str = ""):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.api_secret = api_secret

    def ticker(self, symbol: str) -> dict:
        r = requests.get(f"{self.base_url}/api/v3/ticker/bookTicker", params={"symbol": symbol.upper()}, timeout=5)
        r.raise_for_status()
        return r.json()

    def signed_account(self) -> dict:
        if not self.api_key or not self.api_secret:
            raise RuntimeError("Binance credentials are not configured")
        params = {"timestamp": int(time.time() * 1000)}
        query = urlencode(params)
        params["signature"] = hmac.new(self.api_secret.encode(), query.encode(), hashlib.sha256).hexdigest()
        r = requests.get(f"{self.base_url}/api/v3/account", params=params,
                         headers={"X-MBX-APIKEY": self.api_key}, timeout=5)
        r.raise_for_status()
        return r.json()
