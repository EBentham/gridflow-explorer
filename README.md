# gridflow-explorer

A React + TypeScript front-end over the gridflow analytics layer: a FastAPI
backend wraps `GridflowClient` and serves catalogued datasets (starting with
GB generation mix and system prices) to a Vite React-TS app that renders them
as live charts against `C:\gridflow-data\gridflow.duckdb`.

## Sibling checkout requirement

This repo expects a checkout of [`gridflow`](../gridflow) as a **sibling
directory** (`../gridflow` relative to this repo's root, i.e. `../../gridflow`
relative to `backend/`). The backend installs it as an editable local path
dependency — `gridflow` is intentionally **not** a declared PyPI dependency in
`backend/pyproject.toml`, since it isn't published there.

## Running the two dev processes

Backend (from `backend/`, venv never activated — invoke the interpreter
directly):

```sh
./.venv/Scripts/python.exe -m uvicorn app.main:app --reload
```

Note: uvicorn is run **single-worker** (no `--workers` flag) — `app/jobs.py`
holds process-local job state that a multi-worker setup would defeat.

Frontend (from `frontend/`):

```sh
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:8000`, so there is no
CORS configuration anywhere in this project.

Screenshots land in P3.
