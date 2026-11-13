"""Independent fail-closed risk gate. It does not place, route, or simulate orders."""
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import isfinite
from .contracts import GuardVerdict, TradeIntent

@dataclass(frozen=True)
class RiskPolicy:
    version: str
    max_order_notional: float
    max_gross_exposure: float
    max_daily_loss: float
    max_leverage: float
    max_slippage_bps: float
    min_liquidity_coverage: float
    max_observation_age_seconds: float

    def __post_init__(self):
        values=(self.max_order_notional,self.max_gross_exposure,self.max_daily_loss,self.max_leverage,
                self.max_slippage_bps,self.min_liquidity_coverage,self.max_observation_age_seconds)
        if not self.version.strip() or not all(isfinite(v) and v >= 0 for v in values):
            raise ValueError("policy requires a version and finite non-negative limits")
        if self.max_order_notional <= 0 or self.max_gross_exposure <= 0 or self.max_leverage <= 0:
            raise ValueError("notional, exposure and leverage limits must be positive")

@dataclass(frozen=True)
class RiskSnapshot:
    equity: float
    gross_exposure_after: float
    daily_loss: float
    leverage_after: float
    observation_age_seconds: float
    kill_switch: bool = False

class RiskEngine:
    """Stateless policy evaluator; callers must obtain snapshot values from trusted live services."""
    def __init__(self, policy: RiskPolicy):
        self._policy=policy

    def evaluate(self, intent: TradeIntent, snapshot: RiskSnapshot,
                 now: datetime | None = None) -> GuardVerdict:
        at=now or datetime.now(timezone.utc)
        if at.tzinfo is None or at.utcoffset() is None:
            raise ValueError("now must be timezone-aware")
        values=(snapshot.equity,snapshot.gross_exposure_after,snapshot.daily_loss,
                snapshot.leverage_after,snapshot.observation_age_seconds)
        reason="APPROVED"
        if not all(isfinite(v) for v in values): reason="NON_FINITE_ACCOUNT_STATE"
        elif any(v < 0 for v in values): reason="INVALID_ACCOUNT_STATE"
        elif snapshot.kill_switch: reason="KILL_SWITCH_ACTIVE"
        elif snapshot.equity <= 0: reason="NON_POSITIVE_EQUITY"
        elif snapshot.observation_age_seconds > self._policy.max_observation_age_seconds: reason="STALE_MARKET_DATA"
        elif intent.notional > self._policy.max_order_notional: reason="ORDER_NOTIONAL_LIMIT"
        elif snapshot.gross_exposure_after > self._policy.max_gross_exposure: reason="GROSS_EXPOSURE_LIMIT"
        elif snapshot.daily_loss >= self._policy.max_daily_loss: reason="DAILY_LOSS_LIMIT"
        elif snapshot.leverage_after > self._policy.max_leverage: reason="LEVERAGE_LIMIT"
        elif intent.expected_slippage_bps > self._policy.max_slippage_bps: reason="SLIPPAGE_LIMIT"
        elif intent.liquidity_coverage < self._policy.min_liquidity_coverage: reason="LIQUIDITY_COVERAGE"
        return GuardVerdict(reason=="APPROVED",reason,at,self._policy.version,intent.intent_id)
