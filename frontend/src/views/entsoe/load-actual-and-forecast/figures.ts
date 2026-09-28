/**
 * What the load panels share: the two columns, the four zones' names and
 * colours (a zone keeps its colour on both datasets), the colours of the
 * working panel's measures, the value-axis width that lines the working
 * chart up under the main one, and the join of actual load and its forecast
 * for one zone. Nothing is filled in: a quarter-hour missing from either side
 * has no error, never a zero.
 */
import { datesBetween, dayStart, londonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { GroupSpec, PageContext, RelatedData } from '../../define'
import { seriesId, type SeriesDef, type SeriesModel, type WideRow } from '../../_template/seriesModel'
import { displayUnit } from '../../_template/units'

export const ACTUAL = 'load_mw'
export const FORECAST = 'load_forecast_mw'
export const ACTUAL_ID = 'actual_load'
export const FORECAST_ID = 'load_forecast'
/** Each dataset reads the other beside it under these keys. */
export const ACTUAL_KEY = 'actual'
export const FORECAST_KEY = 'forecast'
export const AREA = 'area_code'

/** The Elexon page with GB's own demand. */
export const GB_DEMAND_ROUTE = '/sources/elexon/demand-outturn'

/** ENTSO-E's area codes (EIC) for the four zones held, largest first, as gridflow's area list names them. */
export const ZONES: GroupSpec[] = [
  { value: '10Y1001A1001A82H', label: 'Germany-Luxembourg', color: 'var(--chart-price)' },
  { value: '10YFR-RTE------C', label: 'France', color: 'var(--chart-price-2)' },
  { value: '10YNL----------L', label: 'Netherlands', color: 'var(--fuel-wind)' },
  { value: '10YBE----------2', label: 'Belgium', color: 'var(--fuel-pumped_storage)' },
]

/** The working panel's measures: one zone's actual and forecast, and the error between them. */
export const MEASURE = {
  actual: 'var(--chart-actual)',
  forecast: 'var(--chart-fan)',
  error: 'var(--fuel-other)',
} as const

/** Both charts' value axes take this width, so their clocks line up. */
export const AXIS_WIDTH = 52

/** Errors print in MW: a miss of a few hundred MW would read as 0.3 GW. */
export const ERROR_UNIT = displayUnit('MW', 'MW')

/** A signed error: `+431 MW`-style numbers, with a true minus below zero. */
export const signedMw = (v: number) => `${Math.round(v) > 0 ? '+' : ''}${ERROR_UNIT.plain(v)}`

export const zoneName = (area: string) => ZONES.find((z) => z.value === area)?.label ?? area

/** The page's actual and forecast models, whichever of the two datasets is open, and the other one's read. */
export function pairOf(ctx: PageContext): { actual: SeriesModel | null; forecast: SeriesModel | null; other: RelatedData | undefined; ownIsActual: boolean } {
  const ownIsActual = ctx.dataset.id === ACTUAL_ID
  const other = ctx.related[ownIsActual ? FORECAST_KEY : ACTUAL_KEY]
  const theirs = other?.series ?? null
  return ownIsActual ? { actual: ctx.series, forecast: theirs, other, ownIsActual } : { actual: theirs, forecast: ctx.series, other, ownIsActual }
}

/** A zone's series in a model. */
export const zoneDef = (model: SeriesModel | null | undefined, area: string): SeriesDef | undefined => model?.all.find((d) => d.group === area)

/** The zone the working panel reads: the one selected in the key, else the first drawn. */
export function zoneInView(ctx: PageContext): string | undefined {
  const model = ctx.series
  if (!model) return undefined
  const focused = model.all.find((d) => seriesId(d) === ctx.focus)
  return (focused ?? model.drawn[0])?.group ?? undefined
}

export interface ErrorStats {
  /** Steps both sides hold. */
  count: number
  /** Actual less forecast, MW. */
  sum: number
  sumAbs: number
  /** Actual load summed over the same steps, MW. */
  sumActual: number
  /** The steps where actual ran furthest above and furthest below the forecast. */
  above: { t: number; v: number } | null
  below: { t: number; v: number } | null
}

export interface ZoneJoin {
  /** One row per time either side holds: `a` and `f` in GW, `e` (actual less forecast) in MW; null where either is missing. */
  rows: WideRow[]
  stats: ErrorStats
}

const emptyStats = (): ErrorStats => ({ count: 0, sum: 0, sumAbs: 0, sumActual: 0, above: null, below: null })

function addTo(s: ErrorStats, t: number, e: number, actualMw: number) {
  s.count += 1
  s.sum += e
  s.sumAbs += Math.abs(e)
  s.sumActual += actualMw
  if (e > 0 && (!s.above || e > s.above.v)) s.above = { t, v: e }
  if (e < 0 && (!s.below || e < s.below.v)) s.below = { t, v: e }
}

/**
 * Actual load and its forecast for one zone, joined on time. The models hold
 * GW (display units); the error goes back to MW through the unit's factor.
 */
export function joinZone(actual: SeriesModel, aDef: SeriesDef, forecast: SeriesModel, fDef: SeriesDef): ZoneJoin {
  const fAt = new Map(forecast.rows.map((r) => [r.t, r[fDef.field]]))
  const times = [...new Set([...actual.rows.map((r) => r.t), ...forecast.rows.map((r) => r.t)])].sort((x, y) => x - y)
  const aAt = new Map(actual.rows.map((r) => [r.t, r[aDef.field]]))
  const stats = emptyStats()
  const rows = times.map((t) => {
    const a = aAt.get(t)
    const f = fAt.get(t)
    const av = typeof a === 'number' ? a : null
    const fv = typeof f === 'number' ? f : null
    let e: number | null = null
    if (av !== null && fv !== null) {
      e = (av - fv) / aDef.unit.factor
      addTo(stats, t, e, av / aDef.unit.factor)
    }
    return { t, a: av, f: fv, e }
  })
  return { rows, stats }
}

/** Per UK day of the window: the error figures over the steps both sides hold. */
export function errorByDay(join: ZoneJoin, window: DateRange, factor: number): Map<number, ErrorStats> {
  const byDay = new Map<number, ErrorStats>()
  for (const r of join.rows) {
    const e = r.e
    const a = r.a
    if (typeof e !== 'number' || typeof a !== 'number') continue
    const day = londonMidnight(r.t)
    const s = byDay.get(day) ?? emptyStats()
    // `a` is in display units (GW); the share is summed in MW, as the join's stats are.
    addTo(s, r.t, e, a / factor)
    byDay.set(day, s)
  }
  return new Map(datesBetween(window.start, window.end).map((iso) => [dayStart(iso), byDay.get(dayStart(iso)) ?? emptyStats()]))
}

/** The two models can be joined step for step: the same clock, both read as held or both as means. */
export const sameClock = (a: SeriesModel, f: SeriesModel) => a.stepMs === f.stepMs && a.bucketed === f.bucketed
