"""Typed, provider-neutral contracts. Timestamps must be timezone-aware UTC-compatible values."""
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from math import isfinite

class AgentRole(str, Enum):
    SCOUT = "scout"
    CARTOGRAPHER = "cartographer"
    JUDGE = "judge"
    GUARD = "guard"
    EXECUTOR = "executor"

@dataclass(frozen=True)
class MarketObservation:
    source_id: str
    instrument: str
    observed_at: datetime
    received_at: datetime
    price: float
    sequence: str

    def __post_init__(self):
        if not all((self.source_id.strip(), self.instrument.strip(), self.sequence.strip())):
            raise ValueError("source_id, instrument and sequence are required")
        for stamp in (self.observed_at, self.received_at):
            if stamp.tzinfo is None or stamp.utcoffset() is None:
                raise ValueError("timestamps must be timezone-aware")
        if not isfinite(self.price) or self.price <= 0:
            raise ValueError("price must be finite and positive")
        if self.observed_at.astimezone(timezone.utc) > self.received_at.astimezone(timezone.utc):
            raise ValueError("observation cannot be received before it is observed")

@dataclass(frozen=True)
class TradeIntent:
    intent_id: str
    instrument: str
    side: str
    notional: float
    reference_price: float
    expected_slippage_bps: float
    liquidity_coverage: float
    strategy_id: str
    source_observation_id: str

    def __post_init__(self):
        if not all((self.intent_id.strip(), self.instrument.strip(), self.strategy_id.strip(), self.source_observation_id.strip())):
            raise ValueError("intent identity fields are required")
        if self.side not in {"buy", "sell"}:
            raise ValueError("side must be buy or sell")
        values=(self.notional,self.reference_price,self.expected_slippage_bps,self.liquidity_coverage)
        if not all(isfinite(v) for v in values):
            raise ValueError("intent values must be finite")
        if self.notional <= 0 or self.reference_price <= 0 or self.expected_slippage_bps < 0 or self.liquidity_coverage < 0:
            raise ValueError("intent values are outside valid domain")

@dataclass(frozen=True)
class GuardVerdict:
    approved: bool
    reason_code: str
    evaluated_at: datetime
    policy_version: str
    intent_id: str

    def __post_init__(self):
        if self.evaluated_at.tzinfo is None or self.evaluated_at.utcoffset() is None:
            raise ValueError("evaluated_at must be timezone-aware")
        if self.approved and self.reason_code != "APPROVED":
            raise ValueError("approved verdict must use APPROVED reason")
        if not self.approved and self.reason_code == "APPROVED":
            raise ValueError("denied verdict cannot use APPROVED reason")
