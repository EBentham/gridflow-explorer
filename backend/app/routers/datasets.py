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

from typing import Any

from fastapi import APIRouter, Query

from app.catalogue import get_dataset, list_datasets, to_catalogue_entry
from app.deps import client_ctx
from app.ranges import resolve_range

router = APIRouter(tags=["datasets"])


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
    start_date, end_date = resolve_range(start, end, spec.default_range_days)
    with client_ctx() as client:
        return spec.loader(client, start_date, end_date)
