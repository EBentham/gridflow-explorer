import type { ForecastDayRecord, ForecastMetric, ForecastVariant } from '../api/types'

/**
 * FIXTURE -- synthetic wind forecast. No wind model exists in the forecast
 * store yet (only `day_ahead.lgbm_demand` v1/v2). Every number below is
 * generated here, deterministically, in the exact shape of
 * `/api/forecasts/day` + `/api/forecasts/metrics` rows, so the wind view can
 * be designed before the model lands. Every screen that draws it carries the
 * dashed-ochre Fixture tag. Replace it with the real endpoint when a wind
 * model writes to the forecast store (the v0.3 forecast-screen stub).
 */

export const WIND_FIXTURE_MODEL = 'fixture.wind_day_ahead.v0'
export const WIND_FIXTURE_POLICY = 'fixture_day_anchored_noon_d1'
export const WIND_FIXTURE_DATE = '2026-09-15'

// London day 2026-09-15 (BST) starts 2026-09-14T23:00Z; 48 settlement periods.
const DAY_START = Date.UTC(2026, 8, 14, 23, 0)

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function build(): ForecastDayRecord[] {
  const rand = mulberry32(15092026)
  const rows: ForecastDayRecord[] = []
  for (let sp = 1; sp <= 48; sp++) {
    const x = (sp - 1) / 47
    // A front arrives mid-afternoon: wind ramps from ~7 GW to ~15 GW, eases overnight.
    const median = 7200 + 7600 / (1 + Math.exp(-(x - 0.52) * 11)) - 1400 * Math.max(0, x - 0.82) * 5
    const spread = 700 + 2600 * Math.exp(-((x - 0.55) ** 2) / 0.02) + 900 * x
    const noise = (rand() - 0.5) * 900
    const lagged = 7200 + 7600 / (1 + Math.exp(-(x - 0.58) * 9)) - 1400 * Math.max(0, x - 0.82) * 5
    const actual = sp <= 40 ? Math.round(lagged + noise) : null
    const q = (z: number) => median + z * spread
    rows.push({
      model_id: WIND_FIXTURE_MODEL,
      vintage_policy_id: WIND_FIXTURE_POLICY,
      delivery_time: new Date(DAY_START + (sp - 1) * 30 * 60 * 1000).toISOString().replace('.000Z', 'Z'),
      settlement_period: sp,
      actual,
      'q_0.05': q(-1.645),
      'q_0.1': q(-1.2816),
      'q_0.25': q(-0.6745),
      'q_0.5': median,
      'q_0.75': q(0.6745),
      'q_0.9': q(1.2816),
      'q_0.95': q(1.645),
    })
  }
  return rows
}

export const WIND_FIXTURE_DAY: ForecastDayRecord[] = build()

const metric = (metric_name: string, metric_value: number, gate_passed: boolean | null, gate_threshold: number | null): ForecastMetric => ({
  model_id: WIND_FIXTURE_MODEL,
  vintage_policy_id: WIND_FIXTURE_POLICY,
  run_id: 'fixture',
  metric_kind: 'gate',
  scope: 'run',
  metric_name,
  metric_value,
  gate_passed,
  gate_threshold,
  gate_message: null,
  train_size: null,
  valid_size: null,
  n_folds: 5,
  gates_passed: true,
  perfect_prog_caveat: false,
})

export const WIND_FIXTURE_METRICS: ForecastMetric[] = [
  metric('coverage_nominal90', 0.884, true, 0.85),
  metric('monotonicity', 0, true, 0),
  metric('pinball_q0.5', 812.4, true, 1500),
]

export const WIND_FIXTURE_VARIANT: ForecastVariant = {
  model_id: WIND_FIXTURE_MODEL,
  title: 'Wind, day-ahead (fixture)',
  vintage_kind: 'issued',
  vintage_policy_id: WIND_FIXTURE_POLICY,
  perfect_prog_caveat: false,
  run_id: 'fixture',
  written_at: '2026-09-14T11:00:00Z',
  gates_passed: true,
  first_settlement_date: WIND_FIXTURE_DATE,
  last_settlement_date: WIND_FIXTURE_DATE,
  n_days: 1,
}
