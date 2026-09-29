/**
 * What the de-rated margin and loss of load probability panels share: the
 * column ids, one colour per measure, the units the page prints them in, and
 * the rows as the panels read them: each half-hour's margin, its probability
 * and the issue both come from.
 *
 * The probability is read from the rows as held, not through the series
 * model: its unit, "dimensionless (0-1)", is not one the template prints,
 * and at the template's digits 0.0000041 would read as a zero.
 *
 * Nothing is filled in: a half-hour with no figure is a gap, never a zero.
 */
import { fmtN } from '../../../design/format'
import { DAY_MS, HOUR_MS, MINUTE_MS, datesBetween, dayStart, londonMidnight, nextLondonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { PageContext } from '../../define'
import type { SeriesDef, Settlement, WideRow } from '../../_template/seriesModel'
import { displayUnit, type DisplayUnit } from '../../_template/units'

export const MARGIN = 'derated_margin_mw'
export const LOLP = 'loss_of_load_probability'
export const ISSUED = 'published_at'

export const COLORS = {
  margin: 'var(--chart-fan)',
  lolp: 'var(--chart-price-2)',
  lead: 'var(--chart-fan-soft)',
} as const

/** Every chart on the page takes this value-axis width, so their clocks line up. */
export const AXIS_WIDTH = 52

/** Tables keep MW. */
export const MW_UNIT = displayUnit('MW', 'MW')
const GW = displayUnit('MW')

// ---------------------------------------------------------------- the probability

/**
 * The probability as a decimal, never rounded to a false zero: seven places
 * at least (every value above zero in Elexon's files is a whole number of
 * 0.0000001), more when a mean runs smaller, trailing zeros dropped. A
 * held zero prints `0`.
 */
export function lolpText(v: number): string {
  if (v === 0) return '0'
  const digits = Math.min(20, Math.max(7, Math.ceil(-Math.log10(Math.abs(v))) + 1))
  return v.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')
}

/** `4.1 in a million`: the same figure, easier to read. */
export function perMillionText(v: number): string {
  const m = v * 1e6
  return `${fmtN(m, m >= 10 ? 0 : 1)} in a million`
}

/**
 * The probability drawn per million, so the axis reads 0 to 5 rather than
 * 0 to 0.000005. The tooltip gives it as held.
 */
export const LOLP_CHART_UNIT: DisplayUnit = {
  label: 'per million',
  source: 'dimensionless (0-1)',
  factor: 1e6,
  numeric: true,
  format: (v) => `${lolpText(v / 1e6)} (${perMillionText(v / 1e6)})`,
  plain: (v) => fmtN(v, 1),
  caption: 'Loss of load probability, per million',
}

// ---------------------------------------------------------------- issue times

/**
 * `13 min`, `5 h 20 min`, `2 days 3 h`: how long before its half-hour a
 * figure was issued (`… after` if it came later). Non-breaking spaces keep a
 * lead from wrapping mid-figure.
 */
export function leadText(ms: number): string {
  return leadWords(ms).replace(/ /g, ' ')
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

/** Hours before its half-hour a figure was issued; the tooltip gives the lead exactly. */
export const LEAD_UNIT: DisplayUnit = {
  label: 'h',
  source: 'h',
  factor: 1,
  numeric: true,
  format: (v) => `issued ${leadText(v * HOUR_MS)}${v >= 0 ? ' ahead' : ''}`,
  plain: (v) => (Math.abs(v) < 0.05 ? '0' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`),
  caption: 'Hours issued ahead',
}

// ---------------------------------------------------------------- the rows

/** One half-hour, for the charts. */
export interface MarginRow extends WideRow {
  /** De-rated margin, GW. */
  m: number | null
  /** Loss of load probability, per million. */
  p: number | null
  /** Hours the figures were issued ahead of their half-hour. */
  l: number | null
}

/** One half-hour as held: the table reads these. */
export interface Cell {
  mw: number | null
  lolp: number | null
  issued: number | null
}

export interface Model {
  rows: MarginRow[]
  cells: Map<number, Cell>
  stepMs: number | null
  bucketed: boolean
  settlement: Map<number, Settlement> | null
  margin: SeriesDef | null
  lolp: SeriesDef | null
  /** Half-hours holding a margin, and a probability. */
  marginHeld: number
  lolpHeld: number
}

function def(which: 'm' | 'p', count: number): SeriesDef {
  const margin = which === 'm'
  return {
    key: margin ? 'margin' : 'lolp',
    field: which,
    column: margin ? MARGIN : LOLP,
    group: null,
    label: margin ? 'De-rated margin' : 'Loss of load probability',
    color: margin ? COLORS.margin : COLORS.lolp,
    unit: margin ? GW : LOLP_CHART_UNIT,
    from: 'self',
    count,
    mean: null,
    min: null,
    max: null,
    signed: false,
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

function issuedAt(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

/** The page's rows, as the panels read them. Null until the rows are read. */
export function modelOf(ctx: PageContext): Model | null {
  const series = ctx.series
  const response = ctx.response
  if (!series || response?.kind !== 'series') return null
  const cells = new Map<number, Cell>()
  let marginHeld = 0
  let lolpHeld = 0
  const rows: MarginRow[] = [...response.rows]
    .sort((a, b) => a.ts - b.ts)
    .map((r) => {
      const mw = num(r[MARGIN])
      const lolp = num(r[LOLP])
      // Means carry no issue time; a row with no figure has none to name.
      const issued = series.bucketed || (mw === null && lolp === null) ? null : issuedAt(r[ISSUED])
      cells.set(r.ts, { mw, lolp, issued })
      if (mw !== null) marginHeld += 1
      if (lolp !== null) lolpHeld += 1
      return {
        t: r.ts,
        m: mw === null ? null : mw * GW.factor,
        p: lolp === null ? null : lolp * LOLP_CHART_UNIT.factor,
        l: issued === null ? null : (r.ts - issued) / HOUR_MS,
      }
    })
  return {
    rows,
    cells,
    stepMs: series.stepMs,
    bucketed: series.bucketed,
    settlement: series.settlement,
    margin: marginHeld ? def('m', marginHeld) : null,
    lolp: lolpHeld ? def('p', lolpHeld) : null,
    marginHeld,
    lolpHeld,
  }
}

// ---------------------------------------------------------------- figures from the rows

export interface Point {
  t: number
  v: number
}

export function extremesIn(rows: MarginRow[], field: 'm' | 'p' | 'l'): { high: Point; low: Point } | null {
  let high: Point | null = null
  let low: Point | null = null
  for (const r of rows) {
    const v = r[field]
    if (typeof v !== 'number') continue
    if (!high || v > high.v) high = { t: r.t, v }
    if (!low || v < low.v) low = { t: r.t, v }
  }
  return high && low ? { high, low } : null
}

export function latestIn(rows: MarginRow[], field: 'm' | 'p'): Point | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const v = rows[i][field]
    if (typeof v === 'number') return { t: rows[i].t, v }
  }
  return null
}

export interface LolpStats {
  /** Half-hours holding a probability, and those above zero. */
  held: number
  above: number
  /** The highest, as held (0 to 1). */
  highest: Point | null
  /** The margin, GW, at the half-hours above zero, and the lowest at those held as 0. */
  marginAbove: { low: number; high: number } | null
  lowestMarginAtZero: Point | null
}

export function lolpStats(model: Model): LolpStats {
  let held = 0
  let above = 0
  let highest: Point | null = null
  let marginAbove: { low: number; high: number } | null = null
  let lowestMarginAtZero: Point | null = null
  for (const r of model.rows) {
    const c = model.cells.get(r.t)
    if (!c || c.lolp === null) continue
    held += 1
    if (c.lolp > 0) {
      above += 1
      if (!highest || c.lolp > highest.v) highest = { t: r.t, v: c.lolp }
      if (typeof r.m === 'number') marginAbove = marginAbove ? { low: Math.min(marginAbove.low, r.m), high: Math.max(marginAbove.high, r.m) } : { low: r.m, high: r.m }
    } else if (typeof r.m === 'number' && (!lowestMarginAtZero || r.m < lowestMarginAtZero.v)) {
      lowestMarginAtZero = { t: r.t, v: r.m }
    }
  }
  return { held, above, highest, marginAbove, lowestMarginAtZero }
}

export interface IssueStats {
  count: number
  shortest: number
  median: number
  longest: number
  newest: number
}

/** How far ahead of its half-hour each figure was issued. Null when the rows carry no issue time. */
export function issueStats(model: Model): IssueStats | null {
  const leads: number[] = []
  let newest = -Infinity
  for (const r of model.rows) {
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

export interface Day {
  date: string
  start: number
  /** Half-hours the day has, when the step is known. */
  expected: number | null
  held: number
  mLow: Point | null
  mHigh: Point | null
  /** The highest probability held that day (0 to 1), and the half-hours above zero. */
  lolpHigh: Point | null
  lolpHeld: number
  lolpAbove: number
  /** The issues behind the day's figures, newest first, with how many half-hours each gives. */
  issues: { at: number; n: number }[]
}

export function daysOf(model: Model, window: DateRange): Day[] {
  const byDay = new Map<number, MarginRow[]>()
  for (const r of model.rows) {
    const d = londonMidnight(r.t)
    const list = byDay.get(d)
    if (list) list.push(r)
    else byDay.set(d, [r])
  }
  return datesBetween(window.start, window.end).map((date) => {
    const start = dayStart(date)
    const rows = byDay.get(start) ?? []
    const m = extremesIn(rows, 'm')
    const issues = new Map<number, number>()
    let lolpHigh: Point | null = null
    let lolpHeld = 0
    let lolpAbove = 0
    let held = 0
    for (const r of rows) {
      const c = model.cells.get(r.t)
      if (c && (c.mw !== null || c.lolp !== null)) held += 1
      if (c && c.lolp !== null) {
        lolpHeld += 1
        if (c.lolp > 0) lolpAbove += 1
        if (!lolpHigh || c.lolp > lolpHigh.v) lolpHigh = { t: r.t, v: c.lolp }
      }
      if (typeof r.l !== 'number') continue
      const at = Math.round(r.t - r.l * HOUR_MS)
      issues.set(at, (issues.get(at) ?? 0) + 1)
    }
    return {
      date,
      start,
      expected: model.stepMs ? Math.round((nextLondonMidnight(start) - start) / model.stepMs) : null,
      held,
      mLow: m?.low ?? null,
      mHigh: m?.high ?? null,
      lolpHigh,
      lolpHeld,
      lolpAbove,
      issues: [...issues.entries()].map(([at, n]) => ({ at, n })).sort((a, b) => b.at - a.at),
    }
  })
}
