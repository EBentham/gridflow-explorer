/**
 * A forecast against what happened (an outturn, an actual): the two series
 * joined on time, the error (actual less forecast) and its figures, overall
 * and per UK day. The models hold display units (GW); errors are in MW, so a
 * miss of a few hundred MW doesn't read as 0.3 GW. Nothing is filled in: a
 * step either side lacks has no error, never a zero.
 */
import { datesBetween, dayStart, londonMidnight } from '../../design/time'
import type { DateRange } from '../../lib/range'
import type { SeriesDef, SeriesModel, WideRow } from './seriesModel'
import { MW } from './units'

/** Errors print in MW. */
export const ERROR_UNIT = MW

/** A signed MW figure: `+431`, with a true minus below zero. */
export const signedMw = (v: number) => `${Math.round(v) > 0 ? '+' : ''}${ERROR_UNIT.plain(v)}`

export interface ErrorStats {
  /** Steps both sides hold. */
  count: number
  /** Actual less forecast, MW. */
  sum: number
  sumAbs: number
  /** The actual summed over the same steps, MW. */
  sumActual: number
  /** The steps where the actual ran furthest above and furthest below the forecast. */
  above: { t: number; v: number } | null
  below: { t: number; v: number } | null
}

export interface ForecastJoin {
  /** One row per time either side holds: `f` and `a` in display units, `e` (actual less forecast) in MW; null where either is missing. */
  rows: WideRow[]
  stats: ErrorStats
}

export const emptyStats = (): ErrorStats => ({ count: 0, sum: 0, sumAbs: 0, sumActual: 0, above: null, below: null })

function addTo(s: ErrorStats, t: number, e: number, actualMw: number) {
  s.count += 1
  s.sum += e
  s.sumAbs += Math.abs(e)
  s.sumActual += actualMw
  if (e > 0 && (!s.above || e > s.above.v)) s.above = { t, v: e }
  if (e < 0 && (!s.below || e < s.below.v)) s.below = { t, v: e }
}

/** A forecast and its actual joined on time; both back to MW through the actual's unit. */
export function joinForecast(forecast: SeriesModel, fDef: SeriesDef, actual: SeriesModel, aDef: SeriesDef): ForecastJoin {
  const fAt = new Map(forecast.rows.map((r) => [r.t, r[fDef.field]]))
  const aAt = new Map(actual.rows.map((r) => [r.t, r[aDef.field]]))
  const times = [...new Set([...fAt.keys(), ...aAt.keys()])].sort((x, y) => x - y)
  const stats = emptyStats()
  const rows = times.map((t) => {
    const f = fAt.get(t)
    const a = aAt.get(t)
    const fv = typeof f === 'number' ? f : null
    const av = typeof a === 'number' ? a : null
    let e: number | null = null
    if (fv !== null && av !== null) {
      e = (av - fv) / aDef.unit.factor
      addTo(stats, t, e, av / aDef.unit.factor)
    }
    return { t, f: fv, a: av, e }
  })
  return { rows, stats }
}

/** Per UK day of the window: the error figures over the steps both sides hold (`factor` takes the actual back to MW). */
export function errorByDay(join: ForecastJoin, window: DateRange, factor: number): Map<number, ErrorStats> {
  const byDay = new Map<number, ErrorStats>()
  for (const r of join.rows) {
    const e = r.e
    const a = r.a
    if (typeof e !== 'number' || typeof a !== 'number') continue
    const day = londonMidnight(r.t)
    const s = byDay.get(day) ?? emptyStats()
    addTo(s, r.t, e, a / factor)
    byDay.set(day, s)
  }
  return new Map(datesBetween(window.start, window.end).map((iso) => [dayStart(iso), byDay.get(dayStart(iso)) ?? emptyStats()]))
}

/** The two models can be joined step for step: the same clock, both read as held or both as means. */
export const sameClock = (a: SeriesModel, b: SeriesModel) => a.stepMs === b.stepMs && a.bucketed === b.bucketed
