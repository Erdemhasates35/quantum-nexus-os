from __future__ import annotations
from decimal import Decimal


def break_even_spread_bps(*, loan_fee_bps: Decimal, swap_fee_bps: Decimal,
                          slippage_bps: Decimal, gas_cost: Decimal,
                          priority_cost: Decimal, amount: Decimal,
                          target_profit: Decimal = Decimal("0")) -> Decimal:
    if amount <= 0:
        raise ValueError("amount must be positive")
    fixed_bps = (gas_cost + priority_cost + target_profit) / amount * Decimal("10000")
    return loan_fee_bps + swap_fee_bps + slippage_bps + fixed_bps


def max_slippage_bps(*, spread_bps: Decimal, loan_fee_bps: Decimal,
                     swap_fee_bps: Decimal, gas_cost: Decimal,
                     priority_cost: Decimal, amount: Decimal,
                     target_profit: Decimal = Decimal("0")) -> Decimal:
    return spread_bps - loan_fee_bps - swap_fee_bps - (
        (gas_cost + priority_cost + target_profit) / amount * Decimal("10000")
    )
