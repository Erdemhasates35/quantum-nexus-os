"""Deterministic proposal risk checks; not a broker or exchange gateway."""
from dataclasses import dataclass

@dataclass(frozen=True)
class RiskLimits:
    max_position_pct: float
    max_daily_loss_pct: float
    max_slippage_bps: float
    min_liquidity_coverage: float = 1.0

@dataclass(frozen=True)
class TradeProposal:
    position_pct: float
    daily_loss_pct: float
    estimated_slippage_bps: float
    liquidity_coverage: float = 1.0

@dataclass(frozen=True)
class RiskDecision:
    approved: bool
    reason: str

def assess_trade(proposal: TradeProposal, limits: RiskLimits) -> RiskDecision:
    limits_values = (limits.max_position_pct, limits.max_daily_loss_pct,
                     limits.max_slippage_bps, limits.min_liquidity_coverage)
    proposal_values = (proposal.position_pct, proposal.daily_loss_pct,
                       proposal.estimated_slippage_bps, proposal.liquidity_coverage)
    if any(v < 0 for v in limits_values + proposal_values):
        return RiskDecision(False, "INVALID_NEGATIVE_VALUE")
    if limits.max_position_pct > 100 or limits.max_daily_loss_pct > 100:
        return RiskDecision(False, "INVALID_PERCENT_LIMIT")
    if proposal.position_pct > limits.max_position_pct:
        return RiskDecision(False, "POSITION_LIMIT")
    if proposal.daily_loss_pct >= limits.max_daily_loss_pct:
        return RiskDecision(False, "DAILY_LOSS_LIMIT")
    if proposal.estimated_slippage_bps > limits.max_slippage_bps:
        return RiskDecision(False, "SLIPPAGE_LIMIT")
    if proposal.liquidity_coverage < limits.min_liquidity_coverage:
        return RiskDecision(False, "LIQUIDITY_COVERAGE")
    return RiskDecision(True, "RISK_APPROVED")
