/**
 * The five-minute readings set against FUELHH's half-hour figure.
 *
 * gridflow stamps each reading with the time Elexon published it, which in
 * every file held is five minutes after the reading's start time. So the
 * half-hour FUELHH dates `T` (its start) holds the six readings stamped
 * `T + 5` to `T + 30` minutes. A half-hour is compared only when all six
 * are held; nothing is filled in.
 */
import { FUEL_BANDS } from '../../../design/fuels'
import { HALF_HOUR, datesBetween, dayLabel, dayStart, londonMidnight, nextLondonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { SeriesDef, WideRow } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { FIVE_MIN, HH_KEY, TOTAL_FIELD, bandField, fold, seriesFor, type Folded } from './fuels'

/** The half-hour (its start) whose six readings include the one stamped `t`. */
export const halfHourOf = (t: number) => Math.floor((t - FIVE_MIN) / HALF_HOUR) * HALF_HOUR

export interface HalfHourPair {
  /** The half-hour's start. */
  t: number
  /** The six readings, lowest and highest, and when (their stamps). */
  lo: { t: number; v: number }
  hi: { t: number; v: number }
  mean: number
  /** FUELHH's figure for the half-hour, when held. */
  hh: number | null
}

/** Every half-hour in `[from, to)` with all six of its readings held for `field`. */
export function pairsFor(inst: Folded, hh: Folded | null, field: string, from: number, to: number): HalfHourPair[] {
  const at = new Map(inst.rows.map((r) => [r.t, r]))
  const hhAt = new Map((hh?.rows ?? []).map((r) => [r.t, r]))
  const out: HalfHourPair[] = []
  for (let t = from; t < to; t += HALF_HOUR) {
    const six: { t: number; v: number }[] = []
    for (let k = 1; k <= 6; k += 1) {
      const s = t + k * FIVE_MIN
      const v = at.get(s)?.[field]
      if (typeof v === 'number') six.push({ t: s, v })
    }
    if (six.length < 6) continue
    let lo = six[0]
    let hi = six[0]
    for (const p of six) {
      if (p.v < lo.v) lo = p
      if (p.v > hi.v) hi = p
    }
    const h = hhAt.get(t)?.[field]
    out.push({ t, lo, hi, mean: six.reduce((a, p) => a + p.v, 0) / 6, hh: typeof h === 'number' ? h : null })
  }
  return out
}

export interface PairSummary {
  /** Half-hours with all six readings held. */
  whole: number
  /** Of those, the ones FUELHH holds too. */
  matched: number
  /** The largest gap, six-reading mean less FUELHH, in display units (sign kept). */
  gap: { t: number; v: number } | null
  /** The half-hour whose readings spread widest. */
  move: HalfHourPair | null
}

export function summarise(pairs: HalfHourPair[]): PairSummary {
  let gap: PairSummary['gap'] = null
  let move: HalfHourPair | null = null
  let matched = 0
  for (const p of pairs) {
    if (!move || p.hi.v - p.lo.v > move.hi.v - move.lo.v) move = p
    if (p.hh === null) continue
    matched += 1
    const d = p.mean - p.hh
    if (!gap || Math.abs(d) > Math.abs(gap.v)) gap = { t: p.t, v: d }
  }
  return { whole: pairs.length, matched, gap, move }
}

/** FUELHH folded into the same bands, when it has rows. */
export function hhFolded(ctx: PageContext): Folded | null {
  const model = ctx.related[HH_KEY]?.series
  return model ? fold(model) : null
}

export interface Day {
  start: number
  end: number
  /** Readings held in `(start, end]`: those that start inside the day. */
  held: number
  expected: number | null
}

/** Each day of the window with the readings that start inside it (stamped just after its midnight up to the next). */
export function daysOf(inst: Folded, window: DateRange): Day[] {
  return datesBetween(window.start, window.end).map((iso) => {
    const start = dayStart(iso)
    const end = nextLondonMidnight(start)
    let held = 0
    for (const r of inst.rows) if (r.t > start && r.t <= end && typeof r[TOTAL_FIELD] === 'number') held += 1
    return { start, end, held, expected: stepsInDay(start, FIVE_MIN) }
  })
}

/** The day the half-hour panel reads: the one picked, else the latest with every reading held, else the latest holding any. */
export function dayFor(days: Day[], picked: number | undefined): Day | undefined {
  const held = days.filter((d) => d.held > 0)
  const pick = picked === undefined ? undefined : held.find((d) => d.start === londonMidnight(picked))
  return pick ?? held.filter((d) => d.expected !== null && d.held >= d.expected).at(-1) ?? held.at(-1)
}

/** The day's readings and FUELHH's figure held flat across each half-hour's six, as chart rows. */
export function dayRows(inst: Folded, hh: Folded | null, field: string, day: Day): WideRow[] {
  const hhAt = new Map((hh?.rows ?? []).map((r) => [r.t, r]))
  return inst.rows
    .filter((r) => r.t > day.start && r.t <= day.end)
    .map((r) => {
      const h = hhAt.get(halfHourOf(r.t))?.[field]
      return { t: r.t, reading: typeof r[field] === 'number' ? r[field] : null, hh: typeof h === 'number' ? h : null }
    })
}

export interface BandLine {
  key: string
  label: string
  color: string
  field: string
  summary: PairSummary
}

/** Total generation, then each band top of the stack first, summarised over one day's half-hours. */
export function bandLines(inst: Folded, hh: Folded | null, day: Day): BandLine[] {
  const keys: (string | undefined)[] = [undefined, ...[...FUEL_BANDS].reverse().map((b) => b.key)]
  return keys.map((key) => {
    const def: SeriesDef = seriesFor(inst, key)
    const field = key ? bandField(key) : TOTAL_FIELD
    return { key: key ?? 'total', label: def.label, color: def.color, field, summary: summarise(pairsFor(inst, hh, field, day.start, day.end)) }
  })
}

export const dayName = (d: Day) => dayLabel(d.start)

/** The day the half-hour panel reads, with the folded readings; null for a window read as means, or holding none. */
export function halfHourView(ctx: PageContext): { folded: Folded; day: Day } | null {
  const model = ctx.series
  if (!model || model.bucketed || !ctx.window) return null
  const folded = fold(model)
  const day = folded ? dayFor(daysOf(folded, ctx.window), ctx.picked) : undefined
  return folded && day ? { folded, day } : null
}
