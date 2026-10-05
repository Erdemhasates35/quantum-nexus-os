from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum


class Chain(str, Enum):
    ETHEREUM = "ethereum"
    POLYGON = "polygon"
    GNOSIS = "gnosis"
    SOLANA = "solana"


@dataclass(frozen=True)
class Opportunity:
    chain: Chain
    asset: str
    borrow_amount: Decimal
    gross_spread: Decimal
    loan_fee: Decimal
    swap_fees: Decimal
    gas_cost: Decimal
    slippage_cost: Decimal
    priority_cost: Decimal
    net_profit: Decimal
    roi_on_borrowed: Decimal
    executable: bool
    reason: str

    @property
    def total_cost(self) -> Decimal:
        return self.loan_fee + self.swap_fees + self.gas_cost + self.slippage_cost + self.priority_cost
