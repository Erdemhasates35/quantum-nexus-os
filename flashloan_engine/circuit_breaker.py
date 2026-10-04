from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


@dataclass
class CircuitBreaker:
    max_consecutive_failures: int = 3
    max_loss_usd: Decimal = Decimal("50")
    consecutive_failures: int = 0
    realized_loss_usd: Decimal = Decimal("0")

    @property
    def tripped(self) -> bool:
        return (
            self.consecutive_failures >= self.max_consecutive_failures
            or self.realized_loss_usd >= self.max_loss_usd
        )

    def record_success(self) -> None:
        self.consecutive_failures = 0

    def record_failure(self, loss_usd: Decimal = Decimal("0")) -> None:
        self.consecutive_failures += 1
        self.realized_loss_usd += max(Decimal("0"), loss_usd)
