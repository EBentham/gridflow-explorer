"""Shared test fixtures for the backend unit and route test suites.

Split by consumer:
    - `generation_mix_frame` / `system_prices_frame` / `StubClient`:
      `test_transforms.py` and `test_api.py` (via the `stub_client` /
      `stub_client_ctx` fixtures).
    - `CountingFakeClient`: `test_deps.py`, monkeypatched in for
      `app.deps.GridflowClient` — proves *whether a client was constructed
      at all*, which the `JOBS.is_running()` short-circuit (case 3) needs.
    - `StubClientCtx`: `test_api.py`, monkeypatched in for
      `app.routers.datasets.client_ctx` so route tests never touch a real
      `GridflowClient`.
"""

from __future__ import annotations

from collections.abc import Generator
from contextlib import contextmanager
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

import polars as pl
import pytest

LONDON = ZoneInfo("Europe/London")


def _london(year: int, month: int, day: int, hour: int, minute: int = 0) -> datetime:
    """Build a tz-aware Europe/London datetime from naive components."""
    return datetime(year, month, day, hour, minute, tzinfo=LONDON)


def generation_mix_frame() -> pl.DataFrame:
    """Fixture long-format `generation-mix` frame, tz-aware Europe/London.

    Deliberately exercises every transform rule in one small frame:
        - All timestamps are August (British Summer Time, UTC+1), so a
          missing `convert_time_zone("UTC")` would ship the visibly wrong
          hour (23:00 previous day instead of 00:00).
        - Three `INT*` codes at the same timestamp, to prove collapsing
          into a single `imports` value equal to their sum.
        - One unrecognised code (`ZZUNKNOWN`), to prove it lands in
          `other` rather than being dropped.
        - `OIL` never appears, to prove the backfill zero-fill path.
    """
    rows: list[tuple[datetime, str, float]] = [
        (_london(2026, 8, 10, 0, 0), "NUCLEAR", 4000.0),
        (_london(2026, 8, 10, 0, 0), "WIND", 2000.0),
        (_london(2026, 8, 10, 0, 0), "INTFR", 500.0),
        (_london(2026, 8, 10, 0, 0), "INTNED", 300.0),
        (_london(2026, 8, 10, 0, 0), "INTIFA2", 200.0),
        (_london(2026, 8, 10, 0, 0), "ZZUNKNOWN", 50.0),
        (_london(2026, 8, 10, 0, 30), "NUCLEAR", 4100.0),
    ]
    return pl.DataFrame(
        {
            "timestamp_utc": [r[0] for r in rows],
            "fuel_type": [r[1] for r in rows],
            "generation_mw": [r[2] for r in rows],
        }
    )


def system_prices_frame() -> pl.DataFrame:
    """Fixture wide `system-prices` frame, tz-aware Europe/London."""
    return pl.DataFrame(
        {
            "timestamp_utc": [_london(2026, 8, 10, 0, 0), _london(2026, 8, 10, 0, 30)],
            "system_sell_price": [45.2, 47.8],
            "system_buy_price": [44.9, 46.5],
            "net_imbalance_volume": [120.5, -80.3],
        }
    )


class StubClient:
    """Stand-in for `GridflowClient` returning fixed Polars frames.

    Records the `(method, start, end)` each call was made with in
    `self.calls`, so callers (notably `test_api.py`) can assert the
    default 7-day window was actually *requested*, not merely inferred
    from the shape of the returned rows.
    """

    def __init__(
        self,
        generation_mix: pl.DataFrame | None = None,
        system_prices: pl.DataFrame | None = None,
    ) -> None:
        self.generation_mix = (
            generation_mix if generation_mix is not None else generation_mix_frame()
        )
        self.system_prices = system_prices if system_prices is not None else system_prices_frame()
        self.calls: list[tuple[str, date, date]] = []

    def get_fuel_generation(self, start: date, end: date) -> pl.DataFrame:
        """Record the call and return the fixture generation-mix frame."""
        self.calls.append(("get_fuel_generation", start, end))
        return self.generation_mix

    def get_system_prices(self, start: date, end: date) -> pl.DataFrame:
        """Record the call and return the fixture system-prices frame."""
        self.calls.append(("get_system_prices", start, end))
        return self.system_prices

    def close(self) -> None:
        """No-op, present only for interface parity with `GridflowClient`."""


class CountingFakeClient:
    """Fake `GridflowClient` for `test_deps.py`, monkeypatched by class.

    Class-level (not instance-level) counters, because `test_deps.py`
    monkeypatches this class itself into `app.deps.GridflowClient` and
    then asserts on construction/close counts from outside any instance —
    that is what proves "no client was constructed" (case 3) rather than
    merely asserting on the exception raised.
    """

    count: int = 0
    close_calls: int = 0
    raise_exc: BaseException | None = None

    @classmethod
    def configure(cls, *, raise_exc: BaseException | None = None) -> None:
        """Reset counters and optionally arm a raise-on-construction."""
        cls.count = 0
        cls.close_calls = 0
        cls.raise_exc = raise_exc

    def __init__(self, db_path: Any = None) -> None:
        type(self).count += 1
        if type(self).raise_exc is not None:
            raise type(self).raise_exc
        self.db_path = db_path

    def close(self) -> None:
        """Record that `close()` was called on this fake."""
        type(self).close_calls += 1


class StubClientCtx:
    """Stub replacing `client_ctx` in `test_api.py`.

    Callable like `client_ctx` — `stub()` returns a context manager
    yielding a `StubClient` — and records whether it was entered, so
    tests can assert the guard was (or was not) reached.
    """

    def __init__(self, client: StubClient) -> None:
        self.client = client
        self.entered = False

    @contextmanager
    def __call__(self) -> Generator[StubClient, None, None]:
        self.entered = True
        yield self.client


@pytest.fixture
def stub_client() -> StubClient:
    """A fresh `StubClient` with default fixture frames."""
    return StubClient()


@pytest.fixture
def stub_client_ctx(stub_client: StubClient) -> StubClientCtx:
    """A `StubClientCtx` wrapping `stub_client`, ready to monkeypatch in."""
    return StubClientCtx(stub_client)


@pytest.fixture
def counting_fake_client() -> Generator[type[CountingFakeClient], None, None]:
    """`CountingFakeClient`, reset before and after the test."""
    CountingFakeClient.configure()
    yield CountingFakeClient
    CountingFakeClient.configure()


@pytest.fixture
def running_job() -> Generator[None, None, None]:
    """Force `JOBS` into a `RUNNING` state for guard tests, then restore it.

    Uses `JobManager`'s public `try_start`/`finish` API rather than
    reaching into private state, so the fixture exercises the same start
    path a real caller would.
    """
    from app.jobs import JOBS, JobState

    job = JOBS.try_start("generation-mix", target=lambda _job: None)
    assert job is not None, "a previous test left JOBS RUNNING"
    try:
        yield
    finally:
        JOBS.finish(job.job_id, JobState.IDLE, None)
