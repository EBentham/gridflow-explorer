"""HTTP regressions for rows worker concurrency and validation order."""

from __future__ import annotations

import asyncio
import threading
from contextlib import contextmanager

import httpx
import pytest
from conftest import CountingFakeClient

from app import deps, rows, sources
from app.main import app

ROWS_URL = "/api/sources/elexon/freq/rows"


class _BlockedRows:
    def __init__(self, monkeypatch: pytest.MonkeyPatch) -> None:
        self.release = threading.Event()
        self.lock = threading.Lock()
        self.active = 0
        self.peak = 0

        @contextmanager
        def client_ctx():
            yield object()

        def execute(_client, _parsed, _config):
            with self.lock:
                self.active += 1
                self.peak = max(self.peak, self.active)
            try:
                assert self.release.wait(5), "rows worker was not released"
                return {"ok": True}
            finally:
                with self.lock:
                    self.active -= 1

        monkeypatch.setattr(sources, "client_ctx", client_ctx)
        monkeypatch.setattr(rows, "execute", execute)
        monkeypatch.setattr(rows, "cached_status", lambda _parsed, _config: None)

    async def wait_for_active(self, minimum: int) -> None:
        """Wait briefly for the requested number of workers to enter execute."""
        deadline = asyncio.get_running_loop().time() + 3
        while True:
            with self.lock:
                if self.active >= minimum:
                    return
            assert asyncio.get_running_loop().time() < deadline, "rows workers did not start"
            await asyncio.sleep(0.01)


def test_rows_requests_use_at_most_four_workers(monkeypatch: pytest.MonkeyPatch) -> None:
    """Six simultaneous rows requests may enter DuckDB only four at a time."""
    blocked = _BlockedRows(monkeypatch)

    async def run() -> None:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            requests = [asyncio.create_task(client.get(ROWS_URL)) for _ in range(6)]
            try:
                await blocked.wait_for_active(4)
                await asyncio.sleep(0.1)
                with blocked.lock:
                    assert blocked.active == 4
                    assert blocked.peak <= 4
            finally:
                blocked.release.set()
                responses = await asyncio.wait_for(asyncio.gather(*requests), timeout=5)
            assert [response.status_code for response in responses] == [200] * 6

    asyncio.run(run())


def test_health_answers_while_rows_workers_are_blocked(monkeypatch: pytest.MonkeyPatch) -> None:
    """The health route answers promptly during a saturated rows workload."""
    blocked = _BlockedRows(monkeypatch)

    async def run() -> None:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            requests = [asyncio.create_task(client.get(ROWS_URL)) for _ in range(40)]
            try:
                await blocked.wait_for_active(4)
                response = await asyncio.wait_for(client.get("/api/health"), timeout=1)
                assert response.status_code == 200
                assert response.json() == {"status": "ok"}
            finally:
                blocked.release.set()
                responses = await asyncio.wait_for(asyncio.gather(*requests), timeout=5)
            assert all(response.status_code == 200 for response in responses)

    asyncio.run(run())


def test_bad_filter_never_constructs_client(
    monkeypatch: pytest.MonkeyPatch, counting_fake_client: type[CountingFakeClient]
) -> None:
    """Invalid filter literals return 422 before acquiring a client."""
    monkeypatch.setattr(deps, "GridflowClient", counting_fake_client)
    monkeypatch.setattr(sources, "client_ctx", deps.client_ctx)

    async def run() -> None:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get(
                ROWS_URL.replace("/freq/", "/mid/"), params={"filter": "data_provider_id:'; drop"}
            )
        assert response.status_code == 422
        assert response.json()["error"]["code"] == "bad_filter"

    asyncio.run(run())
    assert counting_fake_client.count == 0
