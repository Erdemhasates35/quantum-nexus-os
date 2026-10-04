from __future__ import annotations

from dataclasses import asdict
from .models import Opportunity
from .provenance import fingerprint


def opportunity_record(opportunity: Opportunity) -> dict:
    record = asdict(opportunity)
    record["chain"] = opportunity.chain.value
    record["total_cost"] = str(opportunity.total_cost)
    for key, value in list(record.items()):
        if hasattr(value, "as_tuple"):
            record[key] = str(value)
    record["fingerprint"] = fingerprint(record)
    return record
