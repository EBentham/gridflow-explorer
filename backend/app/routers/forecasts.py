"""`/api/forecasts/*` routes.

Forecasts are a sibling read surface to `/api/datasets/*` (`routers/datasets.py`):
a different query shape (one settlement day, not a `[start, end]` range), a
different response shape, and no coverage/fetch semantics — gridflow_models,
not this app, writes these rows, so there is no "Fetch missing data" here.
`catalogue.py`, `coverage.py`, `fetch.py`, and `jobs.py` are untouched.

A Variant is `(model_id, vintage_policy_id)`, not `model_id` alone — see
`app.forecasts`'s module docstring RESOLVED DEFECT #1 note. `/day` and
`/metrics` accept `variant_key` — `app.forecasts._encode_variant_key(...)`
strings identifying one exact Variant pair each (RESOLVED DEFECT #2: an
earlier cut accepted `model_id` and `vintage_policy_id` as two
independently-ANDed filters, which let a request name a `model_id` and a
`vintage_policy_id` that each existed elsewhere, but never together as a
real Variant, silently pass with `200 []` instead of `404 unknown_variant`).

Validation ordering mirrors `routers/datasets.py`'s documented rule for the
part that can: the `date` query param is pure-input validation and is
checked before `client_ctx()` is entered, so a malformed date still 422s
during a live refresh rather than 503ing.

**Documented exception to that rule** (Sol diff review, first confirmatory
pass): the `unknown_variant` 404 cannot be checked before `client_ctx()`
the way `get_dataset(dataset_id)` can in `routers/datasets.py`. A
`dataset_id` is a static, in-process registry lookup — zero I/O, so it can
run ahead of the guard unconditionally. Whether a `variant_key` names a
real Variant is a fact about the DuckDB store itself; there is no static
registry of Variants to check it against, so the check is intrinsically
inside `with client_ctx():`, in `app.forecasts.day_forecast`. The accepted
consequence: during a live writer lock, a request naming an unknown
Variant answers `503 refresh_in_progress`, not `404 unknown_variant`. This
is treated as correct, not merely tolerated — while the store is locked,
whether the Variant exists is genuinely unknown, and answering `404` would
risk a false "this Variant does not exist" for one the store actually
holds. A second, unguarded connection opened just to answer this one
question ahead of the lock is not an option either: P4-forecast-screen-
SPEC.md's "many-RO XOR one-RW" rule requires reusing `client_ctx()`
unchanged, and any separate existence check would still need the same
lock-detection logic `client_ctx()` already implements, duplicating it
rather than avoiding it.

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
VariantKeyFilter = Annotated[list[str] | None, Query()]


@router.get("/api/forecasts/variants")
def get_forecast_variants() -> list[dict[str, Any]]:
    """List every forecast Variant present, from its newest run.

    Touches the database (unlike `/api/datasets`, which is pure catalogue),
    so this answers `503 refresh_in_progress` during a live write, same as
    every other route in this module.

    Returns:
        One entry per distinct `(model_id, vintage_policy_id)` pair, or
        `[]` if the store holds no forecasts — never an error for the
        empty case.
    """
    with client_ctx() as client:
        return list_variants(client)


@router.get("/api/forecasts/day")
def get_forecast_day(
    date: str = Query(...),
    variant_key: VariantKeyFilter = None,
) -> list[dict[str, Any]]:
    """Return one record per settlement period of `date`, per requested Variant.

    Order of operations — see module docstring for the one documented
    exception:
        1. `parse_date(date)` — raises `BadRange` (422) before any client
           is acquired.
        2. Only then `with client_ctx() as client:` — `day_forecast` raises
           `UnknownVariant` (404) inside this block if any requested
           `variant_key` does not name a Variant present in the store.

    Args:
        date: The settlement day, `YYYY-MM-DD`.
        variant_key: Zero or more `app.forecasts._encode_variant_key(...)`
            Variant ids to restrict to (repeatable query param); omitted
            means every Variant present.

    Returns:
        One record per settlement period, per matching Variant, each
        carrying `vintage_policy_id` so two policies under one `model_id`
        are always separable. `[]` for a valid date with no rows — the
        empty state the frontend renders, distinct from the 404 raised for
        an unknown Variant.
    """
    day = parse_date(date)
    with client_ctx() as client:
        return day_forecast(client, day, variant_key)


@router.get("/api/forecasts/metrics")
def get_forecast_metrics(variant_key: VariantKeyFilter = None) -> list[dict[str, Any]]:
    """Return the newest run's metrics for each requested (or every) Variant.

    Args:
        variant_key: Zero or more `app.forecasts._encode_variant_key(...)`
            Variant ids to restrict to (repeatable query param); omitted
            means every Variant present.

    Returns:
        Run-scoped metric rows plus every row carrying a gate verdict, for
        each Variant's (`model_id`, `vintage_policy_id`) newest run. `[]`
        if the store holds no matching metrics.
    """
    with client_ctx() as client:
        return variant_metrics(client, variant_key)
