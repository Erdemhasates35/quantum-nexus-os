from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class RoutePolicy:
    allowed_executors: frozenset[str]
    max_hops: int = 3


def validate_route(*, executor: str, hops: int, calldata: str, policy: RoutePolicy) -> None:
    if executor.lower() not in {x.lower() for x in policy.allowed_executors}:
        raise ValueError("executor_not_allowlisted")
    if not 1 <= hops <= policy.max_hops:
        raise ValueError("hop_limit")
    if not calldata or calldata == "0x":
        raise ValueError("missing_route_calldata")
