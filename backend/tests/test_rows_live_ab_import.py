"""The manual live runner must be safe to import during tests."""

from __future__ import annotations

import importlib
import subprocess
import sys

from gridflow.serving.client import GridflowClient


def test_rows_live_ab_import_does_not_open_client_or_run_subprocess(monkeypatch):
    def forbidden(*_args, **_kwargs):
        raise AssertionError("runner performed work during import")

    monkeypatch.setattr(GridflowClient, "__init__", forbidden)
    monkeypatch.setattr(subprocess, "check_output", forbidden)
    monkeypatch.delitem(sys.modules, "rows_live_ab", raising=False)
    assert importlib.import_module("rows_live_ab").CASES
