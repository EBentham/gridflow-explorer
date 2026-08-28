"""`/api/forecasts/*` routes.

Forecasts are a sibling read surface to `/api/datasets/*` (`routers/datasets.py`):
a different query shape (one settlement day, not a `[start, end]` range), a
different response shape, and no coverage/fetch semantics — gridflow_models,
not this app, writes these rows, so there is no "Fetch missing data" here.
`catalogue.py`, `coverage.py`, `fetch.py`, and `jobs.py` are untouched.

Validation ordering mirrors `routers/datasets.py`'s documented rule, with
one nuance forecasts introduces: the `date` query param is pure-input
validation and is checked before `client_ctx()` is entered, so a malformed
date still 422s during a live refresh rather than 503ing. The `model_id`
404 (`unknown_variant`) cannot be checked that early — a Variant is
discovered from the store, not declared statically like a `dataset_id` —
so it is necessarily raised from inside `with client_ctx():`, in
`app.forecasts.day_forecast`.

This module contains **no** duckdb exception handling and does not import
duckdb — the entire read-path guard lives in `client_ctx()`.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Query

from app.deps import client_ctx
from app.forecasts import day_forecast, list_variants, variant_metrics
from app.ranges import parse_date

router = APIRouter(tags=["forecasts"])

# `Annotated[..., Query()]` with a plain `= None` default (rather than
# `= Query(default=None)`) is the form ruff's B008 check recognises as safe
# for a `list[...]`-annotated parameter — a bare `Query(default=None)`
# default trips B008 ("mutable default") specifically when the annotation
# is a `list[...]`, unlike the `str | None` params in `routers/datasets.py`.
ModelIdFilter = Annotated[list[str] | None, Query()]


@router.get("/api/forecasts/variants")
def get_forecast_variants() -> list[dict[str, Any]]:
    """List every forecast Variant present, from its newest run.

    Touches the database (unlike `/api/datasets`, which is pure catalogue),
    so this answers `503 refresh_in_progress` during a live write, same as
    every other route in this module.

    Returns:
        One entry per distinct `model_id`, or `[]` if the store holds no
        forecasts — never an error for the empty case.
    """
    with client_ctx() as client:
        return list_variants(client)


@router.get("/api/forecasts/day")
def get_forecast_day(
    date: str = Query(...),
    model_id: ModelIdFilter = None,
) -> list[dict[str, Any]]:
    """Return one record per settlement period of `date`, per requested Variant.

    Order of operations:
        1. `parse_date(date)` — raises `BadRange` (422) before any client
           is acquired.
        2. Only then `with client_ctx() as client:` — `day_forecast` raises
           `UnknownVariant` (404) inside this block if any requested
           `model_id` is not present anywhere in the store.

    Args:
        date: The settlement day, `YYYY-MM-DD`.
        model_id: Zero or more Variant ids to restrict to (repeatable query
            param); omitted means every Variant present.

    Returns:
        One record per settlement period, per matching Variant. `[]` for a
        valid date with no rows — the empty state the frontend renders,
        distinct from the 404 raised for an unknown Variant.
    """
    day = parse_date(date)
    with client_ctx() as client:
        return day_forecast(client, day, model_id)


@router.get("/api/forecasts/metrics")
def get_forecast_metrics(model_id: ModelIdFilter = None) -> list[dict[str, Any]]:
    """Return the newest run's metrics for each requested (or every) Variant.

    Args:
        model_id: Zero or more Variant ids to restrict to (repeatable query
            param); omitted means every Variant present.

    Returns:
        Run-scoped metric rows plus every row carrying a gate verdict, for
        each Variant's newest run. `[]` if the store holds no matching
        metrics.
    """
    with client_ctx() as client:
        return variant_metrics(client, model_id)
