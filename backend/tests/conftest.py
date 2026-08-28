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
      `GridflowClient`. Reused (generic — any client with `.close()`) by
      the P4 forecasts tests below via `ForecastStubClient`.
    - `forecast_rows_frame` / `forecast_metrics_rows_frame` /
      `ForecastStubClient`: `test_forecasts.py` and `test_forecasts_api.py`
      (via the `forecast_stub_client` / `forecast_stub_client_ctx` and
      `empty_forecast_stub_client*` fixtures).
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
        - `NUCLEAR` at period 1 is repeated as an exact duplicate row
          (same settlement_date/settlement_period/fuel_type/generation_mw),
          matching the real backfill-chunk-boundary shape of
          `silver_elexon_fuelhh`, to prove `load_generation_mix` drops it
          rather than double-counting it in the summed value.
    """
    rows: list[tuple[datetime, int, str, float]] = [
        (_london(2026, 8, 10, 0, 0), 1, "NUCLEAR", 4000.0),
        (_london(2026, 8, 10, 0, 0), 1, "NUCLEAR", 4000.0),  # exact chunk-boundary duplicate
        (_london(2026, 8, 10, 0, 0), 1, "WIND", 2000.0),
        (_london(2026, 8, 10, 0, 0), 1, "INTFR", 500.0),
        (_london(2026, 8, 10, 0, 0), 1, "INTNED", 300.0),
        (_london(2026, 8, 10, 0, 0), 1, "INTIFA2", 200.0),
        (_london(2026, 8, 10, 0, 0), 1, "ZZUNKNOWN", 50.0),
        (_london(2026, 8, 10, 0, 30), 2, "NUCLEAR", 4100.0),
    ]
    return pl.DataFrame(
        {
            "timestamp_utc": [r[0] for r in rows],
            "settlement_date": [r[0].date() for r in rows],
            "settlement_period": [r[1] for r in rows],
            "fuel_type": [r[2] for r in rows],
            "generation_mw": [r[3] for r in rows],
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


# --- P4 forecasts fixtures --------------------------------------------------


def forecast_rows_frame() -> pl.DataFrame:
    """Fixture long-format `gold_forecasts` frame, tz-aware Europe/London.

    Exercises every rule `app.forecasts` implements:
        - Supersession (ADR-057 section 6): the first two rows share one
          supersession identity (model_id, vintage_kind, vintage_policy_id,
          issued_at, delivery_time) at period 1 on 2026-08-10 — an older
          write (`run-old`, `written_at` 01:00, `q_0.5=100.0`) and a newer
          write (`run-new`, `written_at` 02:00, `q_0.5=200.0`). Only the
          newer row's values must survive.
        - UTC relabelling: every timestamp is in August (BST, UTC+1) — a
          missing `convert_time_zone("UTC")` would ship
          `2026-08-10T00:00:00Z` for period 1 instead of the correct
          `2026-08-09T23:00:00Z`.
        - Multi-Variant handling: `day_ahead.lgbm_demand.v2` on the same
          day needs no special-casing to appear alongside v1.
        - 2026-08-11 carries no rows at all, for the empty-day case.
    """
    rows: list[dict[str, object]] = [
        {
            "model_id": "day_ahead.lgbm_demand.v1",
            "vintage_kind": "issued",
            "vintage_policy_id": "v1_rolling_23h30m",
            "issued_at": _london(2026, 8, 9, 23, 30),
            "delivery_time": _london(2026, 8, 10, 0, 0),
            "settlement_date": date(2026, 8, 10),
            "settlement_period": 1,
            "actual": 21000.0,
            "run_id": "run-old",
            "written_at": _london(2026, 8, 10, 1, 0),
            "gates_passed": True,
            "q_0.05": 19000.0,
            "q_0.5": 100.0,
            "q_0.95": 21500.0,
        },
        {
            "model_id": "day_ahead.lgbm_demand.v1",
            "vintage_kind": "issued",
            "vintage_policy_id": "v1_rolling_23h30m",
            "issued_at": _london(2026, 8, 9, 23, 30),
            "delivery_time": _london(2026, 8, 10, 0, 0),
            "settlement_date": date(2026, 8, 10),
            "settlement_period": 1,
            "actual": 21000.0,
            "run_id": "run-new",
            "written_at": _london(2026, 8, 10, 2, 0),
            "gates_passed": True,
            "q_0.05": 19500.0,
            "q_0.5": 200.0,
            "q_0.95": 21600.0,
        },
        {
            "model_id": "day_ahead.lgbm_demand.v1",
            "vintage_kind": "issued",
            "vintage_policy_id": "v1_rolling_23h30m",
            "issued_at": _london(2026, 8, 9, 23, 30),
            "delivery_time": _london(2026, 8, 10, 0, 30),
            "settlement_date": date(2026, 8, 10),
            "settlement_period": 2,
            "actual": 21100.0,
            "run_id": "run-new",
            "written_at": _london(2026, 8, 10, 2, 0),
            "gates_passed": True,
            "q_0.05": 19600.0,
            "q_0.5": 210.0,
            "q_0.95": 21700.0,
        },
        {
            "model_id": "day_ahead.lgbm_demand.v2",
            "vintage_kind": "issued",
            "vintage_policy_id": "v2_rolling_23h30m",
            "issued_at": _london(2026, 8, 9, 23, 30),
            "delivery_time": _london(2026, 8, 10, 0, 0),
            "settlement_date": date(2026, 8, 10),
            "settlement_period": 1,
            "actual": 21050.0,
            "run_id": "run-v2",
            "written_at": _london(2026, 8, 10, 3, 0),
            "gates_passed": True,
            "q_0.05": 19700.0,
            "q_0.5": 220.0,
            "q_0.95": 21800.0,
        },
    ]
    columns = list(rows[0].keys())
    return pl.DataFrame({col: [row[col] for row in rows] for col in columns})


def forecast_metrics_rows_frame() -> pl.DataFrame:
    """Fixture `gold_forecast_metrics` frame, tz-aware Europe/London.

    Exercises "newest run per Variant" (v1's newest write is `run-new` at
    02:00, so its `run-old` fold-scope row at 01:00 must not appear in
    `variant_metrics`'s output) and the `scope == "run"` filter (the real
    store carries no `scope='overall'` rows — see `app.forecasts`'s
    DEVIATION note).
    """
    rows: list[dict[str, object]] = [
        {
            "model_id": "day_ahead.lgbm_demand.v1",
            "run_id": "run-old",
            "written_at": _london(2026, 8, 10, 1, 0),
            "vintage_kind": "issued",
            "vintage_policy_id": "v1_rolling_23h30m",
            "scope": "fold",
            "metric_kind": "score",
            "metric_name": "pinball_loss",
            "metric_value": 12.3,
            "gate_passed": None,
            "gate_threshold": None,
            "gate_message": None,
            "train_size": 300,
            "valid_size": 40,
            "n_folds": 10,
            "gates_passed": True,
            "perfect_prog_caveat": False,
        },
        {
            "model_id": "day_ahead.lgbm_demand.v1",
            "run_id": "run-new",
            "written_at": _london(2026, 8, 10, 2, 0),
            "vintage_kind": "issued",
            "vintage_policy_id": "v1_rolling_23h30m",
            "scope": "run",
            "metric_kind": "gate",
            "metric_name": "pinball_loss_overall",
            "metric_value": 11.1,
            "gate_passed": True,
            "gate_threshold": 15.0,
            "gate_message": "pass",
            "train_size": 320,
            "valid_size": 42,
            "n_folds": 12,
            "gates_passed": True,
            "perfect_prog_caveat": False,
        },
        {
            "model_id": "day_ahead.lgbm_demand.v2",
            "run_id": "run-v2",
            "written_at": _london(2026, 8, 10, 3, 0),
            "vintage_kind": "issued",
            "vintage_policy_id": "v2_rolling_23h30m",
            "scope": "run",
            "metric_kind": "gate",
            "metric_name": "pinball_loss_overall",
            "metric_value": 9.5,
            "gate_passed": True,
            "gate_threshold": 15.0,
            "gate_message": "pass",
            "train_size": 320,
            "valid_size": 42,
            "n_folds": 12,
            "gates_passed": True,
            "perfect_prog_caveat": True,
        },
    ]
    columns = list(rows[0].keys())
    return pl.DataFrame({col: [row[col] for row in rows] for col in columns})


def empty_forecasts_frame() -> pl.DataFrame:
    """Zero-row `gold_forecasts` frame, correctly typed (empty-store case)."""
    return pl.DataFrame(
        schema={
            "model_id": pl.String,
            "vintage_kind": pl.String,
            "vintage_policy_id": pl.String,
            "issued_at": pl.Datetime(time_unit="us", time_zone="Europe/London"),
            "delivery_time": pl.Datetime(time_unit="us", time_zone="Europe/London"),
            "settlement_date": pl.Date,
            "settlement_period": pl.Int16,
            "actual": pl.Float64,
            "run_id": pl.String,
            "written_at": pl.Datetime(time_unit="us", time_zone="Europe/London"),
            "gates_passed": pl.Boolean,
            "q_0.05": pl.Float64,
            "q_0.5": pl.Float64,
            "q_0.95": pl.Float64,
        }
    )


def empty_metrics_frame() -> pl.DataFrame:
    """Zero-row `gold_forecast_metrics` frame, correctly typed (empty-store case)."""
    return pl.DataFrame(
        schema={
            "model_id": pl.String,
            "run_id": pl.String,
            "written_at": pl.Datetime(time_unit="us", time_zone="Europe/London"),
            "vintage_kind": pl.String,
            "vintage_policy_id": pl.String,
            "scope": pl.String,
            "metric_kind": pl.String,
            "metric_name": pl.String,
            "metric_value": pl.Float64,
            "gate_passed": pl.Boolean,
            "gate_threshold": pl.Float64,
            "gate_message": pl.String,
            "train_size": pl.Int32,
            "valid_size": pl.Int32,
            "n_folds": pl.Int32,
            "gates_passed": pl.Boolean,
            "perfect_prog_caveat": pl.Boolean,
        }
    )


class ForecastStubClient:
    """Stand-in for `GridflowClient` in the P4 forecasts tests.

    `app.forecasts` issues exactly two constant, predicate-free SQL
    strings (see its module docstring's DEVIATION note on why there is no
    bind parameter to stub) — this dispatches on which relation the SQL
    names, so callers never need to parse or care about the query text.
    """

    def __init__(
        self,
        forecasts: pl.DataFrame | None = None,
        metrics: pl.DataFrame | None = None,
    ) -> None:
        self.forecasts = forecasts if forecasts is not None else forecast_rows_frame()
        self.metrics = metrics if metrics is not None else forecast_metrics_rows_frame()
        self.calls: list[str] = []

    def query(self, sql: str) -> pl.DataFrame:
        """Record the call and return the fixture frame the SQL names."""
        self.calls.append(sql)
        if "gold_forecast_metrics" in sql:
            return self.metrics
        if "gold_forecasts" in sql:
            return self.forecasts
        raise AssertionError(f"ForecastStubClient.query got unexpected SQL: {sql!r}")

    def close(self) -> None:
        """No-op, present only for interface parity with `GridflowClient`."""


@pytest.fixture
def forecast_stub_client() -> ForecastStubClient:
    """A fresh `ForecastStubClient` with default fixture frames."""
    return ForecastStubClient()


@pytest.fixture
def forecast_stub_client_ctx(forecast_stub_client: ForecastStubClient) -> StubClientCtx:
    """A `StubClientCtx` wrapping `forecast_stub_client`, ready to monkeypatch in."""
    return StubClientCtx(forecast_stub_client)


@pytest.fixture
def empty_forecast_stub_client() -> ForecastStubClient:
    """A `ForecastStubClient` over an empty store (both views zero rows)."""
    return ForecastStubClient(forecasts=empty_forecasts_frame(), metrics=empty_metrics_frame())


@pytest.fixture
def empty_forecast_stub_client_ctx(empty_forecast_stub_client: ForecastStubClient) -> StubClientCtx:
    """A `StubClientCtx` wrapping `empty_forecast_stub_client`, ready to monkeypatch in."""
    return StubClientCtx(empty_forecast_stub_client)
