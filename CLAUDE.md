# gridflow_explorer

## What this is

Local-first developer tool: a FastAPI backend wraps gridflow's
`GridflowClient` and serves catalogued GB electricity-market data to a
Vite React-TS app (live charts, gap-aware fetch). Single local DuckDB
catalogue; no auth, no hosting, no cloud. See `README.md` for
architecture and run commands.

## Session-start protocol

1. Read the vault-context block injected at session start (head of the
   vault's `00-active/now-gridflow-explorer.md`). Note the `-`/`_` quirk:
   this repo dir is `gridflow_explorer`, the vault slug is
   `gridflow-explorer`.
2. When working inside a milestone, read `.planning/STATE.md` and the
   active phase dir (if present — this repo runs lighter ceremony than
   gridflow/gridflow_models; tiers per the global CLAUDE.md rubric still
   apply).
3. Ecosystem map, cross-repo seams, and source-of-truth order live in
   gridflow's `CLAUDE.md` and the vault's `10-projects/README.md`.

## Hard rules

- **Reads gridflow's silver/gold via `GridflowClient` — never bypass it**
  with raw paths into the data root, and never write to gridflow's layers
  from here. The catalogue DuckDB file is this repo's only write surface.
- Timestamps tz-aware UTC end to end; settlement-period and gas-day
  semantics follow gridflow's rules — don't re-derive them here.
- No live API ingestion from this repo without explicit user confirmation
  (fetch-missing-days goes through gridflow's connectors and their rules).

## Process

- Never commit to `main`. Feature branches + PR only.
- Conventional commits: `feat:` `fix:` `test:` `refactor:` `chore:` `docs:`.
- The workflow layer (seat policy, tiers, W-9 review budgets, Sol
  cross-model review via `codex-delegate`, guard hooks) is global — it
  applies here exactly as in gridflow/gridflow_models. `.claude/` is
  local-only and gitignored; hooks run on system Python (this repo has no
  `.venv`).
