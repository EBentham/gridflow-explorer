"""Direct unit tests for `app.deps.client_ctx` — no FastAPI, no TestClient.

`client_ctx()` is a plain `@contextmanager`, never a `Depends`, so it is
tested by calling it directly and driving the `with` protocol — exactly as
a route body does — rather than through `TestClient`/`dependency_overrides`.
"""

from __future__ import annotations

import duckdb
import pytest
from conftest import CountingFakeClient

from app import deps
from app.errors import CatalogueMissing, RefreshInProgress


def test_running_job_short_circuits_before_any_client_construction(
    monkeypatch: pytest.MonkeyPatch,
    counting_fake_client: type[CountingFakeClient],
    running_job: None,
) -> None:
    """Case 3: `JOBS.is_running()` must raise before any client is built."""
    monkeypatch.setattr(deps, "GridflowClient", counting_fake_client)

    with pytest.raises(RefreshInProgress), deps.client_ctx():
        pass

    assert counting_fake_client.count == 0


def test_file_not_found_maps_to_catalogue_missing(
    monkeypatch: pytest.MonkeyPatch,
    counting_fake_client: type[CountingFakeClient],
) -> None:
    """Case 8: a missing catalogue file maps to `CatalogueMissing`."""
    counting_fake_client.configure(
        raise_exc=FileNotFoundError("DuckDB catalogue not found at X. Run 'gridflow init'.")
    )
    monkeypatch.setattr(deps, "GridflowClient", counting_fake_client)

    with pytest.raises(CatalogueMissing), deps.client_ctx():
        pass


def test_lock_classified_ioexception_maps_to_refresh_in_progress(
    monkeypatch: pytest.MonkeyPatch,
    counting_fake_client: type[CountingFakeClient],
) -> None:
    """Case 4: a lock-classified `duckdb.IOException` maps to `RefreshInProgress`."""
    counting_fake_client.configure(
        raise_exc=duckdb.IOException("Could not set lock on file 'gridflow.duckdb'")
    )
    monkeypatch.setattr(deps, "GridflowClient", counting_fake_client)

    with pytest.raises(RefreshInProgress), deps.client_ctx():
        pass


def test_non_lock_duckdb_error_propagates_unchanged(
    monkeypatch: pytest.MonkeyPatch,
    counting_fake_client: type[CountingFakeClient],
) -> None:
    """Case 12: a non-lock duckdb error is a genuine bug and must propagate.

    Pins the guard against a future broad `except duckdb.Error` creeping
    back in and disguising real bugs as 503s.
    """
    counting_fake_client.configure(raise_exc=duckdb.CatalogException("relation not found"))
    monkeypatch.setattr(deps, "GridflowClient", counting_fake_client)

    with pytest.raises(duckdb.CatalogException), deps.client_ctx():
        pass


def test_close_called_on_normal_exit(
    monkeypatch: pytest.MonkeyPatch,
    counting_fake_client: type[CountingFakeClient],
) -> None:
    """The client is closed on normal `with` exit."""
    monkeypatch.setattr(deps, "GridflowClient", counting_fake_client)

    with deps.client_ctx():
        pass

    assert counting_fake_client.close_calls == 1


def test_close_called_when_body_raises(
    monkeypatch: pytest.MonkeyPatch,
    counting_fake_client: type[CountingFakeClient],
) -> None:
    """The client is also closed when the `with` body raises mid-query."""
    monkeypatch.setattr(deps, "GridflowClient", counting_fake_client)

    with pytest.raises(ValueError, match="boom"), deps.client_ctx():
        raise ValueError("boom")

    assert counting_fake_client.close_calls == 1
