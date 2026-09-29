/**
 * Figures the page's panels read from the rows, on each line's own clock.
 *
 * Two of the family's datasets come gap-filled on an hourly clock (net
 * transfer capacity, capacity allocated); the other two don't (nominated
 * capacity is hourly on GB's borders and every 15 minutes on France–Germany/
 * Luxembourg, and the DC link limits come only when a limit is set). So each
 * line's step is read from its own points (their usual spacing), a null is
 * placed where a step is missing so that a line breaks there instead of
 * running across the hole, and each UK day's values are counted against the
 * steps its own clock fits in that day. Nothing is filled in: a day with
 * nothing held has no mean.
 *
 * Adapted from the flows page's `figures.ts` (no page imports another's).
 */
import { datesBetween, dayStart, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { WideRow } from '../../_template/seriesModel'

/** The value axes' width, so the stacked panels' clocks line up. */
export const AXIS_WIDTH = 56

/** One border's panel among several; a panel drawn alone takes the full chart height. */
export const PANEL_HEIGHT = 132

export interface Point {
  t: number
  v: number | null
}

/** A series' own points: the rows that carry its field, oldest first. */
export function pointsOf(rows: WideRow[], field: string): Point[] {
  const out: Point[] = []
  for (const r of rows) {
    if (!(field in r)) continue
    const v = r[field]
    out.push({ t: r.t, v: typeof v === 'number' ? v : null })
  }
  return out
}

/** The usual step between a series' held points (the median spacing); null with fewer than two. */
export function stepOf(points: Point[]): number | null {
  const held = points.filter((p) => p.v !== null)
  const diffs = held
    .slice(1)
    .map((p, i) => p.t - held[i].t)
    .filter((d) => d > 0)
    .sort((a, b) => a - b)
  return diffs.length ? diffs[Math.floor(diffs.length / 2)] : null
}

/**
 * The points with a null one step after each held value that the next point
 * doesn't follow within a step: a line breaks at every missing step.
 */
export function withBreaks(points: Point[], step: number | null): Point[] {
  if (step === null) return points
  const out: Point[] = []
  points.forEach((p, i) => {
    out.push(p)
    const next = points[i + 1]
    if (next && p.v !== null && next.t - p.t > step) out.push({ t: p.t + step, v: null })
  })
  return out
}

/**
 * How many of a line's held values have nothing held a step before or after
 * them: no segment reaches them. Reads the points with their breaks
 * (`withBreaks`), where a missing step is a null.
 */
export function aloneCount(points: Point[]): number {
  let n = 0
  points.forEach((p, i) => {
    if (p.v === null) return
    const before = i > 0 && points[i - 1].v !== null
    const after = i < points.length - 1 && points[i + 1].v !== null
    if (!before && !after) n += 1
  })
  return n
}

/** Several series' points as chart rows, one per time; a series has no field at another's times. */
export function rowsOf(parts: { field: string; points: Point[] }[]): WideRow[] {
  const byT = new Map<number, WideRow>()
  for (const { field, points } of parts) {
    for (const p of points) {
      const row = byT.get(p.t) ?? { t: p.t }
      row[field] = p.v
      byT.set(p.t, row)
    }
  }
  return [...byT.values()].sort((a, b) => a.t - b.t)
}

export interface Tally {
  /** Values held. */
  held: number
  /** Steps of the series' own clock in the days counted; null when its clock can't be counted. */
  expected: number | null
  mean: number | null
  low: { t: number; v: number } | null
  high: { t: number; v: number } | null
  /** Values of exactly zero. */
  zero: number
  /** Different values held: a capacity moves in steps, and often holds one value for days. */
  distinct: number
  latest: { t: number; v: number } | null
}

export interface DayTally extends Tally {
  /** `YYYY-MM-DD`, UK. */
  day: string
  /** London midnight starting the day. */
  start: number
}

function tally(values: { t: number; v: number }[], expected: number | null): Tally {
  let sum = 0
  let zero = 0
  let low: Tally['low'] = null
  let high: Tally['high'] = null
  const seen = new Set<number>()
  for (const p of values) {
    sum += p.v
    seen.add(p.v)
    if (p.v === 0) zero += 1
    if (!low || p.v < low.v) low = p
    if (!high || p.v > high.v) high = p
  }
  return { held: values.length, expected, mean: values.length ? sum / values.length : null, low, high, zero, distinct: seen.size, latest: values.at(-1) ?? null }
}

const heldOf = (points: Point[]) => points.filter((p): p is { t: number; v: number } => p.v !== null)

/**
 * Every UK day of the window, held or not, with the series' figures. `step`
 * counts the steps each day fits; null counts values without a full day to
 * count against (a clock that can't be read, or a limit published only when set).
 */
export function daysOf(points: Point[], step: number | null, window: DateRange): DayTally[] {
  const byDay = new Map<number, { t: number; v: number }[]>()
  for (const p of heldOf(points)) {
    const d = londonMidnight(p.t)
    const list = byDay.get(d)
    if (list) list.push(p)
    else byDay.set(d, [p])
  }
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    return { day, start, ...tally(byDay.get(start) ?? [], step === null ? null : stepsInDay(start, step)) }
  })
}

/** The window's figures: every held value, and the steps its days hold on the series' own clock. */
export function windowTally(points: Point[], step: number | null, window: DateRange): Tally {
  const days = daysOf(points, step, window)
  const expected = days.every((d) => d.expected !== null) ? days.reduce((s, d) => s + (d.expected ?? 0), 0) : null
  return tally(heldOf(points), expected)
}

/** Held in part: some of the series' own steps that day, not all (a day with none isn't partial, it's missing). */
export const isPartial = (d: Pick<Tally, 'held' | 'expected'>) => d.held > 0 && d.expected !== null && d.held < d.expected

/** `145 of 168`; the count alone when the clock can't be counted, or the count fills (or passes) it. */
export function heldText(t: Pick<Tally, 'held' | 'expected'>): string {
  const held = t.held.toLocaleString('en-GB')
  return t.expected === null || t.held >= t.expected ? held : `${held} of ${t.expected.toLocaleString('en-GB')}`
}

/**
 * The UK days (their London midnights) on which any of the given lines
 * holds a value: a day none of them holds is not held locally, while a day
 * others hold and this one doesn't is a gap in this one only.
 */
export function heldDayStarts(pointSets: Point[][]): Set<number> {
  const out = new Set<number>()
  for (const points of pointSets) for (const p of points) if (p.v !== null) out.add(londonMidnight(p.t))
  return out
}
