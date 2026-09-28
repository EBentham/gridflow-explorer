/**
 * What the demand forecast panels share: the column and dataset ids, one
 * colour per measure (a colour follows its measure wherever it is drawn), the
 * value-axis width that lines the working panel's chart up under the main
 * one, and the figures read from the rows: how far ahead each held forecast
 * was issued, the forecast against outturn half-hour by half-hour, and the
 * daily forecasts lined up by delivery date. Nothing is filled in: a step
 * either side lacks has no error, never a zero.
 */
import { DAY_MS, HOUR_MS, MINUTE_MS, datesBetween, dayStart, londonMidnight, nextLondonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { RowsResponse, SeriesRow } from '../../contract'
import type { PageContext, RelatedData } from '../../define'
import type { SeriesDef, SeriesModel, WideRow } from '../../_template/seriesModel'
import { displayUnit } from '../../_template/units'

export const NDF = 'ndf'
export const TSDF = 'tsdf'
export const NDFD = 'ndfd'
export const TSDFD = 'tsdfd'

/** National demand forecast: `ndf` and `ndfd` carry the same column. */
export const NATIONAL_FC = 'national_demand_mw'
/** Transmission demand forecast: `tsdf` and `tsdfd` carry the same column. */
export const TRANSMISSION_FC = 'forecast_demand_mw'
export const INDO = 'initial_demand_outturn_mw'
export const ITSDO = 'initial_transmission_system_demand_outturn_mw'
export const BOUNDARY = 'boundary'
export const FORECAST_TYPE = 'forecast_type'

/** The key of the outturn read beside a half-hourly forecast, and beside a daily one. */
export const OUTTURN_KEY = 'outturn'
/** The key of the other daily forecast read beside a daily one. */
export const OTHER_KEY = 'other'

/** The national boundary of the transmission forecast; the other 17 are B1 to B17. */
export const NATIONAL_BOUNDARY = 'N'
export const BOUNDARIES = [NATIONAL_BOUNDARY, ...Array.from({ length: 17 }, (_, i) => `B${i + 1}`)]
/** The page's own URL parameter for the transmission forecast's boundary. */
export const BOUNDARY_PARAM = 'boundary'

export const COLORS = {
  national: 'var(--chart-fan)',
  transmission: 'var(--chart-fan-soft)',
  outturn: 'var(--chart-actual)',
  outturnMean: 'var(--chart-price-2)',
  error: 'var(--fuel-other)',
} as const

/** Both charts' value axes take this width, so their clocks line up. */
export const AXIS_WIDTH = 52

/** Errors print in MW: a miss of a few hundred MW would read as 0.3 GW. */
export const ERROR_UNIT = displayUnit('MW', 'MW')
export const GW_UNIT = displayUnit('MW')

/** A signed MW figure: `+431`, with a true minus below zero. */
export const signedMw = (v: number) => `${Math.round(v) > 0 ? '+' : ''}${ERROR_UNIT.plain(v)}`
/** A signed GW figure from GW: `+0.4`, with a true minus below zero. */
export const signedGw = (v: number) => {
  const text = GW_UNIT.plain(v)
  return `${Number(text.replace('−', '-')) > 0 ? '+' : ''}${text}`
}

/** A column's series in a model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null | undefined, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

/** The page's forecast column: national for `ndf`/`ndfd`, transmission for `tsdf`/`tsdfd`. */
export const forecastColumn = (datasetId: string) => (datasetId === NDF || datasetId === NDFD ? NATIONAL_FC : TRANSMISSION_FC)

/** The transmission forecast's boundary on the page: the URL's, else N. */
export function boundaryOf(ctx: Pick<PageContext, 'param'>): string {
  const b = ctx.param(BOUNDARY_PARAM)
  return b && BOUNDARIES.includes(b) ? b : NATIONAL_BOUNDARY
}

// ---------------------------------------------------------------- issue times

/** `13 min`, `5 h 20 min`, `2 days 3 h`: how long before its period a forecast was issued (`… after` if it came later). */
export function leadText(ms: number): string {
  if (ms < 0) return `${leadText(-ms)} after`
  const min = Math.round(ms / MINUTE_MS)
  if (min < 60) return `${min} min`
  if (ms < 2 * DAY_MS) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  const hours = Math.round(ms / HOUR_MS)
  const d = Math.floor(hours / 24)
  const h = hours % 24
  return h ? `${d} days ${h} h` : `${d} days`
}

export interface IssueStats {
  /** Periods with a value and an issue time. */
  count: number
  /** How long before its period each was issued: the shortest, the median and the longest. */
  shortest: number
  median: number
  longest: number
  /** The newest issue time held in the window. */
  newest: number
}

const issuedAt = (r: SeriesRow): number | null => {
  const p = r.published_at
  if (typeof p !== 'string') return null
  const t = Date.parse(p)
  return Number.isFinite(t) ? t : null
}

/**
 * How far ahead of its period each held forecast was issued, read from the
 * rows' own issue time (`published_at`). Null when the rows don't carry it
 * (rows read as means have no issue time).
 */
export function issueStats(response: RowsResponse | null | undefined, column: string): IssueStats | null {
  if (!response || response.kind !== 'series') return null
  const leads: number[] = []
  let newest = -Infinity
  for (const r of response.rows) {
    if (typeof r[column] !== 'number') continue
    const at = issuedAt(r)
    if (at === null) continue
    leads.push(r.ts - at)
    newest = Math.max(newest, at)
  }
  if (!leads.length) return null
  leads.sort((a, b) => a - b)
  const mid = leads.length >> 1
  const median = leads.length % 2 ? leads[mid] : (leads[mid - 1] + leads[mid]) / 2
  return { count: leads.length, shortest: leads[0], median, longest: leads[leads.length - 1], newest }
}

// ---------------------------------------------------------------- half-hourly forecast against outturn

export interface ErrorStats {
  /** Steps both sides hold. */
  count: number
  /** Outturn less forecast, MW. */
  sum: number
  sumAbs: number
  /** Outturn summed over the same steps, MW. */
  sumOutturn: number
  /** The steps where outturn ran furthest above and furthest below the forecast. */
  above: { t: number; v: number } | null
  below: { t: number; v: number } | null
}

export interface ForecastJoin {
  /** One row per time either side holds: `f` and `o` in GW, `e` (outturn less forecast) in MW; null where either is missing. */
  rows: WideRow[]
  stats: ErrorStats
}

export const emptyStats = (): ErrorStats => ({ count: 0, sum: 0, sumAbs: 0, sumOutturn: 0, above: null, below: null })

function addTo(s: ErrorStats, t: number, e: number, outturnMw: number) {
  s.count += 1
  s.sum += e
  s.sumAbs += Math.abs(e)
  s.sumOutturn += outturnMw
  if (e > 0 && (!s.above || e > s.above.v)) s.above = { t, v: e }
  if (e < 0 && (!s.below || e < s.below.v)) s.below = { t, v: e }
}

/**
 * The forecast and its outturn joined on time. The models hold GW (display
 * units); the error goes back to MW through the unit's factor.
 */
export function joinOutturn(forecast: SeriesModel, fDef: SeriesDef, outturn: SeriesModel, oDef: SeriesDef): ForecastJoin {
  const fAt = new Map(forecast.rows.map((r) => [r.t, r[fDef.field]]))
  const oAt = new Map(outturn.rows.map((r) => [r.t, r[oDef.field]]))
  const times = [...new Set([...fAt.keys(), ...oAt.keys()])].sort((x, y) => x - y)
  const stats = emptyStats()
  const rows = times.map((t) => {
    const f = fAt.get(t)
    const o = oAt.get(t)
    const fv = typeof f === 'number' ? f : null
    const ov = typeof o === 'number' ? o : null
    let e: number | null = null
    if (fv !== null && ov !== null) {
      e = (ov - fv) / fDef.unit.factor
      addTo(stats, t, e, ov / oDef.unit.factor)
    }
    return { t, f: fv, o: ov, e }
  })
  return { rows, stats }
}

/** Per UK day of the window: the error figures over the steps both sides hold. */
export function errorByDay(join: ForecastJoin, window: DateRange, factor: number): Map<number, ErrorStats> {
  const byDay = new Map<number, ErrorStats>()
  for (const r of join.rows) {
    const e = r.e
    const o = r.o
    if (typeof e !== 'number' || typeof o !== 'number') continue
    const day = londonMidnight(r.t)
    const s = byDay.get(day) ?? emptyStats()
    addTo(s, r.t, e, o / factor)
    byDay.set(day, s)
  }
  return new Map(datesBetween(window.start, window.end).map((iso) => [dayStart(iso), byDay.get(dayStart(iso)) ?? emptyStats()]))
}

/** The two models can be joined step for step: the same clock, both read as held or both as means. */
export const sameClock = (a: SeriesModel, b: SeriesModel) => a.stepMs === b.stepMs && a.bucketed === b.bucketed

// ---------------------------------------------------------------- daily forecasts, by delivery date

/** A daily forecast's figure for one delivery date, in MW as published, and when it was issued. */
export interface DailyFigure {
  mw: number
  issued: number | null
}

/**
 * A daily forecast's figures by delivery date (`YYYY-MM-DD`). The national
 * figure is stamped at UK midnight and the transmission figure at UTC
 * midnight, an hour apart in summer, so the two line up on the date the
 * rows carry, never on the stamp.
 */
export function dailyByDate(response: RowsResponse | null | undefined, column: string): Map<string, DailyFigure> {
  const out = new Map<string, DailyFigure>()
  if (!response || response.kind !== 'series') return out
  for (const r of response.rows) {
    const v = r[column]
    if (typeof v !== 'number') continue
    const date = typeof r.settlement_date === 'string' ? r.settlement_date : typeof r.forecast_date === 'string' ? r.forecast_date : null
    if (!date) continue
    out.set(date, { mw: v, issued: issuedAt(r) })
  }
  return out
}

/** Whole UK days from the day a forecast was issued to its delivery date: `2` for a forecast issued on the 21st for the 23rd. */
export function daysAhead(date: string, issued: number): number {
  return Math.round((dayStart(date) - londonMidnight(issued)) / DAY_MS)
}

/** The page's daily forecast and the other one: which is national and which transmission. */
export function dailyPair(ctx: PageContext): { national: Map<string, DailyFigure>; transmission: Map<string, DailyFigure>; other: RelatedData | undefined; ownIsNational: boolean } {
  const ownIsNational = ctx.dataset.id === NDFD
  const other = ctx.related[OTHER_KEY]
  const own = dailyByDate(ctx.response, forecastColumn(ctx.dataset.id))
  const theirs = dailyByDate(other?.response, ownIsNational ? TRANSMISSION_FC : NATIONAL_FC)
  return ownIsNational ? { national: own, transmission: theirs, other, ownIsNational } : { national: theirs, transmission: own, other, ownIsNational }
}

/** The outturn a forecast is set against: national demand for the national forecasts, transmission demand for the transmission ones. */
export const outturnColumn = (datasetId: string) => (datasetId === NDF || datasetId === NDFD ? INDO : ITSDO)

/** One delivery day of the window with both daily forecasts, and the page's own measure's outturn peak and mean on it. */
export interface DeliveryDay {
  date: string
  start: number
  national: DailyFigure | null
  transmission: DailyFigure | null
  /** The outturn's half-hours held that day, and those the day has. */
  held: number
  expected: number | null
  /** The outturn's peak and mean, GW, on a day holding every half-hour only. */
  peak: number | null
  mean: number | null
}

export function deliveryDays(ctx: PageContext): DeliveryDay[] {
  if (!ctx.window) return []
  const { national, transmission } = dailyPair(ctx)
  const oModel = ctx.related[OUTTURN_KEY]?.series ?? null
  const oDef = seriesOf(oModel, outturnColumn(ctx.dataset.id))
  const byDay = new Map<number, { held: number; expected: number | null; peak: number | null; mean: number | null }>()
  if (oModel && oDef && !oModel.bucketed) {
    // Bucket means would give a mean of means and no true peak, so only half-hours as held are read.
    for (const d of outturnDays(oModel, oDef, ctx.window)) byDay.set(d.start, d)
  }
  return datesBetween(ctx.window.start, ctx.window.end).map((date) => {
    const start = dayStart(date)
    const o = byDay.get(start)
    return {
      date,
      start,
      national: national.get(date) ?? null,
      transmission: transmission.get(date) ?? null,
      held: o?.held ?? 0,
      expected: o?.expected ?? null,
      peak: o?.peak ?? null,
      mean: o?.mean ?? null,
    }
  })
}

/** Outturn per UK day: half-hours held, and the peak and mean where the day holds every one. */
function outturnDays(model: SeriesModel, def: SeriesDef, window: DateRange): { start: number; held: number; expected: number | null; peak: number | null; mean: number | null }[] {
  const byDay = new Map<number, number[]>()
  for (const r of model.rows) {
    const v = r[def.field]
    if (typeof v !== 'number') continue
    const d = londonMidnight(r.t)
    const list = byDay.get(d)
    if (list) list.push(v)
    else byDay.set(d, [v])
  }
  return datesBetween(window.start, window.end).map((iso) => {
    const start = dayStart(iso)
    const vs = byDay.get(start) ?? []
    const expected = model.stepMs ? Math.round((nextLondonMidnight(start) - start) / model.stepMs) : null
    const complete = expected !== null && vs.length === expected
    return {
      start,
      held: vs.length,
      expected,
      peak: complete ? Math.max(...vs) : null,
      mean: complete ? vs.reduce((a, b) => a + b, 0) / vs.length : null,
    }
  })
}
