from __future__ import annotations
from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class SizePoint:
    amount: Decimal
    net_profit: Decimal
    profit_per_gas: Decimal
    roi: Decimal


def rank_opportunity(*, net_profit: Decimal, gas_cost: Decimal, roi: Decimal,
                     latency_ms: int, max_latency_ms: int = 1500) -> Decimal:
    if latency_ms > max_latency_ms or net_profit <= 0:
        return Decimal("-1")
    gas_efficiency = net_profit / gas_cost if gas_cost > 0 else net_profit
    latency_factor = Decimal(max_latency_ms - latency_ms) / Decimal(max_latency_ms)
    return (gas_efficiency * Decimal("0.7") + roi * Decimal("0.3")) * latency_factor


def best_size(*, minimum: Decimal, maximum: Decimal, spread_bps: Decimal,
              variable_cost_bps: Decimal, fixed_cost: Decimal,
              min_profit: Decimal, steps: int = 32) -> SizePoint | None:
    if minimum <= 0 or maximum < minimum or steps < 2:
        raise ValueError("invalid sizing bounds")
    best = None
    for i in range(steps + 1):
        amount = minimum + (maximum - minimum) * Decimal(i) / Decimal(steps)
        net = amount * (spread_bps - variable_cost_bps) / Decimal(10_000) - fixed_cost
        if net >= min_profit:
            ppg = net / fixed_cost if fixed_cost > 0 else net
            roi = net / amount
            candidate = SizePoint(amount, net, ppg, roi)
            if best is None or candidate.net_profit > best.net_profit:
                best = candidate
    return best
