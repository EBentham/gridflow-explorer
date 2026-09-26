import type { ForecastDayRecord } from '../../api/types'
import { toMs } from '../../design/time'

export interface FanRow {
  t: number
  /** Settlement period, as the forecast store supplies it. */
  sp: number
  actual: number | null
  q05: number
  q10: number
  q25: number
  q50: number
  q75: number
  q90: number
  q95: number
  b90: [number, number]
  b80: [number, number]
  b50: [number, number]
}

/** Forecast-store rows as fan rows, in time order, scaled for display (e.g. `1 / 1000` for MW to GW). */
export function toFanRows(records: ForecastDayRecord[], scale = 1): FanRow[] {
  const s = (v: number) => v * scale
  return records
    .map((r) => ({
      t: toMs(r.delivery_time),
      sp: r.settlement_period,
      actual: r.actual === null ? null : s(r.actual),
      q05: s(r['q_0.05']),
      q10: s(r['q_0.1']),
      q25: s(r['q_0.25']),
      q50: s(r['q_0.5']),
      q75: s(r['q_0.75']),
      q90: s(r['q_0.9']),
      q95: s(r['q_0.95']),
      b90: [s(r['q_0.05']), s(r['q_0.95'])] as [number, number],
      b80: [s(r['q_0.1']), s(r['q_0.9'])] as [number, number],
      b50: [s(r['q_0.25']), s(r['q_0.75'])] as [number, number],
    }))
    .sort((a, b) => a.t - b.t)
}
