/**
 * Figures the page's panels read from the rows, on each series' own clock.
 *
 * The flows and the schedules come on a mixed clock (hourly on some
 * borders, every 15 minutes on others) and the backend doesn't gap-fill
 * them, so a missing hour is simply absent. Each series' step is read from
 * its own points (their usual spacing), a null is placed where a step is
 * missing so that a line breaks there instead of running across the hole,
 * and each UK day's values are counted against the steps its own clock fits
 * in that day. Nothing is filled in: a day with nothing held has no mean.
 */
import { datesBetween, dayStart, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { WideRow } from '../../_template/seriesModel'

/** The value axes' width, so the stacked panels' clocks line up. */
export const AXIS_WIDTH = 56

/** One border's or zone's panel among several; a panel drawn alone takes the full chart height. */
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

/** The usual step between a series' own points (the median spacing); null with fewer than two. */
export function stepOf(points: Point[]): number | null {
  const diffs = points
    .slice(1)
    .map((p, i) => p.t - points[i].t)
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
  /** Steps of the series' own clock in the days counted; null when its step is unknown or doesn't fit a day. */
  expected: number | null
  mean: number | null
  low: { t: number; v: number } | null
  high: { t: number; v: number } | null
  /** Values of exactly zero. */
  zero: number
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
  for (const p of values) {
    sum += p.v
    if (p.v === 0) zero += 1
    if (!low || p.v < low.v) low = p
    if (!high || p.v > high.v) high = p
  }
  return { held: values.length, expected, mean: values.length ? sum / values.length : null, low, high, zero, latest: values.at(-1) ?? null }
}

const heldOf = (points: Point[]) => points.filter((p): p is { t: number; v: number } => p.v !== null)

/** Every UK day of the window, held or not, with the series' figures counted on its own step. */
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

export interface SideTally {
  day: string
  start: number
  /** Times with a value on either side. */
  held: number
  expected: number | null
  /** Times held with the zone named as the in area, and as the out area. */
  inSide: number
  outSide: number
  /** Times held on both sides at once. */
  both: number
  inMean: number | null
  outMean: number | null
}

/**
 * A zone's net position per UK day, its two sides counted apart and never
 * netted: a value named on the in side and one named on the out side are
 * both positive, and which of them is the export isn't confirmed.
 */
export function sideDays(inSide: Point[], outSide: Point[], step: number | null, window: DateRange): SideTally[] {
  const ins = daysOf(inSide, step, window)
  const outs = daysOf(outSide, step, window)
  const heldAt = (points: Point[]) => new Set(points.filter((p) => p.v !== null).map((p) => p.t))
  const inTimes = heldAt(inSide)
  const outTimes = heldAt(outSide)
  const times = new Map<number, { held: number; both: number }>()
  for (const t of new Set([...inTimes, ...outTimes])) {
    const d = londonMidnight(t)
    const s = times.get(d) ?? { held: 0, both: 0 }
    s.held += 1
    if (inTimes.has(t) && outTimes.has(t)) s.both += 1
    times.set(d, s)
  }
  return ins.map((a, i) => {
    const b = outs[i]
    const s = times.get(a.start) ?? { held: 0, both: 0 }
    return { day: a.day, start: a.start, held: s.held, expected: a.expected, inSide: a.held, outSide: b.held, both: s.both, inMean: a.mean, outMean: b.mean }
  })
}

/** Held in part: some of the series' own steps that day, not all (a day with none isn't partial, it's missing). */
export const isPartial = (d: Pick<Tally, 'held' | 'expected'>) => d.held > 0 && d.expected !== null && d.held < d.expected

/** `145 of 168`, or `145` when the clock can't be counted. */
export function heldText(t: Pick<Tally, 'held' | 'expected'>): string {
  const held = t.held.toLocaleString('en-GB')
  return t.expected === null || t.held === t.expected ? held : `${held} of ${t.expected.toLocaleString('en-GB')}`
}
