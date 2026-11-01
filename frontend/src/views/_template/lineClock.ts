/**
 * A series on its own clock, for ENTSO-E's mixed clocks (hourly on some
 * borders or zones, every 15 minutes on others) where the backend doesn't
 * gap-fill, so a missing step is simply absent, and for capacities published
 * only when they change. Each line's step is read from its own held points
 * (their usual spacing), a null is placed where a step is missing so that a
 * line breaks there instead of running across the hole, and each UK day's
 * values are counted against the steps its own clock fits in that day. Then
 * what the panels say of it in plain words: its step as held, the days it
 * misses steps on, and the values the chart can't draw. Nothing is filled
 * in: a day with nothing held has no mean.
 */
import { cap, listText, plural } from '../../design/format'
import { cadenceText, datesBetween, dayLabel, dayStart, londonMidnight, stepNoun, stepsInDay } from '../../design/time'
import type { DateRange } from '../../lib/range'
import type { WideRow } from './seriesModel'
import type { DisplayUnit } from './units'

/** A line as the words read it: its own points, with a null at every missing step, and its step. */
export interface Clocked {
  points: Point[]
  step: number | null
}

interface Named {
  name: string
  line: Clocked | null
}

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
  /** Steps of the series' own clock in the days counted; null when its step is unknown or doesn't fit a day. */
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

// ---------------------------------------------------------------- in words

/** `As held, GB–France and GB–Ireland (SEM) come hourly; GB–Netherlands and GB–Belgium every 15 minutes.` */
export function cadenceSentence(items: Named[]): string {
  const bySteps = new Map<number, string[]>()
  for (const { name, line } of items) {
    if (!line?.step) continue
    bySteps.set(line.step, [...(bySteps.get(line.step) ?? []), name])
  }
  if (!bySteps.size) return ''
  const parts = [...bySteps.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([step, names], i) => `${listText(names)}${i === 0 ? (names.length > 1 ? ' come ' : ' comes ') : ' '}${cadenceText(step).toLowerCase()}`)
  return `As held, ${parts.join('; ')}.`
}

/** `Tue 15 Sep, Fri 18 Sep and 2 more days`: at most four days named. */
export function daysText(starts: number[]): string {
  const named = starts.slice(0, 4).map(dayLabel)
  return starts.length > 4 ? `${named.join(', ')} and ${plural(starts.length - 4, 'more day', 'more days')}` : listText(named)
}

/**
 * `Some steps are missing: on every border on Mon 21 Sep; on GB–Ireland (SEM)
 * on Tue 15 Sep, Fri 18 Sep and Sun 20 Sep.` (`for` a zone). Each name with
 * the days it misses steps on, days all share said once. Only days some line
 * holds a value on: a day none holds is the template's "N of M days hold rows".
 */
export function missingText(byName: Map<string, Set<number>>, heldDays: Set<number>, every: string, prep: 'on' | 'for'): string {
  const names = [...byName.keys()]
  const missing = new Map([...byName.entries()].map(([n, days]) => [n, [...days].filter((d) => heldDays.has(d)).sort((a, b) => a - b)]))
  const shared = names.length > 1 ? (missing.get(names[0]) ?? []).filter((d) => names.every((n) => missing.get(n)?.includes(d))) : []
  const parts: string[] = []
  if (shared.length) parts.push(`${prep} ${every} on ${daysText(shared)}`)
  // Names missing steps on the same days are said together.
  const groups = new Map<string, { names: string[]; days: number[] }>()
  for (const n of names) {
    const own = (missing.get(n) ?? []).filter((d) => !shared.includes(d))
    if (!own.length) continue
    const g = groups.get(own.join()) ?? { names: [], days: own }
    g.names.push(n)
    groups.set(own.join(), g)
  }
  for (const g of groups.values()) parts.push(`${prep} ${listText(g.names)} on ${daysText(g.days)}`)
  return parts.length ? `Some steps are missing: ${parts.join('; ')}.` : ''
}

/**
 * `GB–France holds only 1 value in this window, on Mon 21 Sep, too few to
 * read its step.`: a line whose steps can't be counted, so its missing
 * steps can't be named either. Empty when the step is known or nothing is held.
 */
export function unreadSentence(name: string, points: Point[], step: number | null): string {
  if (step !== null) return ''
  const held = points.filter((p) => p.v !== null)
  if (!held.length) return ''
  const days = [...new Set(held.map((p) => londonMidnight(p.t)))].sort((a, b) => a - b)
  return `${cap(name)} holds only ${plural(held.length, 'value', 'values')} in this window, on ${daysText(days)}, too few to read its step.`
}

/** The borders' days that miss some of their own steps, and the borders whose steps can't be read. */
export function missingSentence(items: Named[], window: DateRange): string {
  const byName = new Map<string, Set<number>>()
  const heldDays = new Set<number>()
  for (const { name, line } of items) {
    if (!line) continue
    const days = new Set<number>()
    for (const d of daysOf(line.points, line.step, window)) {
      if (d.held > 0) heldDays.add(d.start)
      if (isPartial(d) || (d.held === 0 && d.expected !== null)) days.add(d.start)
    }
    byName.set(name, days)
  }
  const unread = items.map(({ name, line }) => (line ? unreadSentence(name, line.points, line.step) : ''))
  return [missingText(byName, heldDays, 'every border', 'on'), ...unread].filter(Boolean).join(' ')
}

/**
 * `Some values have nothing held a step before or after them on their own
 * line in this window, so the chart draws nothing for them: 3 on GB–Ireland
 * (SEM) and 1 on GB–France.` (`for` a zone). Empty when every value held is
 * on a line.
 */
export function aloneSentence(items: { name: string; alone: number }[], prep: 'on' | 'for' = 'on'): string {
  const parts = items.filter((x) => x.alone > 0).map((x) => `${x.alone.toLocaleString('en-GB')} ${prep} ${x.name}`)
  return parts.length
    ? `Some values have nothing held a step before or after them on their own line in this window, so the chart draws nothing for them: ${listText(parts)}. The Table view lists them.`
    : ''
}

/** `hours` or `quarter-hours`: what a line's steps are called; `hour` when there is `n` = 1 of them. */
export function stepWords(step: number | null, n?: number): string {
  const many = step === null ? 'values' : stepNoun(step)
  return n === 1 ? many.replace(/s$/, '') : many
}

/**
 * A figure as the unit prints it, except one that isn't zero but would print
 * as zero: `under 1 MW` (`under 1` in a table cell), so a small mean never
 * reads as an exact zero.
 */
export function figureText(unit: Pick<DisplayUnit, 'format' | 'plain'>, v: number, cell = false): string {
  const print = cell ? unit.plain : unit.format
  if (v === 0 || unit.plain(Math.abs(v)) !== unit.plain(0)) return print(v)
  return v > 0 ? `under ${print(1)}` : `between ${print(-1)} and ${cell ? print(0) : 'zero'}`
}
