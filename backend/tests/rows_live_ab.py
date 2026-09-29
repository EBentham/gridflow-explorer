"""Manual read-only O/D/N rows comparison against the local catalogue."""

from __future__ import annotations

import ctypes
import hashlib
import json
import statistics
import subprocess
import sys
import threading
import time
import types
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

CATALOGUE = "C:/gridflow-data/gridflow.duckdb"
ORIGINAL = "6b99feeb7bf71addcb7be24f7574182a56123dfa:backend/app/rows.py"
CASES = (
    ("mix 7d", "neso_data_portal", "historic_generation_mix", "2026-09-20", "2026-09-26"),
    ("mix long", "neso_data_portal", "historic_generation_mix", "2009-01-01", "2026-09-26"),
    ("PN 1d", "elexon", "pn", "2026-09-22", "2026-09-22"),
    ("NDF 7d", "elexon", "ndf", "2026-09-17", "2026-09-23"),
    ("prices 7d", "entsoe", "day_ahead_prices", "2026-09-16", "2026-09-22"),
)


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


def _run_pair(
    module: types.ModuleType, case: tuple[str, ...], runs: int = 2
) -> list[tuple[float, bytes]]:
    from gridflow.serving.client import GridflowClient

    _, source, dataset, start, end = case
    module._cache.clear()
    request = module.validate(source, dataset, start, end, None, None)
    outcomes = []
    with GridflowClient(CATALOGUE) as client:
        settings = client.query(
            "SET temp_directory=''; SET memory_limit='8GiB'; "
            "SELECT current_setting('temp_directory') AS temp_directory, "
            "current_setting('memory_limit') AS memory_limit"
        ).to_dicts()[0]
        assert settings["temp_directory"] == ""
        for _ in range(runs):
            before = time.monotonic()
            result = module.execute(client, request, CATALOGUE)
            elapsed = time.monotonic() - before
            outcomes.append((elapsed, json.dumps(result, sort_keys=False).encode("utf-8")))
    return outcomes


def _first_difference(left: bytes, right: bytes) -> str:
    a, b = json.loads(left), json.loads(right)
    for key in a:
        if a[key] != b.get(key):
            if key == "rows":
                for index, (x, y) in enumerate(zip(a[key], b[key], strict=False)):
                    if x != y:
                        return f"rows[{index}]: {x!r} != {y!r}"
            return f"{key}: {a[key]!r} != {b.get(key)!r}"
    return "byte encoding differs"


class _MemoryCounters(ctypes.Structure):
    _fields_ = [("cb", ctypes.c_ulong), ("page_fault_count", ctypes.c_ulong)] + [
        (name, ctypes.c_size_t)
        for name in (
            "peak_working_set",
            "working_set",
            "quota_peak_paged_pool",
            "quota_paged_pool",
            "quota_peak_nonpaged_pool",
            "quota_nonpaged_pool",
            "pagefile_usage",
            "peak_pagefile_usage",
            "private_usage",
        )
    ]


def _working_set() -> int:
    counters = _MemoryCounters()
    counters.cb = ctypes.sizeof(counters)
    current_process = ctypes.windll.kernel32.GetCurrentProcess
    current_process.restype = ctypes.c_void_p
    get_memory = ctypes.windll.psapi.GetProcessMemoryInfo
    get_memory.argtypes = (
        ctypes.c_void_p,
        ctypes.POINTER(_MemoryCounters),
        ctypes.c_ulong,
    )
    get_memory.restype = ctypes.c_int
    if not get_memory(current_process(), ctypes.byref(counters), counters.cb):
        raise OSError("GetProcessMemoryInfo failed")
    return counters.working_set


def _concurrent(arm: types.ModuleType) -> tuple[float, int]:
    stop = threading.Event()
    peak = 0

    def watch() -> None:
        nonlocal peak
        while not stop.is_set():
            peak = max(peak, _working_set())
            stop.wait(0.01)

    monitor = threading.Thread(target=watch)
    monitor.start()
    before = time.monotonic()
    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [pool.submit(_run_pair, arm, CASES[1], 1) for _ in range(4)]
            for future in futures:
                future.result()
    finally:
        elapsed = time.monotonic() - before
        stop.set()
        monitor.join()
    return elapsed, peak


def main() -> int:
    """Measure five U1 requests, then four simultaneous long-mix requests."""
    arms = _arms()
    failed = False
    print("case | cache | O s | D s | N s | O/N | D/N | D/N bytes", flush=True)
    for case in CASES:
        samples = {key: [[], []] for key in arms}
        hashes = {key: [set(), set()] for key in arms}
        for repeat in range(6):
            outcomes = {}
            order = ("O", "D", "N") if repeat % 2 == 0 else ("N", "D", "O")
            for key in order:
                outcomes[key] = _run_pair(arms[key], case)
            for cache in range(2):
                d_bytes, n_bytes = outcomes["D"][cache][1], outcomes["N"][cache][1]
                if d_bytes != n_bytes:
                    failed = True
                    print(
                        f"MISMATCH {case[0]} {cache} repeat={repeat} "
                        f"D={hashlib.sha256(d_bytes).hexdigest()}:{len(d_bytes)} "
                        f"N={hashlib.sha256(n_bytes).hexdigest()}:{len(n_bytes)} "
                        f"{_first_difference(d_bytes, n_bytes)}",
                        flush=True,
                    )
                for key in arms:
                    elapsed, encoded = outcomes[key][cache]
                    hashes[key][cache].add((hashlib.sha256(encoded).hexdigest(), len(encoded)))
                    if repeat:
                        samples[key][cache].append(elapsed)
        for cache, label in enumerate(("cold", "warm")):
            med = {key: statistics.median(samples[key][cache]) for key in arms}
            stable = len(hashes["D"][cache]) == len(hashes["N"][cache]) == 1
            if not stable:
                failed = True
            print(
                f"{case[0]} | {label} | {med['O']:.3f} | {med['D']:.3f} | {med['N']:.3f} | "
                f"{med['O'] / med['N']:.2f} | {med['D'] / med['N']:.2f} | "
                f"{'equal stable' if stable else 'unstable'}; O hashes={len(hashes['O'][cache])}",
                flush=True,
            )
    elapsed, peak = _concurrent(arms["N"])
    print(f"four long mix: wall={elapsed:.3f}s peak_working_set={peak / 2**20:.1f} MiB", flush=True)
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
