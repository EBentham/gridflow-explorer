"""Shared date-range parsing, used by every route that accepts `start`/`end`.

Extracted from `routers/datasets.py` in P3 because a third route
(`/coverage`, and later `/fetch`) needs the exact same parse/default/validate
behaviour as `/data`. Behaviour is unchanged from the P1 implementation —
only the module and the two functions' names moved (now public, since three
routes call them).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from app.errors import BadRange

# The maximum inclusive span (in days) a range-bearing request may cover,
# per the error contract's `bad_range` condition (P1-PLAN.md "API contract").
MAX_RANGE_DAYS = 400


def resolve_range(
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
    end_date = parse_date(end) if end is not None else datetime.now(UTC).date()
    start_date = (
        parse_date(start)
        if start is not None
        else end_date - timedelta(days=default_range_days - 1)
    )
    if start_date > end_date:
        raise BadRange(f"start ({start_date}) is after end ({end_date}).")
    span_days = (end_date - start_date).days
    if span_days > MAX_RANGE_DAYS:
        raise BadRange(f"range spans {span_days} days, exceeding the {MAX_RANGE_DAYS}-day maximum.")
    return start_date, end_date


def parse_date(value: str) -> date:
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
