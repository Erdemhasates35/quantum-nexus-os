"""Shared research primitives for the Erdem Technology Platform."""
from .metrics import PerformanceSummary, summarize_returns
from .risk import RiskLimits, TradeProposal, RiskDecision, assess_trade
from .data_quality import DataQualityReport, validate_time_series
from .events import EventEnvelope, make_event

__all__ = ["PerformanceSummary", "summarize_returns", "RiskLimits", "TradeProposal", "RiskDecision", "assess_trade", "DataQualityReport", "validate_time_series", "EventEnvelope", "make_event"]
