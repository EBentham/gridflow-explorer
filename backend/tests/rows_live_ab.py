"""Manually invoked live-verification script, not a pytest test file.

Never import this module for side effects. Client construction occurs only inside
explicitly invoked functions, and the live catalogue opens only under __main__.
"""

from __future__ import annotations

import hashlib
import json
import statistics
import subprocess
import sys
import time
import types
from pathlib import Path

CATALOGUE = "C:/gridflow-data/gridflow.duckdb"
ORIGINAL = "6b99feeb7bf71addcb7be24f7574182a56123dfa:backend/app/rows.py"


def _load(name: str, source: str) -> types.ModuleType:
    module = types.ModuleType(name)
    module.__file__ = name + ".py"
    sys.modules[name] = module
    exec(compile(source, module.__file__, "exec"), module.__dict__)
    return module


def _arms() -> dict[str, types.ModuleType]:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from app import rows

    original = subprocess.check_output(["git", "show", ORIGINAL], text=True)
    baseline_path = Path(__file__).with_name("rows_baseline.py")
    return {
        "O": _load("rows_original_live", original),
        "D": _load("rows_baseline_live", baseline_path.read_text()),
        "N": rows,
    }


def _run(module: types.ModuleType, start: str, end: str) -> tuple[float, str, int]:
    from gridflow.serving.client import GridflowClient

    module._cache.clear()
    request = module.validate("neso_data_portal", "historic_generation_mix", start, end, None, None)
    with GridflowClient(CATALOGUE) as client:
        client.query(
            "SET temp_directory=''; SET memory_limit='8GiB'; "
            "SELECT current_setting('temp_directory'), current_setting('memory_limit')"
        )
        before = time.monotonic()
        result = module.execute(client, request, CATALOGUE)
        elapsed = time.monotonic() - before
        encoded = json.dumps(result, sort_keys=False).encode("utf-8")
        return elapsed, hashlib.sha256(encoded).hexdigest(), len(encoded)


def main() -> int:
    """Run alternating long-mix O, D, N measurements under one resource policy."""
    arms = _arms()
    results: dict[str, list[float]] = {key: [] for key in arms}
    hashes: dict[str, set[tuple[str, int]]] = {key: set() for key in arms}
    for repeat in range(6):
        for key in ("O", "D", "N") if repeat % 2 == 0 else ("N", "D", "O"):
            elapsed, digest, size = _run(arms[key], "2009-01-01", "2026-09-26")
            hashes[key].add((digest, size))
            if repeat:
                results[key].append(elapsed)
            print(f"{repeat} {key} {elapsed:.3f}s {digest} {size}", flush=True)
    medians = {key: statistics.median(values) for key, values in results.items()}
    print(
        f"medians={medians} O/N={medians['O'] / medians['N']:.3f} "
        f"D/N={medians['D'] / medians['N']:.3f} hashes={hashes}",
        flush=True,
    )
    return 0 if len(hashes["D"]) == len(hashes["N"]) == 1 and hashes["D"] == hashes["N"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
