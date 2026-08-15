"""`/api/datasets*` routes.

**Validation runs before any client is acquired.** `get_dataset` (404) and
range parsing/defaulting (422) both happen before `client_ctx()` is ever
entered — see P1-PLAN.md's "Read-path guard and validation ordering". The
client is **not** a FastAPI `Depends`: FastAPI resolves dependencies before
the route body runs, which would open (or 503 on) the database ahead of
404/422 validation.

This module contains **no duckdb exception handling and does not import
duckdb** — the entire read-path guard lives in `client_ctx()`.
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Query

from app.catalogue import get_dataset, list_datasets, to_catalogue_entry
from app.deps import client_ctx
from app.errors import BadRange

router = APIRouter(tags=["datasets"])

# The maximum inclusive span (in days) a `/data` request may cover, per the
# error contract's `bad_range` condition (P1-PLAN.md "API contract").
MAX_RANGE_DAYS = 400


@router.get("/api/datasets")
def get_datasets() -> list[dict[str, Any]]:
    """List every catalogue entry.

    Touches no database — the catalogue is entirely in-process, so this
    answers normally even while a fetch job is running.

    Returns:
        One serialized catalogue entry per registered dataset.
    """
    return [to_catalogue_entry(spec) for spec in list_datasets()]


@router.get("/api/datasets/{dataset_id}/data")
def get_dataset_data(
    dataset_id: str,
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
) -> list[dict[str, Any]]:
    """Return reshaped records for one dataset over `[start, end]`.

    Order of operations (validation before client acquisition):
        1. `get_dataset(dataset_id)` — raises `UnknownDataset` (404).
        2. Parse/default the range — raises `BadRange` (422).
        3. Only then `with client_ctx() as client:` and run the loader.

    Args:
        dataset_id: The kebab-case dataset slug from the URL.
        start: Inclusive ISO date (`YYYY-MM-DD`), or omitted to default.
        end: Inclusive ISO date (`YYYY-MM-DD`), or omitted to default to
            today (UTC).

    Returns:
        One record per timestamp, shaped by the dataset's loader.
    """
    spec = get_dataset(dataset_id)
    start_date, end_date = _resolve_range(start, end, spec.default_range_days)
    with client_ctx() as client:
        return spec.loader(client, start_date, end_date)


def _resolve_range(
    start: str | None, end: str | None, default_range_days: int
) -> tuple[date, date]:
    """Parse and default a `[start, end]` range, raising `BadRange` on failure.

    Args:
        start: Raw `start` query value, or `None` to default.
        end: Raw `end` query value, or `None` to default to today (UTC).
        default_range_days: Inclusive window size used when `start` is
            omitted.

    Returns:
        The resolved `(start_date, end_date)` pair.

    Raises:
        BadRange: Either bound is unparseable, `start > end`, or the span
            exceeds `MAX_RANGE_DAYS`.
    """
    end_date = _parse_date(end) if end is not None else datetime.now(UTC).date()
    start_date = (
        _parse_date(start)
        if start is not None
        else end_date - timedelta(days=default_range_days - 1)
    )
    if start_date > end_date:
        raise BadRange(f"start ({start_date}) is after end ({end_date}).")
    span_days = (end_date - start_date).days
    if span_days > MAX_RANGE_DAYS:
        raise BadRange(f"range spans {span_days} days, exceeding the {MAX_RANGE_DAYS}-day maximum.")
    return start_date, end_date


def _parse_date(value: str) -> date:
    """Parse a `YYYY-MM-DD` string, raising `BadRange` on failure.

    Args:
        value: The raw date string to parse.

    Returns:
        The parsed `date`.

    Raises:
        BadRange: `value` is not a valid ISO date.
    """
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise BadRange(f"'{value}' is not a valid YYYY-MM-DD date.") from exc
