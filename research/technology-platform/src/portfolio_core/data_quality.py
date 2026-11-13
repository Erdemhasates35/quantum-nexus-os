"""Dependency-free time-series quality checks for research ingestion."""
from dataclasses import dataclass
from typing import Iterable, Mapping, Sequence

@dataclass(frozen=True)
class DataQualityReport:
    rows: int
    duplicate_ids: int
    non_monotonic_timestamps: int
    missing_required_values: int
    passed: bool

def validate_time_series(rows: Iterable[Mapping[str, object]],
                         required_fields: Sequence[str],
                         id_field: str = "event_id",
                         timestamp_field: str = "timestamp") -> DataQualityReport:
    materialized = tuple(rows)
    seen, duplicates, non_monotonic, missing = set(), 0, 0, 0
    previous_timestamp = None
    for row in materialized:
        missing += sum(1 for field in required_fields if field not in row or row[field] is None)
        identifier = row.get(id_field)
        if identifier is not None:
            if identifier in seen:
                duplicates += 1
            seen.add(identifier)
        timestamp = row.get(timestamp_field)
        if timestamp is not None:
            if previous_timestamp is not None and timestamp < previous_timestamp:
                non_monotonic += 1
            previous_timestamp = timestamp
    return DataQualityReport(len(materialized), duplicates, non_monotonic, missing,
                              duplicates == 0 and non_monotonic == 0 and missing == 0)
