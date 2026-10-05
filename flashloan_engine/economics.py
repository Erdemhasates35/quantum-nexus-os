from __future__ import annotations

from decimal import Decimal, ROUND_DOWN

from .models import Chain, Opportunity

ZERO = Decimal("0")


def D(value: object) -> Decimal:
    return Decimal(str(value))


def build_opportunity(
    *, chain: Chain, asset: str, borrow_amount: object, gross_spread: object,
    loan_fee_bps: object, swap_fee_bps: object, gas_cost: object,
    slippage_bps: object, priority_cost: object, min_profit: object,
) -> Opportunity:
    amount = D(borrow_amount)
    spread = D(gross_spread)
    if amount < ZERO or spread < ZERO:
        raise ValueError("borrow amount and spread must be non-negative")
    for value in (loan_fee_bps, swap_fee_bps, slippage_bps, gas_cost, priority_cost, min_profit):
        if D(value) < ZERO:
            raise ValueError("economic costs and thresholds must be non-negative")
    loan_fee = amount * D(loan_fee_bps) / D(10_000)
    swap_fees = amount * D(swap_fee_bps) / D(10_000)
    slippage = amount * D(slippage_bps) / D(10_000)
    gas = D(gas_cost)
    priority = D(priority_cost)
    gross = amount * spread / D(10_000)
    net = gross - loan_fee - swap_fees - gas - slippage - priority
    roi = (net / amount) if amount else ZERO
    executable = amount > ZERO and net >= D(min_profit)
    reason = "positive_net_edge" if executable else "net_edge_below_threshold"
    return Opportunity(chain, asset, amount, gross, loan_fee, swap_fees, gas, slippage,
                       priority, net.quantize(Decimal("0.00000001"), rounding=ROUND_DOWN),
                       roi, executable, reason)
