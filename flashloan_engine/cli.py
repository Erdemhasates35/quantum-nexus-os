from __future__ import annotations

import argparse
import json
from decimal import Decimal

from .economics import build_opportunity
from .models import Chain


def main() -> None:
    p = argparse.ArgumentParser(description="Flash-loan opportunity economics; no transaction submission by default.")
    p.add_argument("--chain", choices=[c.value for c in Chain], required=True)
    p.add_argument("--asset", required=True)
    p.add_argument("--amount", required=True)
    p.add_argument("--spread-bps", required=True)
    p.add_argument("--loan-fee-bps", default="5")
    p.add_argument("--swap-fee-bps", default="60")
    p.add_argument("--gas-cost", default="0")
    p.add_argument("--slippage-bps", default="10")
    p.add_argument("--priority-cost", default="0")
    p.add_argument("--min-profit", default="1")
    a = p.parse_args()
    o = build_opportunity(chain=Chain(a.chain), asset=a.asset, borrow_amount=a.amount,
                          gross_spread=a.spread_bps, loan_fee_bps=a.loan_fee_bps,
                          swap_fee_bps=a.swap_fee_bps, gas_cost=a.gas_cost,
                          slippage_bps=a.slippage_bps, priority_cost=a.priority_cost,
                          min_profit=a.min_profit)
    print(json.dumps({
        "chain": o.chain.value, "asset": o.asset, "borrow_amount": str(o.borrow_amount),
        "gross_profit": str(o.gross_spread), "total_cost": str(o.total_cost),
        "net_profit": str(o.net_profit), "roi_on_borrowed": str(o.roi_on_borrowed),
        "executable": o.executable, "reason": o.reason,
    }, sort_keys=True))


if __name__ == "__main__":
    main()
