# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, weighted equally (confirmed 2026-09-25):

- **The owner (Bobbo)** uses it as his working tool: inspecting catalogued GB
  electricity-market data and gridflow_models forecast runs, in sessions that
  can run for an hour or more beside a terminal and an editor.
- **Reviewers and recruiters** see it cold, through README screenshots, a
  screen-share demo, or by cloning and running it. Every screen has to survive
  a stranger's first look as well as a long working session.

## Product Purpose

A local-first explorer over gridflow's silver/gold layers. It charts GB
generation by fuel, system imbalance prices and day-ahead forecast runs, and it
fills catalogue gaps on demand. It is the interactive leg of the gridflow
portfolio triad (pipeline, docs site, explorer), and it makes the CV claim
"React + TypeScript front-end over the analytics layer" true. Working and
shipped beats feature-complete.

## Positioning

It reads a real, self-built GB power-market data platform end to end: FUELHH
generation, Elexon system prices and the owner's own quantile forecasts, with
their leakage-gate metrics and perfect-prog caveats. It is honest about gaps and
fills them from the actual connectors. It is not a vendor dashboard, and it does
not invent data.

## Operating Context

- Runs locally: FastAPI backend (`GridflowClient`, per-request read-only DuckDB)
  and a Vite React-TS frontend. No auth, no hosting.
- Time is settlement time: GB half-hourly settlement periods on Europe/London
  days (46/48/50 periods on clock-change days). Stored timestamps are UTC.
- Used on a large monitor in both daylight and evening scenes. Light and dark
  modes must both be first-class (confirmed 2026-09-25).

## Capabilities and Constraints

- Screens: Generation mix (stacked by fuel, single-fuel view), System prices
  (sell/buy), Forecasts (quantile fan + actual + metrics/gates per Variant, where
  a Variant = `(model_id, vintage_policy_id)`), plus the coverage-aware fetch banner.
- Stack locked: Vite + React + TS + Recharts + react-router, plain fetch hooks.
  No Tailwind or component kit unless the owner unlocks it.
- Wind forecast: no wind model exists in the store yet. Any wind view is a
  labelled fixture until the model lands.
- Never bypasses `GridflowClient`; the catalogue DuckDB is the only write surface.

## Evidence on Hand

- Real local catalogue data: FUELHH generation and system prices (June to
  mid-September 2026); demand forecast runs `day_ahead.lgbm_demand` v1/v2 with
  run-scope gate metrics.
- No wind forecast data, no user testimonials, no usage numbers. Don't
  fabricate any of these.

## Product Principles

1. The data is the loudest thing on screen. Chrome recedes.
2. Settlement time is native: UK clock and settlement periods, not raw ISO strings.
3. Honest states: gaps, unknown gates and caveats are shown plainly, never smoothed over.
4. Every axis carries a unit, and every colour carries an identity that's legible without colour alone.
5. It should hold up in a screenshot and in a two-hour session alike.

## Accessibility & Inclusion

WCAG AA text contrast in both modes. Series identity is never colour-only
(legend, direct labels, tooltip). Keyboard-reachable controls with visible focus.
