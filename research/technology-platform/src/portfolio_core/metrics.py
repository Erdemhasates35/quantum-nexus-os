"""Dependency-free periodic return metrics. Returns must already be net of costs."""
from dataclasses import dataclass
from math import sqrt
from statistics import mean, pstdev
from typing import Iterable

@dataclass(frozen=True)
class PerformanceSummary:
    observations: int
    cumulative_return: float
    annualized_return: float
    annualized_volatility: float
    sharpe: float | None
    max_drawdown: float

def summarize_returns(returns: Iterable[float], periods_per_year: int = 252,
                      risk_free_per_period: float = 0.0) -> PerformanceSummary:
    values = tuple(float(x) for x in returns)
    if not values:
        raise ValueError("returns must contain at least one observation")
    if periods_per_year <= 0:
        raise ValueError("periods_per_year must be positive")
    if any(x <= -1.0 for x in values):
        raise ValueError("simple returns must be greater than -100%")
    if any(not (-1e6 < x < 1e6) for x in values):
        raise ValueError("returns contain non-finite or unreasonable values")
    wealth, peak, max_dd = 1.0, 1.0, 0.0
    for value in values:
        wealth *= 1.0 + value
        peak = max(peak, wealth)
        max_dd = max(max_dd, 1.0 - wealth / peak)
    vol = pstdev(values) if len(values) > 1 else 0.0
    excess = tuple(x - risk_free_per_period for x in values)
    excess_vol = pstdev(excess) if len(excess) > 1 else 0.0
    sharpe = mean(excess) / excess_vol * sqrt(periods_per_year) if excess_vol > 0 else None
    annualized = wealth ** (periods_per_year / len(values)) - 1.0 if wealth > 0 else -1.0
    return PerformanceSummary(len(values), wealth - 1.0, annualized,
                              vol * sqrt(periods_per_year), sharpe, max_dd)
