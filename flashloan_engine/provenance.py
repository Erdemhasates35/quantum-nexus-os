from __future__ import annotations

import hashlib
import json
from typing import Any


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def fingerprint(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()


def quote_is_fresh(*, observed_at_ms: int, now_ms: int, max_age_ms: int) -> bool:
    age = now_ms - observed_at_ms
    return 0 <= age <= max_age_ms
