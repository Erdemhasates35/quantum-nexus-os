from __future__ import annotations

from dataclasses import dataclass
from .circuit_breaker import CircuitBreaker
from .evm import transaction_plan


@dataclass(frozen=True)
class ExecutionResult:
    submitted: bool
    reason: str


class SafeExecutor:
    """Fail-closed executor boundary; live submission is intentionally explicit."""
    def __init__(self, breaker: CircuitBreaker | None = None):
        self.breaker = breaker or CircuitBreaker()

    def plan_only(self, *, network: str, receiver: str, asset: str,
                  amount: str, route_calldata: str) -> dict:
        if self.breaker.tripped:
            raise RuntimeError("circuit_breaker_tripped")
        return transaction_plan(network, receiver, asset, amount, route_calldata)

    def submit(self, *args, live_execution: bool = False, **kwargs) -> ExecutionResult:
        if not live_execution:
            return ExecutionResult(False, "live_execution_disabled")
        if self.breaker.tripped:
            return ExecutionResult(False, "circuit_breaker_tripped")
        return ExecutionResult(False, "live_submission_not_implemented")
