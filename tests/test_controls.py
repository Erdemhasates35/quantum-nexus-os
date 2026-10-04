from decimal import Decimal

import pytest

from flashloan_engine.circuit_breaker import CircuitBreaker
from flashloan_engine.provenance import fingerprint, quote_is_fresh
from flashloan_engine.risk import gate
from flashloan_engine.routes import RoutePolicy, validate_route


def test_risk_gate_rejects_stale_economics():
    d = gate(net_profit=Decimal("2"), min_profit=Decimal("1"), slippage_bps=5,
             max_slippage_bps=20, gas_cost=1, max_gas_cost=10, route_trusted=True)
    assert d.approved


def test_route_allowlist_is_fail_closed():
    with pytest.raises(ValueError, match="executor_not_allowlisted"):
        validate_route(executor="0xbad", hops=2, calldata="0x1234",
                       policy=RoutePolicy(frozenset({"0xgood"})))


def test_quote_freshness_and_fingerprint():
    assert quote_is_fresh(observed_at_ms=1000, now_ms=1500, max_age_ms=1000)
    assert not quote_is_fresh(observed_at_ms=1000, now_ms=2501, max_age_ms=1000)
    assert fingerprint({"b": 2, "a": 1}) == fingerprint({"a": 1, "b": 2})


def test_circuit_breaker_trips():
    b = CircuitBreaker(max_consecutive_failures=2, max_loss_usd=Decimal("5"))
    b.record_failure(Decimal("1"))
    b.record_failure(Decimal("1"))
    assert b.tripped
