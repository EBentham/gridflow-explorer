/**
 * What the indicated imbalance and indicated margin panels share: the
 * dataset and column ids, one colour per measure (a colour follows its
 * measure wherever it is drawn), and the pair read from the rows: the page's
 * own dataset and the other one, joined on the half-hour, each with the
 * issue its figure comes from.
 *
 * Nothing is filled in: a half-hour either side lacks is a gap, never a zero.
 */
import { DAY_MS, HOUR_MS, MINUTE_MS, datesBetween, dayStart, londonMidnight, nextLondonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { SeriesRow } from '../../contract'
import type { PageContext, RelatedData } from '../../define'
import type { SeriesDef, SeriesModel, Settlement, WideRow } from '../../_template/seriesModel'
import { displayUnit, type DisplayUnit } from '../../_template/units'

export const IMBALNGC = 'imbalngc'
export const MELNGC = 'melngc'
export const IMBALANCE = 'indicated_imbalance'
export const MARGIN = 'indicated_margin'
export const ISSUED = 'published_at'

/** The key of the other dataset, read beside the page's own. */
export const OTHER_KEY = 'other'

export const COLORS = {
  imbalance: 'var(--chart-price-2)',
  margin: 'var(--chart-fan)',
  lead: 'var(--chart-fan-soft)',
} as const

export const LABELS = {
  imbalance: 'Indicated imbalance',
  margin: 'Indicated margin',
} as const

/** Every chart on the page takes this value-axis width, so their clocks line up. */
export const AXIS_WIDTH = 52

/** Tables keep MW. */
export const MW_UNIT = displayUnit('MW', 'MW')

/** The one boundary the rows hold, in words. */
export const BOUNDARY_WORDS = 'boundary N, the whole system'

// ---------------------------------------------------------------- issue times

/**
 * `13 min`, `5 h 20 min`, `2 days 3 h`: how long before its half-hour a
 * figure was issued (`… after` if it came later). Non-breaking spaces keep a
 * lead from wrapping mid-figure.
 */
export function leadText(ms: number): string {
  return leadWords(ms).replace(/ /g, ' ')
}

function leadWords(ms: number): string {
  if (ms < 0) return `${leadWords(-ms)} after`
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

/**
 * Hours before its half-hour a figure was issued. Not a unit the template
 * knows, so it is set out here; the tooltip gives the lead exactly.
 */
export const LEAD_UNIT: DisplayUnit = {
  label: 'h',
  source: 'h',
  factor: 1,
  numeric: true,
  format: (v) => `issued ${leadText(v * HOUR_MS)}${v >= 0 ? ' ahead' : ''}`,
  plain: (v) => (Math.abs(v) < 0.05 ? '0' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`),
  caption: 'Hours issued ahead',
}

const issuedAt = (r: SeriesRow): number | null => {
  const p = r[ISSUED]
  if (typeof p !== 'string') return null
  const t = Date.parse(p)
  return Number.isFinite(t) ? t : null
}

// ---------------------------------------------------------------- the pair

/** One half-hour of the pair: GW for the charts. */
export interface PairRow extends WideRow {
  /** Indicated imbalance, GW. */
  i: number | null
  /** Indicated margin, GW. */
  m: number | null
  /** Hours the page's own figure was issued ahead of its half-hour. */
  l: number | null
}

export interface PairCell {
  imbMw: number | null
  marMw: number | null
  imbIssued: number | null
  marIssued: number | null
}

export interface Pair {
  ownIsImbalance: boolean
  rows: PairRow[]
  /** As held, in MW, by half-hour: the table reads these. */
  cells: Map<number, PairCell>
  stepMs: number | null
  bucketed: boolean
  settlement: Map<number, Settlement> | null
  /** The page's own series, then the other's when it is paired. */
  own: SeriesDef | null
  other: SeriesDef | null
  imb: SeriesDef | null
  mar: SeriesDef | null
  /** The other dataset, and why it isn't paired when it isn't. */
  related: RelatedData | undefined
  otherState: 'paired' | 'failed' | 'loading' | 'none held' | 'other clock'
  /** Half-hours where both are held with issue times, where those differ, and the widest difference. */
  bothHeld: number
  issueMismatch: number
  widestMismatch: number
}

const GW = displayUnit('MW')

function def(which: 'imb' | 'mar', from: string, count: number): SeriesDef {
  const imb = which === 'imb'
  return {
    key: which,
    field: imb ? 'i' : 'm',
    column: imb ? IMBALANCE : MARGIN,
    group: null,
    label: imb ? LABELS.imbalance : LABELS.margin,
    color: imb ? COLORS.imbalance : COLORS.margin,
    unit: GW,
    from,
    count,
    mean: null,
    min: null,
    max: null,
    signed: false,
  }
}

/** A model's values of one series by time, in MW as held. */
function heldBy(model: SeriesModel, series: SeriesDef): Map<number, number | null> {
  const out = new Map<number, number | null>()
  for (const r of model.rows) {
    if (!(series.field in r)) continue
    const v = r[series.field]
    out.set(r.t, typeof v === 'number' ? v / series.unit.factor : null)
  }
  return out
}

/** Each held row's issue time, by half-hour. */
function issuesBy(rows: SeriesRow[] | undefined, column: string): Map<number, number> {
  const out = new Map<number, number>()
  for (const r of rows ?? []) {
    if (typeof r[column] !== 'number') continue
    const at = issuedAt(r)
    if (at !== null) out.set(r.ts, at)
  }
  return out
}

/** The page's own dataset and the other one, joined on the half-hour. */
export function pairOf(ctx: PageContext): Pair | null {
  const model = ctx.series
  if (!model) return null
  const ownIsImbalance = ctx.dataset.id === IMBALNGC
  const ownCol = ownIsImbalance ? IMBALANCE : MARGIN
  const otherCol = ownIsImbalance ? MARGIN : IMBALANCE
  const ownDef = model.all.find((d) => d.column === ownCol)
  if (!ownDef) return null
  const related = ctx.related[OTHER_KEY]
  const oModel = related?.series ?? null
  const oDef = oModel?.all.find((d) => d.column === otherCol) ?? null
  const clockOk = Boolean(oModel && oModel.stepMs === model.stepMs && oModel.bucketed === model.bucketed)
  const otherState: Pair['otherState'] = !related
    ? 'none held'
    : related.state === 'error' || related.state === 'refreshing'
      ? 'failed'
      : !oModel
        ? related.state === 'empty'
          ? 'none held'
          : 'loading'
        : !oDef || oDef.count === 0
          ? 'none held'
          : clockOk
            ? 'paired'
            : 'other clock'

  const own = heldBy(model, ownDef)
  const theirs = otherState === 'paired' && oModel && oDef ? heldBy(oModel, oDef) : new Map<number, number | null>()
  const ownIssues = model.bucketed ? new Map<number, number>() : issuesBy(ctx.response?.kind === 'series' ? ctx.response.rows : undefined, ownCol)
  const otherRows = related?.response?.kind === 'series' ? related.response.rows : undefined
  const theirIssues = otherState === 'paired' && !model.bucketed ? issuesBy(otherRows, otherCol) : new Map<number, number>()

  const times = [...new Set([...own.keys(), ...theirs.keys()])].sort((a, b) => a - b)
  const cells = new Map<number, PairCell>()
  let bothHeld = 0
  let issueMismatch = 0
  let widestMismatch = 0
  let iCount = 0
  let mCount = 0
  const rows: PairRow[] = times.map((t) => {
    const ov = own.get(t) ?? null
    const tv = theirs.get(t) ?? null
    const imbMw = ownIsImbalance ? ov : tv
    const marMw = ownIsImbalance ? tv : ov
    const oi = ownIssues.get(t) ?? null
    const ti = theirIssues.get(t) ?? null
    const imbIssued = ownIsImbalance ? oi : ti
    const marIssued = ownIsImbalance ? ti : oi
    cells.set(t, { imbMw, marMw, imbIssued, marIssued })
    if (imbMw !== null && marMw !== null && imbIssued !== null && marIssued !== null) {
      bothHeld += 1
      if (imbIssued !== marIssued) {
        issueMismatch += 1
        widestMismatch = Math.max(widestMismatch, Math.abs(imbIssued - marIssued))
      }
    }
    if (imbMw !== null) iCount += 1
    if (marMw !== null) mCount += 1
    return {
      t,
      i: imbMw === null ? null : imbMw * GW.factor,
      m: marMw === null ? null : marMw * GW.factor,
      l: ov !== null && oi !== null ? (t - oi) / HOUR_MS : null,
    }
  })

  const paired = otherState === 'paired'
  const imb = (ownIsImbalance || paired) && iCount > 0 ? def('imb', ownIsImbalance ? 'self' : OTHER_KEY, iCount) : null
  const mar = (!ownIsImbalance || paired) && mCount > 0 ? def('mar', ownIsImbalance ? OTHER_KEY : 'self', mCount) : null
  return {
    ownIsImbalance,
    rows,
    cells,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    own: ownIsImbalance ? imb : mar,
    other: ownIsImbalance ? mar : imb,
    imb,
    mar,
    related,
    otherState,
    bothHeld,
    issueMismatch,
    widestMismatch,
  }
}

/** Whether the two datasets' issue times differ anywhere, and by how much at most, in words. */
export function mismatchWords(pair: Pair): string {
  if (pair.otherState !== 'paired' || pair.bothHeld === 0) return ''
  if (pair.issueMismatch === 0) return 'Both figures at each half-hour come from the same issue.'
  const n = `${pair.issueMismatch.toLocaleString('en-GB')} of the ${pair.bothHeld.toLocaleString('en-GB')} half-hours both hold`
  return `The two figures’ issue times differ at ${n}, by ${leadText(pair.widestMismatch)} at most; the table gives each one’s.`
}

// ---------------------------------------------------------------- figures from the pair

export interface Extremes {
  high: { t: number; v: number }
  low: { t: number; v: number }
}

export function extremesIn(rows: PairRow[], field: 'i' | 'm' | 'l'): Extremes | null {
  let high: { t: number; v: number } | null = null
  let low: { t: number; v: number } | null = null
  for (const r of rows) {
    const v = r[field]
    if (typeof v !== 'number') continue
    if (!high || v > high.v) high = { t: r.t, v }
    if (!low || v < low.v) low = { t: r.t, v }
  }
  return high && low ? { high, low } : null
}

export function latestIn(rows: PairRow[], field: 'i' | 'm'): { t: number; v: number } | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const v = rows[i][field]
    if (typeof v === 'number') return { t: rows[i].t, v }
  }
  return null
}

/** Half-hours held with the imbalance below zero and above it (zero counts as neither). */
export function signCounts(rows: PairRow[]): { below: number; above: number; held: number } {
  let below = 0
  let above = 0
  let held = 0
  for (const r of rows) {
    if (typeof r.i !== 'number') continue
    held += 1
    if (r.i < 0) below += 1
    else if (r.i > 0) above += 1
  }
  return { below, above, held }
}

export interface IssueStats {
  count: number
  shortest: number
  median: number
  longest: number
  newest: number
}

/** How far ahead of its half-hour each of the page's own figures was issued. Null when the rows carry no issue time. */
export function issueStats(pair: Pair): IssueStats | null {
  const leads: number[] = []
  let newest = -Infinity
  for (const r of pair.rows) {
    if (typeof r.l !== 'number') continue
    leads.push(r.l * HOUR_MS)
    newest = Math.max(newest, r.t - r.l * HOUR_MS)
  }
  if (!leads.length) return null
  leads.sort((a, b) => a - b)
  const mid = leads.length >> 1
  const median = leads.length % 2 ? leads[mid] : (leads[mid - 1] + leads[mid]) / 2
  return { count: leads.length, shortest: leads[0], median, longest: leads[leads.length - 1], newest: Math.round(newest) }
}

// ---------------------------------------------------------------- the days

export interface PairDay {
  date: string
  start: number
  /** Half-hours the day has, when the step is known. */
  expected: number | null
  iHeld: number
  mHeld: number
  iLow: { t: number; v: number } | null
  iHigh: { t: number; v: number } | null
  mLow: { t: number; v: number } | null
  mHigh: { t: number; v: number } | null
  /** The issues behind the page's own figures that day, newest first, with how many half-hours each gives. */
  issues: { at: number; n: number }[]
}

export function pairDays(pair: Pair, window: DateRange): PairDay[] {
  const byDay = new Map<number, PairRow[]>()
  for (const r of pair.rows) {
    const d = londonMidnight(r.t)
    const list = byDay.get(d)
    if (list) list.push(r)
    else byDay.set(d, [r])
  }
  return datesBetween(window.start, window.end).map((date) => {
    const start = dayStart(date)
    const rows = byDay.get(start) ?? []
    const i = extremesIn(rows, 'i')
    const m = extremesIn(rows, 'm')
    const issues = new Map<number, number>()
    for (const r of rows) {
      if (typeof r.l !== 'number') continue
      const at = Math.round(r.t - r.l * HOUR_MS)
      issues.set(at, (issues.get(at) ?? 0) + 1)
    }
    return {
      date,
      start,
      expected: pair.stepMs ? Math.round((nextLondonMidnight(start) - start) / pair.stepMs) : null,
      iHeld: rows.filter((r) => typeof r.i === 'number').length,
      mHeld: rows.filter((r) => typeof r.m === 'number').length,
      iLow: i?.low ?? null,
      iHigh: i?.high ?? null,
      mLow: m?.low ?? null,
      mHigh: m?.high ?? null,
      issues: [...issues.entries()].map(([at, n]) => ({ at, n })).sort((a, b) => b.at - a.at),
    }
  })
}
