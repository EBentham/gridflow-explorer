/**
 * What the redispatch panels share: the column, the zones' names and
 * colours (the same as on ENTSO-E's load and generation pages, so a zone
 * keeps its colour across the Explorer), and the figures read off the
 * quarter-hours held. Nothing is filled in. A missing quarter-hour is a gap,
 * never 0 MW; a stretch ends at one, and says so.
 */
import { HOUR_MS, datesBetween, dayStart, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { GroupSpec, PageContext } from '../../define'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'

export const DATASET = 'redispatching_internal'
export const QUANTITY = 'quantity_mw'
export const AREA = 'in_area_code'

/** ENTSO-E's area codes (EIC) for the zones held, as gridflow's area list names them. */
export const ZONES: GroupSpec[] = [
  { value: '10YNL----------L', label: 'Netherlands', color: 'var(--fuel-wind)' },
  { value: '10YBE----------2', label: 'Belgium', color: 'var(--fuel-pumped_storage)' },
]

export const zoneName = (area: string | null) => ZONES.find((z) => z.value === area)?.label ?? area ?? 'Blank'

/** The zones read in this window: every series the response holds, in the key's order. */
export const zonesOf = (model: SeriesModel | null): SeriesDef[] => (model ? model.all.filter((d) => d.from === 'self') : [])

/** How a stretch's edge was met: a held 0 MW, a quarter-hour not held, or the window's edge. */
export type Edge = 'zero' | 'gap' | 'window'

export interface Stretch {
  zone: SeriesDef
  /** The first quarter-hour redispatching (held, not 0 MW), and the start of the last one. */
  start: number
  last: number
  /** The end of the last quarter-hour. */
  end: number
  steps: number
  peak: { t: number; v: number }
  /** MW summed over the stretch's quarter-hours. */
  sumMw: number
  before: Edge
  after: Edge
}

export interface ZoneFigures {
  zone: SeriesDef
  held: number
  /** Quarter-hours held at a value other than 0 MW: redispatching. */
  active: number
  /** MW summed over the quarter-hours held. */
  sumMw: number
  peak: { t: number; v: number } | null
  stretches: Stretch[]
}

/** MW over a step, as MWh: each quarter-hour's MW times a quarter of an hour. */
export const mwh = (sumMw: number, stepMs: number) => (sumMw * stepMs) / HOUR_MS

/**
 * One zone's figures over the rows: quarter-hours held and redispatching
 * (held at a value other than 0 MW), the peak, the MW summed, and the
 * stretches of consecutive quarter-hours redispatching. A held 0 MW or a quarter-hour not held ends a stretch; which of
 * the two, or the window's edge, is kept for each end. Only on a regular
 * clock read as held, not as means.
 */
export function zoneFigures(model: SeriesModel, def: SeriesDef): ZoneFigures | null {
  const step = model.stepMs
  if (step === null || model.bucketed) return null
  const out: ZoneFigures = { zone: def, held: 0, active: 0, sumMw: 0, peak: null, stretches: [] }
  let open: Stretch | null = null
  // What came just before the current row: the window's edge until a row is read.
  let prev: Edge = 'window'
  let prevT: number | null = null
  const close = (edge: Edge) => {
    if (open) {
      open.after = edge
      out.stretches.push(open)
      open = null
    }
  }
  for (const row of model.rows) {
    // A row that doesn't follow the last one by one step has a missing step between them.
    if (prevT !== null && row.t - prevT !== step) {
      close('gap')
      prev = 'gap'
    }
    prevT = row.t
    const raw = row[def.field]
    const v = typeof raw === 'number' ? raw / def.unit.factor : null
    if (v === null) {
      close('gap')
      prev = 'gap'
      continue
    }
    out.held += 1
    out.sumMw += v
    if (!out.peak || v > out.peak.v) out.peak = { t: row.t, v }
    if (v !== 0) {
      out.active += 1
      if (open) {
        open.last = row.t
        open.end = row.t + step
        open.steps += 1
        open.sumMw += v
        if (v > open.peak.v) open.peak = { t: row.t, v }
      } else {
        open = { zone: def, start: row.t, last: row.t, end: row.t + step, steps: 1, peak: { t: row.t, v }, sumMw: v, before: prev, after: 'window' }
      }
      prev = 'zero'
    } else {
      close('zero')
      prev = 'zero'
    }
  }
  close('window')
  return out
}

export interface ZoneDay {
  held: number
  active: number
  sumMw: number
}

/** Per UK day of the window, one zone's quarter-hours held, those redispatching, and the MW summed. */
export function zoneDays(model: SeriesModel, def: SeriesDef, window: DateRange): { day: string; start: number; expected: number | null; z: ZoneDay }[] {
  const byDay = new Map<number, ZoneDay>()
  for (const row of model.rows) {
    const raw = row[def.field]
    if (typeof raw !== 'number') continue
    const v = raw / def.unit.factor
    const d = londonMidnight(row.t)
    const s = byDay.get(d) ?? { held: 0, active: 0, sumMw: 0 }
    s.held += 1
    s.sumMw += v
    if (v !== 0) s.active += 1
    byDay.set(d, s)
  }
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    return { day, start, expected: stepsInDay(start, model.stepMs), z: byDay.get(start) ?? { held: 0, active: 0, sumMw: 0 } }
  })
}

/** Figures for every zone in the window; empty when the rows are means or irregular. */
export function allFigures(ctx: PageContext): ZoneFigures[] {
  const model = ctx.series
  if (!model) return []
  return zonesOf(model)
    .map((d) => zoneFigures(model, d))
    .filter((f): f is ZoneFigures => f !== null)
}

const MW_DIGITS = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 })
const MWH_DIGITS = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })

const minus = (s: string) => s.replace('-', '−')

/** MW as published, to at most two decimals (Belgium's values run to the hundredth), with a true minus. */
export const mwText = (v: number) => minus(MW_DIGITS.format(v))
export const mwhText = (v: number) => minus(MWH_DIGITS.format(v))
