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
import { daysInWindow } from '../../../design/days'
import { fmtN, num } from '../../../design/format'
import { HOUR_MS, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { PageContext } from '../../define'
import { ISSUED, issuedAt, issuesIn, issueTally } from '../../_template/issues'
import { extremesIn, type SeriesDef, type Settlement, type WideRow } from '../../_template/seriesModel'
import { displayUnit, type DisplayUnit } from '../../_template/units'

export const MARGIN = 'derated_margin_mw'
export const LOLP = 'loss_of_load_probability'

export const COLORS = {
  margin: 'var(--chart-fan)',
  lolp: 'var(--chart-price-2)',
  lead: 'var(--chart-fan-soft)',
} as const

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
  return daysInWindow(model.rows, window).map(({ day: date, start, rows }) => {
    const m = extremesIn(rows, 'm')
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
    }
    return {
      date,
      start,
      expected: stepsInDay(start, model.stepMs),
      held,
      mLow: m?.low ?? null,
      mHigh: m?.high ?? null,
      lolpHigh,
      lolpHeld,
      lolpAbove,
      issues: issueTally(issuesIn(rows)),
    }
  })
}
