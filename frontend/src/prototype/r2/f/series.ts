import { createContext, useContext } from 'react'
import type { ForecastDayRecord } from '../../../api/types'
import type { PriceRow } from '../../../design/charts'
import { totalGeneration, type MixRow } from '../../../design/fuels'
import { HALF_HOUR, clock, dayTick, toMs } from '../../../design/time'
import type { DateRange } from '../../../lib/range'

/** One horizon point: the mean of the half-hours in [t0, t1). */
export interface HPoint {
  t0: number
  t1: number
  v: number
}

export interface HSeries {
  pts: HPoint[]
  /** Half-hours averaged into each point. */
  bin: number
  domain: [number, number]
  max: HPoint
  min: HPoint
}

/**
 * Folds a half-hourly series into at most `maxPts` block means, so a month
 * still reads as a calm skyline. Blocks follow row order; the caller's rows
 * are already one per half-hour.
 */
export function binSeries(raw: { t: number; v: number | null }[], maxPts = 168, endPad = 0): HSeries | null {
  if (!raw.length) return null
  const bin = Math.max(1, Math.ceil(raw.length / maxPts))
  const pts: HPoint[] = []
  for (let i = 0; i < raw.length; i += bin) {
    const chunk = raw.slice(i, i + bin)
    const vals = chunk.map((c) => c.v).filter((v): v is number => v !== null && Number.isFinite(v))
    if (!vals.length) continue
    pts.push({ t0: chunk[0].t, t1: chunk[chunk.length - 1].t + HALF_HOUR, v: vals.reduce((a, b) => a + b, 0) / vals.length })
  }
  if (!pts.length) return null
  let max = pts[0]
  let min = pts[0]
  for (const p of pts) {
    if (p.v > max.v) max = p
    if (p.v < min.v) min = p
  }
  // The domain matches the chart below it, so the horizon sits over the same clock.
  return { pts, bin, domain: [raw[0].t, raw[raw.length - 1].t + endPad], max, min }
}

export const windShareSeries = (rows: MixRow[]) =>
  binSeries(
    rows.map((r) => {
      const total = totalGeneration(r)
      return { t: r.t, v: total > 0 ? (Math.max(r.wind, 0) / total) * 100 : null }
    }),
  )

export const priceSeries = (rows: PriceRow[]) => binSeries(rows.map((r) => ({ t: r.t, v: r.price })))

export const fixtureSeries = (records: ForecastDayRecord[]) =>
  binSeries(
    records.map((r) => ({ t: toMs(r.delivery_time), v: r['q_0.5'] })),
    168,
    HALF_HOUR,
  )

// ---------------------------------------------------------------- wording

const DAY = 86400e3
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `8 to 14 Sep 2026`, `28 Aug to 3 Sep 2026`, or `14 Sep 2026`. */
export function windowText(range: DateRange): string {
  const a = new Date(`${range.start}T12:00:00Z`)
  const b = new Date(`${range.end}T12:00:00Z`)
  const day = (d: Date) => d.getUTCDate()
  const mon = (d: Date) => MONTHS[d.getUTCMonth()]
  const yr = (d: Date) => d.getUTCFullYear()
  if (range.start === range.end) return `${day(b)} ${mon(b)} ${yr(b)}`
  if (yr(a) !== yr(b)) return `${day(a)} ${mon(a)} ${yr(a)} to ${day(b)} ${mon(b)} ${yr(b)}`
  if (mon(a) !== mon(b)) return `${day(a)} ${mon(a)} to ${day(b)} ${mon(b)} ${yr(b)}`
  return `${day(a)} to ${day(b)} ${mon(b)} ${yr(b)}`
}

/** A compact instant for labels: `14:30` inside one day, `Tue 8, 14:30` across days. */
export function when(t: number, domain: [number, number]): string {
  return domain[1] - domain[0] <= DAY + HALF_HOUR ? clock(t) : `${dayTick(t)}, ${clock(t)}`
}

/** "each point averages N half-hours" wording, or nothing for raw points. */
export function binWords(bin: number): string {
  if (bin <= 1) return 'one point per half-hour'
  const hours = bin / 2
  const h = Number.isInteger(hours) ? `${hours}` : `${Math.floor(hours)}½`
  return `each point averages ${bin} half-hours (${h} ${hours === 1 ? 'hour' : 'hours'})`
}

// ---------------------------------------------------------------- shared rows

export interface Loaded<T> {
  rows: T[]
  loading: boolean
  error: Error | null
}

/** The shell loads each dataset once; the horizon and the screens read the same rows. */
export interface FData {
  mix: Loaded<MixRow>
  prices: Loaded<PriceRow>
}

export const FDataContext = createContext<FData | null>(null)

export function useFData(): FData {
  const v = useContext(FDataContext)
  if (!v) throw new Error('useFData outside the slot f shell')
  return v
}
