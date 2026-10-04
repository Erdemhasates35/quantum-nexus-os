from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass(frozen=True)
class RiskDecision:
    approved: bool
    score: Decimal
    reason: str


def gate(*, net_profit: Decimal, min_profit: Decimal, slippage_bps: Decimal,
         max_slippage_bps: Decimal, gas_cost: Decimal, max_gas_cost: Decimal,
         route_trusted: bool = True) -> RiskDecision:
    if not route_trusted:
        return RiskDecision(False, Decimal("100"), "route_not_trusted")
    if slippage_bps > max_slippage_bps:
        return RiskDecision(False, Decimal("80"), "slippage_limit")
    if gas_cost > max_gas_cost:
        return RiskDecision(False, Decimal("70"), "gas_limit")
    if net_profit < min_profit:
        return RiskDecision(False, Decimal("60"), "profit_threshold")
    score = max(Decimal("0"), Decimal("100") - slippage_bps * 2)
    return RiskDecision(True, score, "risk_gate_passed")
