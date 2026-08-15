"""Guarded, short-lived acquisition of a read-only `GridflowClient`.

`client_ctx()` is a plain `@contextmanager`, **not** a FastAPI dependency.
FastAPI resolves `Depends(...)` before the route body runs, so a client
acquired via `Depends` would be opened — or would 503 — *before* the route
ever checks whether the dataset exists or the range parses. During a
refresh (or with a missing catalogue), that would turn a 404/422 into a
503. Routes must therefore validate first and only then enter
`with client_ctx() as client:` — see P1-PLAN.md's "Read-path guard and
validation ordering".

The duckdb catch below is deliberately narrow: only a `duckdb.IOException`
that `is_lock_error` recognises is mapped to `RefreshInProgress`. Every
other duckdb error propagates unchanged. A broad `except duckdb.Error`
would disguise a schema drift, a SQL bug, or a corrupt catalogue as a
transient "refresh in progress" — those are bugs and must be visible as a
genuine 500.

Each acquisition is short-lived on purpose: DuckDB holds its read-only
handle for the connection's lifetime, so `client_ctx()` opens, yields, and
closes in `finally` around a single request rather than holding a
long-lived client — that is what keeps the "writer grabs the file between
our open and our query" window nonexistent once open has succeeded.
"""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager

import duckdb
from gridflow.serving.client import GridflowClient

from app.errors import CatalogueMissing, RefreshInProgress
from app.jobs import JOBS, is_lock_error
from app.settings import get_settings


@contextmanager
def client_ctx() -> Generator[GridflowClient, None, None]:
    """Acquire a short-lived, read-only `GridflowClient` under the write guard.

    Order of checks:
        1. `JOBS.is_running()` — before constructing any client, so during a
           fetch job there is genuinely no connect attempt.
        2. Construct the client inside `try`:
           - `FileNotFoundError` -> `CatalogueMissing`.
           - `duckdb.IOException` for which `is_lock_error` is true ->
             `RefreshInProgress`.
           - every other duckdb error propagates unchanged.
        3. Yield the client; `close()` in `finally`, covering the case
           where the loader raises mid-query, so the read handle is never
           leaked back to a waiting writer.

    Yields:
        A read-only `GridflowClient` for the duration of the `with` block.

    Raises:
        RefreshInProgress: A fetch job is running, or DuckDB reports a
            lock-classified error opening the catalogue.
        CatalogueMissing: The DuckDB catalogue file does not exist.
        duckdb.Error: Any non-lock-classified duckdb error, propagated
            unchanged as a genuine bug.
    """
    if JOBS.is_running():
        raise RefreshInProgress("A dataset refresh is in progress. Try again shortly.")

    settings = get_settings()
    try:
        client = GridflowClient(settings.duckdb_path)
    except FileNotFoundError as exc:
        # str(exc) already carries the path GridflowClient actually resolved
        # to (its own message includes "Run 'gridflow init'"), which is more
        # accurate than settings.duckdb_path — that field is often None,
        # deferring to gridflow's own resolution (see settings.py).
        raise CatalogueMissing(str(exc)) from exc
    except duckdb.IOException as exc:
        if is_lock_error(str(exc)):
            raise RefreshInProgress(
                "A dataset refresh is in progress. Try again shortly."
            ) from exc
        raise

    try:
        yield client
    finally:
        client.close()
