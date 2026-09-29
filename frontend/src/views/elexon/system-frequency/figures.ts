/**
 * The figures this page reads from the rows held: the reading spacing, each
 * UK day's time outside the bands, the spells outside the narrower band, and
 * the runs of missing readings. Everything is counted from readings held; a
 * missing reading is a gap, never a value inside or outside a band.
 */
import { HOUR_MS, MINUTE_MS, datesBetween, dayStart, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { SeriesDef, SeriesModel, WideRow } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'

export const VALUE = 'frequency_hz'
export const FREQ_COLOR = 'var(--chart-price)'
/** The narrower band's wash: the grid's own ink, so it reads as a reference, not as data. */
export const BAND_FILL = 'var(--chart-grid)'

/** The nominal frequency. */
export const NOMINAL_HZ = 50
/** The statutory range, as gridflow's notes on this dataset give it (`30-vendors/elexon/datasets/freq.md`). */
export const STATUTORY: readonly [number, number] = [49.5, 50.5]
/** The narrower band this page was specified to count; no source names who sets it (NEEDS.md). */
export const NARROW: readonly [number, number] = [49.8, 50.2]

export const bandText = (b: readonly [number, number]) => `${b[0].toFixed(1)}–${b[1].toFixed(1)} Hz`

const outside = (v: number, b: readonly [number, number]) => v < b[0] || v > b[1]

/** The page's one series: `frequency_hz`. */
export function freqDef(model: SeriesModel | null): SeriesDef | undefined {
  return model?.drawn.find((d) => d.column === VALUE) ?? model?.all.find((d) => d.column === VALUE)
}

/** Held readings as (time, value), in time order. */
export function heldPoints(rows: WideRow[], def: SeriesDef): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = []
  for (const r of rows) {
    const v = r[def.field]
    if (typeof v === 'number') out.push({ t: r.t, v })
  }
  return out
}

/**
 * The usual spacing of the readings held, read from the data (the median gap
 * between consecutive held readings), and how many gaps between them are
 * something else.
 */
export function measuredStep(points: { t: number }[]): { ms: number; other: number } | null {
  const diffs: number[] = []
  for (let i = 1; i < points.length; i += 1) diffs.push(points[i].t - points[i - 1].t)
  if (!diffs.length) return null
  const sorted = [...diffs].sort((a, b) => a - b)
  const ms = sorted[Math.floor(sorted.length / 2)]
  return { ms, other: diffs.filter((d) => d !== ms).length }
}

export interface FreqDay {
  day: string
  start: number
  /** Readings a full day holds on this clock (5,760 at 15 s; 5,520 or 6,000 on clock-change days). */
  expected: number | null
  held: number
  narrow: number
  statutory: number
  low: { t: number; v: number } | null
  high: { t: number; v: number } | null
}

/** Every UK day in the window, held or not, with its readings outside each band. */
export function freqDays(model: SeriesModel, def: SeriesDef, window: DateRange): FreqDay[] {
  const byDay = new Map<number, FreqDay>()
  const days = datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    const d: FreqDay = {
      day,
      start,
      expected: stepsInDay(start, model.stepMs),
      held: 0,
      narrow: 0,
      statutory: 0,
      low: null,
      high: null,
    }
    byDay.set(start, d)
    return d
  })
  for (const r of model.rows) {
    const v = r[def.field]
    if (typeof v !== 'number') continue
    const d = byDay.get(londonMidnight(r.t))
    if (!d) continue
    d.held += 1
    if (outside(v, NARROW)) d.narrow += 1
    if (outside(v, STATUTORY)) d.statutory += 1
    if (!d.low || v < d.low.v) d.low = { t: r.t, v }
    if (!d.high || v > d.high.v) d.high = { t: r.t, v }
  }
  return days
}

export interface Spell {
  start: number
  last: number
  n: number
  side: 'low' | 'high'
  /** The reading furthest from 50 Hz in the spell. */
  furthest: { t: number; v: number }
}

/**
 * Runs of consecutive readings outside the narrower band on one side. A
 * missing reading ends a run: what the frequency did then isn't known.
 */
export function spellsOutside(rows: WideRow[], def: SeriesDef, stepMs: number): Spell[] {
  const out: Spell[] = []
  let run: Spell | null = null
  for (const r of rows) {
    const v = r[def.field]
    const side = typeof v !== 'number' ? null : v < NARROW[0] ? 'low' : v > NARROW[1] ? 'high' : null
    if (typeof v !== 'number' || side === null) {
      run = null
      continue
    }
    if (run && run.side === side && r.t - run.last === stepMs) {
      run.last = r.t
      run.n += 1
      if (Math.abs(v - NOMINAL_HZ) > Math.abs(run.furthest.v - NOMINAL_HZ)) run.furthest = { t: r.t, v }
    } else {
      run = { start: r.t, last: r.t, n: 1, side, furthest: { t: r.t, v } }
      out.push(run)
    }
  }
  return out
}

export interface GapRun {
  start: number
  last: number
  n: number
}

/** Runs of consecutive steps with no reading held, on the rows' own clock. */
export function gapRuns(rows: WideRow[], def: SeriesDef): GapRun[] {
  const out: GapRun[] = []
  let run: GapRun | null = null
  for (const r of rows) {
    const v = r[def.field]
    if (typeof v === 'number') {
      run = null
      continue
    }
    if (run) {
      run.last = r.t
      run.n += 1
    } else {
      run = { start: r.t, last: r.t, n: 1 }
      out.push(run)
    }
  }
  return out
}

/** One downsampled row, as a noun: `15-minute mean`. */
export function meanNoun(stepMs: number | null): string {
  return stepMs ? meansText(stepMs).replace(/s$/, '') : 'mean'
}

/** The period a downsampled row covers: `quarter-hour`, `half-hour`, `hour`, else `30-minute period`. */
export function periodNoun(stepMs: number | null): string {
  if (stepMs === 15 * MINUTE_MS) return 'quarter-hour'
  if (stepMs === 30 * MINUTE_MS) return 'half-hour'
  if (stepMs === HOUR_MS) return 'hour'
  return stepMs ? `${meanNoun(stepMs).replace(/ mean$/, '')} period` : 'period'
}

/** `1 min 15 s`, `45 s`, `2 h 5 min`: a span counted from readings. */
export function spanText(ms: number): string {
  const s = Math.round(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return m ? `${h} h ${m} min` : `${h} h`
  if (m) return sec ? `${m} min ${sec} s` : `${m} min`
  return `${sec} s`
}
