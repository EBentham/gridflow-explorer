/**
 * What the wind generation forecast panels share: the column and related
 * keys, one colour per measure (a colour follows its measure wherever it is
 * drawn), the value-axis width that lines the working panel's charts up
 * under the main one, and the figures read from the rows: which issue of the
 * forecast each hour shows and how far before or after the hour it was made,
 * and the forecast set against the wind output GB metered in the same hour.
 * Nothing is filled in: an hour either side lacks has no difference, never a
 * zero.
 */
import { DAY_MS, HOUR_MS, MINUTE_MS, datesBetween, dayStart, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { RowsResponse } from '../../contract'
import type { SeriesDef, SeriesModel, WideRow } from '../../_template/seriesModel'
import { displayUnit, type DisplayUnit } from '../../_template/units'

export const FORECAST = 'latest_forecast_mw'
export const ISSUED = 'published_at'
/** Elexon's generation by fuel type: its value column, and the fuel it is cut to. */
export const METERED = 'generation_mw'
export const FUEL_TYPE = 'fuel_type'
export const WIND = 'WIND'

/** The key of the related metered wind output. */
export const METERED_KEY = 'metered'

export const COLORS = {
  forecast: 'var(--chart-fan)',
  metered: 'var(--chart-actual)',
  difference: 'var(--fuel-other)',
  lead: 'var(--chart-fan-soft)',
} as const

/** Every chart's value axis takes this width, so their clocks line up. */
export const AXIS_WIDTH = 52

/** Differences print in MW: a few hundred MW would read as 0.3 GW. */
export const MW_UNIT = displayUnit('MW', 'MW')

/**
 * Hours before the hour an issue was made; below zero, after it. Not a unit
 * the template knows, so it is set out here. Issues land on the half-hour and
 * hours on the hour, so a lead is never whole: the tooltip gives it exactly
 * (`27 h 30 min after`), and figures elsewhere keep one decimal.
 */
export const LEAD_UNIT: DisplayUnit = {
  label: 'h',
  source: 'h',
  factor: 1,
  numeric: true,
  format: (v) => (v === 0 ? 'at the hour' : `${leadText(v * HOUR_MS)} ${v > 0 ? 'before' : 'after'}`),
  plain: (v) => signed(v),
  caption: 'Hours issued before the hour',
}

function signed(v: number): string {
  const text = Math.abs(v).toFixed(1)
  if (text === '0.0') return '0'
  return v > 0 ? `+${text}` : `−${text}`
}

/** A signed MW figure: `+431`, with a true minus below zero. */
export const signedMw = (v: number) => `${Math.round(v) > 0 ? '+' : ''}${MW_UNIT.plain(v)}`

/** A column's series in a model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null | undefined, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

// ---------------------------------------------------------------- issues

/**
 * `13 min`, `5 h 30 min`, `2 days 3 h`: how long before or after its hour an
 * issue was made. The parts are joined with non-breaking spaces, so a lead
 * never wraps mid-figure.
 */
export function leadText(ms: number): string {
  return leadWords(Math.abs(ms)).replace(/ /g, ' ')
}

function leadWords(ms: number): string {
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

/** Each held hour's issue time, by the hour's time stamp; empty when the rows carry none (rows read as means). */
export function issuesByHour(response: RowsResponse | null | undefined): Map<number, number> {
  const out = new Map<number, number>()
  if (!response || response.kind !== 'series') return out
  for (const r of response.rows) {
    if (typeof r[FORECAST] !== 'number') continue
    const p = r[ISSUED]
    if (typeof p !== 'string') continue
    const at = Date.parse(p)
    if (Number.isFinite(at)) out.set(r.ts, at)
  }
  return out
}

export interface IssueSummary {
  /** Hours held with an issue time. */
  hours: number
  /** Hours whose issue was made before the hour's time stamp, and the longest lead among them. */
  ahead: number
  longestAhead: number | null
  /** Hours whose issue was made at or after the hour's time stamp, and the longest lag among them. */
  after: number
  longestAfter: number | null
  /** The distinct issue times drawn, oldest first. */
  issues: number[]
  /** The last hour the newest issue drawn covers. */
  newestReach: number | null
}

export function summariseIssues(issues: Map<number, number>): IssueSummary | null {
  if (!issues.size) return null
  let ahead = 0
  let after = 0
  let longestAhead: number | null = null
  let longestAfter: number | null = null
  const distinct = new Set<number>()
  for (const [t, at] of issues) {
    distinct.add(at)
    const lead = t - at
    if (lead > 0) {
      ahead += 1
      longestAhead = Math.max(longestAhead ?? 0, lead)
    } else {
      after += 1
      longestAfter = Math.max(longestAfter ?? 0, -lead)
    }
  }
  const list = [...distinct].sort((a, b) => a - b)
  const newest = list[list.length - 1]
  let newestReach: number | null = null
  for (const [t, at] of issues) if (at === newest && (newestReach === null || t > newestReach)) newestReach = t
  return { hours: issues.size, ahead, longestAhead, after, longestAfter, issues: list, newestReach }
}

// ---------------------------------------------------------------- against metered output

/**
 * Metered output for each step of the forecast's clock: the mean of the
 * metered readings inside [t, t + step), only when every one of them is held.
 * Null when the metered step doesn't divide the forecast's.
 */
export function meteredPerStep(metered: SeriesModel, def: SeriesDef, step: number | null): Map<number, number> | null {
  const own = metered.stepMs
  if (step === null || own === null || own > step || step % own !== 0) return null
  const per = step / own
  const sums = new Map<number, { sum: number; n: number }>()
  for (const r of metered.rows) {
    const v = r[def.field]
    if (typeof v !== 'number') continue
    const start = r.t - (((r.t % step) + step) % step)
    const s = sums.get(start) ?? { sum: 0, n: 0 }
    s.sum += v
    s.n += 1
    sums.set(start, s)
  }
  const out = new Map<number, number>()
  for (const [t, s] of sums) if (s.n === per) out.set(t, s.sum / per)
  return out
}

export interface DiffStats {
  /** Hours both sides hold. */
  count: number
  /** Metered less forecast, MW. */
  sum: number
  sumAbs: number
}

export const emptyDiff = (): DiffStats => ({ count: 0, sum: 0, sumAbs: 0 })

function addTo(s: DiffStats, e: number) {
  s.count += 1
  s.sum += e
  s.sumAbs += Math.abs(e)
}

export interface Join {
  /** One row per forecast step: `f` and `m` in GW, `e` (metered less forecast) in MW, `l` the hours issued before the hour; null where missing. */
  rows: WideRow[]
  /** Over every hour both hold, and split by whether the hour's issue came before it or after. */
  all: DiffStats
  ahead: DiffStats
  after: DiffStats
  /** The widest differences each way. */
  above: { t: number; v: number } | null
  below: { t: number; v: number } | null
  /** The last time the metered output holds a value. */
  meteredTo: number | null
  /** The metered output could be put on the forecast's clock: its step divides the forecast's. */
  comparable: boolean
}

/** The forecast and the metered output joined on the forecast's clock. The models hold GW; the difference goes back to MW. */
export function joinMetered(forecast: SeriesModel, fDef: SeriesDef, metered: SeriesModel | null, mDef: SeriesDef | undefined, issues: Map<number, number>): Join {
  const perStep = metered && mDef ? meteredPerStep(metered, mDef, forecast.stepMs) : null
  const all = emptyDiff()
  const ahead = emptyDiff()
  const after = emptyDiff()
  let above: Join['above'] = null
  let below: Join['below'] = null
  let meteredTo: number | null = null
  if (metered && mDef) for (const r of metered.rows) if (typeof r[mDef.field] === 'number') meteredTo = r.t
  const rows = forecast.rows.map((r) => {
    const f = r[fDef.field]
    const fv = typeof f === 'number' ? f : null
    const mv = perStep?.get(r.t) ?? null
    const at = issues.get(r.t)
    const lead = at === undefined ? null : r.t - at
    let e: number | null = null
    if (fv !== null && mv !== null) {
      e = (mv - fv) / fDef.unit.factor
      addTo(all, e)
      if (lead !== null) addTo(lead > 0 ? ahead : after, e)
      if (e > 0 && (!above || e > above.v)) above = { t: r.t, v: e }
      if (e < 0 && (!below || e < below.v)) below = { t: r.t, v: e }
    }
    return { t: r.t, f: fv, m: mv, e, l: lead === null ? null : lead / HOUR_MS }
  })
  return { rows, all, ahead, after, above, below, meteredTo, comparable: perStep !== null }
}

// ---------------------------------------------------------------- by UK day

export interface DayRow {
  day: string
  start: number
  /** Forecast steps the day has, and holds. */
  expected: number | null
  held: number
  forecastMean: number | null
  /** Hours whose issue came before them. */
  ahead: number
  /** The issue times drawn that day, oldest first. */
  issues: number[]
  /** Metered readings the day has and holds, and their mean over those held (GW). */
  mExpected: number | null
  mHeld: number
  meteredMean: number | null
  diff: DiffStats
}

export function byDay(forecast: SeriesModel, fDef: SeriesDef, metered: SeriesModel | null, mDef: SeriesDef | undefined, join: Join, issues: Map<number, number>, window: DateRange): DayRow[] {
  const rows = new Map<number, DayRow>()
  const dayOf = (t: number) => rows.get(londonMidnight(t))
  const issueSets = new Map<number, Set<number>>()
  const fSum = new Map<number, number>()
  const mSum = new Map<number, number>()
  for (const day of datesBetween(window.start, window.end)) {
    const start = dayStart(day)
    rows.set(start, {
      day,
      start,
      expected: forecast.bucketed && forecast.stepMs !== null && forecast.stepMs > HOUR_MS ? null : stepsInDay(start, forecast.stepMs),
      held: 0,
      forecastMean: null,
      ahead: 0,
      issues: [],
      mExpected: metered && !(metered.bucketed && metered.stepMs !== null && metered.stepMs > HOUR_MS) ? stepsInDay(start, metered.stepMs) : null,
      mHeld: 0,
      meteredMean: null,
      diff: emptyDiff(),
    })
  }
  for (const r of forecast.rows) {
    const v = r[fDef.field]
    const d = dayOf(r.t)
    if (!d || typeof v !== 'number') continue
    d.held += 1
    fSum.set(d.start, (fSum.get(d.start) ?? 0) + v)
    const at = issues.get(r.t)
    if (at !== undefined) {
      if (r.t - at > 0) d.ahead += 1
      const set = issueSets.get(d.start) ?? new Set<number>()
      set.add(at)
      issueSets.set(d.start, set)
    }
  }
  if (metered && mDef) {
    for (const r of metered.rows) {
      const v = r[mDef.field]
      const d = dayOf(r.t)
      if (!d || typeof v !== 'number') continue
      d.mHeld += 1
      mSum.set(d.start, (mSum.get(d.start) ?? 0) + v)
    }
  }
  for (const r of join.rows) {
    const d = dayOf(r.t)
    if (d && typeof r.e === 'number') addTo(d.diff, r.e)
  }
  for (const d of rows.values()) {
    d.forecastMean = d.held ? (fSum.get(d.start) ?? 0) / d.held : null
    d.meteredMean = d.mHeld ? (mSum.get(d.start) ?? 0) / d.mHeld : null
    d.issues = [...(issueSets.get(d.start) ?? [])].sort((a, b) => a - b)
  }
  return [...rows.values()]
}
