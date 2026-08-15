"""`POST /api/datasets/{dataset_id}/fetch` and `GET /api/jobs/current` —
the P3 write path (P1-PLAN.md "`POST /api/datasets/{dataset_id}/fetch` —
P3, contract fixed here").

Validation ordering mirrors `routers/datasets.py`: `get_dataset` (404) ->
`resolve_range` (422) -> only then is `JOBS.try_start` reached, so neither
the lookup nor the range check ever invokes the preflight probe. This
module contains **no** duckdb exception handling and does not import
duckdb — `probe_writer_lock` (in `app.fetch`) owns that translation, same
as `client_ctx` does for the read path.
"""

from __future__ import annotations

from functools import partial
from typing import Any

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.catalogue import get_dataset
from app.errors import ErrorCode, RefreshInProgress, error_envelope
from app.fetch import probe_writer_lock, run_fetch_job
from app.jobs import JOBS, to_job_payload
from app.ranges import resolve_range

router = APIRouter(tags=["jobs"])


@router.post("/api/datasets/{dataset_id}/fetch")
def post_fetch(
    dataset_id: str,
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
) -> JSONResponse:
    """Start a fetch job for one dataset over `[start, end]`.

    Order of operations (same ordering rule as `/data` and `/coverage`):
        1. `get_dataset(dataset_id)` -> `UnknownDataset` (404).
        2. `resolve_range` -> `BadRange` (422).
        3. Only then `JOBS.try_start(dataset_id, target=..., preflight=
           probe_writer_lock)`.

    A `None` return from `try_start` (a job is already `RUNNING`) and a
    `RefreshInProgress` raised by the preflight (a live writer, or an
    orphaned writer from a previous server generation — P1-PLAN.md case 7)
    both mean the same thing to the caller: **409**, built with
    `error_envelope`. `CatalogueMissing` from the preflight is deliberately
    **not** caught here — it propagates to `main.py`'s standard `ApiError`
    handler, which answers the normal 503.

    Args:
        dataset_id: The kebab-case dataset slug from the URL.
        start: Inclusive ISO date (`YYYY-MM-DD`), or omitted to default.
        end: Inclusive ISO date (`YYYY-MM-DD`), or omitted to default to
            today (UTC).

    Returns:
        202 with `to_job_payload` on acceptance, or 409 with the standard
        error envelope if a fetch is already in flight.
    """
    spec = get_dataset(dataset_id)
    start_date, end_date = resolve_range(start, end, spec.default_range_days)

    try:
        job = JOBS.try_start(
            dataset_id,
            target=partial(run_fetch_job, spec=spec, start=start_date, end=end_date),
            preflight=probe_writer_lock,
        )
    except RefreshInProgress as exc:
        return JSONResponse(
            status_code=409,
            content=error_envelope(ErrorCode.REFRESH_IN_PROGRESS, exc.message),
        )

    if job is None:
        return JSONResponse(
            status_code=409,
            content=error_envelope(
                ErrorCode.REFRESH_IN_PROGRESS,
                "A dataset refresh is already in progress.",
            ),
        )

    return JSONResponse(status_code=202, content=to_job_payload(job))


@router.get("/api/jobs/current")
def get_current_job() -> dict[str, Any]:
    """Report the current fetch job's status.

    Touches no database — job state is entirely in-process — so this
    answers normally throughout a fetch, including while the job holds the
    write lock. That is what makes polling work.

    Returns:
        `to_job_payload(job)` if a job has been started this process
        generation, or `{"state": "idle"}` if none has.
    """
    job = JOBS.current()
    if job is None:
        return {"state": "idle"}
    return to_job_payload(job)
