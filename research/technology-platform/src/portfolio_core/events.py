"""Versioned cross-service event envelope primitive."""
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Mapping
from uuid import uuid4

@dataclass(frozen=True)
class EventEnvelope:
    event_id: str
    event_type: str
    schema_version: int
    event_time: str
    observed_time: str
    producer: str
    correlation_id: str
    payload: Mapping[str, Any]

def make_event(event_type: str, producer: str, payload: Mapping[str, Any],
               correlation_id: str | None = None,
               event_time: datetime | None = None) -> dict[str, Any]:
    if not event_type.strip() or not producer.strip():
        raise ValueError("event_type and producer are required")
    now = datetime.now(timezone.utc)
    occurred = event_time or now
    return asdict(EventEnvelope(
        event_id=str(uuid4()), event_type=event_type, schema_version=1,
        event_time=occurred.astimezone(timezone.utc).isoformat(),
        observed_time=now.isoformat(), producer=producer,
        correlation_id=correlation_id or str(uuid4()), payload=dict(payload)))
