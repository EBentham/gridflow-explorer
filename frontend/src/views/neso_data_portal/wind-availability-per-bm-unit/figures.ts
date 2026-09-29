/**
 * What the wind availability page's panels share: the columns it reads, the
 * one unit a reader asks for, and the figures the panels quote, all read from
 * the rows as they came back.
 *
 * The dataset holds one figure per wind BM unit per day: NESO's forecast of
 * the capacity that unit will have available that day, in MW. About 276
 * units a day is small enough to read whole, so the page reads every unit
 * for the window once and picks the top units, or the one unit asked for,
 * from those rows. A unit's missing day stays missing: it is left out of its
 * figures, never read as zero, and a day's total is drawn only where every
 * unit the window holds has a figure for it.
 */
import { SERIES_COLORS } from '../../../design/chartTheme'
import { HALF_HOUR, dayStart, fmtDay, instantLabel, nextLondonMidnight, ukDate, windowDomain } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { RowsResponse, Scalar } from '../../contract'
import type { PageContext, RelatedData } from '../../define'
import type { ChartPanel } from '../../_template/SeriesChart'
import { relatedFilters, type SourcePart } from '../../_template/panelHelpers'
import type { SeriesDef, SeriesModel, WideRow } from '../../_template/seriesModel'
import { displayUnit } from '../../_template/units'

// ---------------------------------------------------------------- columns and keys

/** The day each figure is for. */
export const DAY_COL = 'availability_date'
/** NESO's forecast available capacity of the unit for the day, MW. */
export const VALUE = 'availability_mw'
/** The wind BM unit, by its id as NESO lists it. */
export const UNIT = 'bmu_id'
/** When the file holding the row was published. */
export const PUBLISHED = 'published_at'

/** Elexon's generation by fuel type, wind only: GB wind output read beside the forecast. */
export const OUTPUT_KEY = 'output'
export const OUTPUT_SOURCE = 'elexon'
export const OUTPUT_DATASET = 'fuelhh'
export const OUTPUT = 'generation_mw'
export const OUTPUT_FILTER = { fuel_type: 'WIND' }

/** A forecast in the chart language's forecast colour; the output that happened in its outturn colour. */
export const AVAIL_COLOR = 'var(--chart-fan)'
export const OUTPUT_COLOR = 'var(--chart-actual)'
/** One unit read alone: the first series colour, as a single series takes it elsewhere. */
export const UNIT_COLOR = SERIES_COLORS[0]

/** The page's own URL parameter: the one unit to read alone. */
export const UNIT_PARAM = 'unit'

/** How many units the key lists by name, largest first; the table lists every one. */
export const TOP_N = 10

/** Every chart on the page takes this value-axis width. */
export const AXIS_WIDTH = 56

/** Totals over many units read in GW; one unit keeps MW (DESIGN §6). */
export const GW = displayUnit('MW', 'GW')
export const MW = displayUnit('MW', 'MW')

const collator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' })

// ---------------------------------------------------------------- the rows, read once

export interface DayValue {
  day: string
  v: number
}

export interface Unit {
  id: string
  /** Its figure for each held day of the window, MW; null where the row holds none. */
  values: Map<string, number | null>
  /** Days holding a figure. */
  held: number
  mean: number | null
  low: DayValue | null
  high: DayValue | null
  first: DayValue | null
  last: DayValue | null
  /** Held days whose figure differs from the unit's figure on the day before, when that day holds one too. */
  changes: number
}

export interface DayTotal {
  day: string
  /** Units holding a figure for the day. */
  held: number
  /** Their sum, MW. */
  sum: number
  /** Every unit the window holds has a figure for the day, so the sum is the total. */
  full: boolean
}

export interface Capture {
  /** The window's days holding a row, ascending. */
  days: string[]
  /** Every unit in the rows, largest mean first. */
  units: Unit[]
  byId: Map<string, Unit>
  /** Each held day's sum over the units holding a figure. */
  totals: DayTotal[]
  totalByDay: Map<string, DayTotal>
  /** When the files the rows come from were published, ISO, oldest first. */
  published: string[]
  /** The days between publication and the day a figure is for, lowest and highest, where both are known. */
  ahead: { min: number; max: number } | null
  /** Rows naming no unit: left out of every figure, and said. */
  blankUnit: number
}

const num = (v: Scalar | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Whole days from `a` to `b`, both `YYYY-MM-DD`. */
function daysApart(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

function unitOf(id: string, values: Map<string, number | null>, days: string[]): Unit {
  let held = 0
  let sum = 0
  let low: DayValue | null = null
  let high: DayValue | null = null
  let first: DayValue | null = null
  let last: DayValue | null = null
  let changes = 0
  let prev: number | null = null
  for (const day of days) {
    const v = values.get(day)
    if (v === undefined || v === null) {
      prev = null
      continue
    }
    held += 1
    sum += v
    if (!low || v < low.v) low = { day, v }
    if (!high || v > high.v) high = { day, v }
    if (!first) first = { day, v }
    last = { day, v }
    if (prev !== null && v !== prev) changes += 1
    prev = v
  }
  return { id, values, held, mean: held ? sum / held : null, low, high, first, last, changes }
}

const captures = new WeakMap<RowsResponse, Capture>()

/** The rows as the page reads them: each unit's figure per day, each day's total, and when they were published. */
export function captureOf(response: RowsResponse | null): Capture | null {
  if (!response) return null
  const cached = captures.get(response)
  if (cached) return cached
  const perUnit = new Map<string, Map<string, number | null>>()
  const daySet = new Set<string>()
  const published = new Set<string>()
  let blankUnit = 0
  let aheadMin = Infinity
  let aheadMax = -Infinity
  for (const r of response.rows) {
    const id = r[UNIT]
    const day = r[DAY_COL]
    if (typeof day !== 'string' || !DAY_RE.test(day)) continue
    if (typeof id !== 'string' || id === '') {
      blankUnit += 1
      continue
    }
    daySet.add(day)
    const values = perUnit.get(id) ?? new Map<string, number | null>()
    values.set(day, num(r[VALUE]))
    perUnit.set(id, values)
    const pub = r[PUBLISHED]
    if (typeof pub === 'string' && pub) {
      published.add(pub)
      const t = Date.parse(pub)
      if (Number.isFinite(t)) {
        const gap = daysApart(ukDate(t), day)
        aheadMin = Math.min(aheadMin, gap)
        aheadMax = Math.max(aheadMax, gap)
      }
    }
  }
  const days = [...daySet].sort()
  const units = [...perUnit].map(([id, values]) => unitOf(id, values, days))
  units.sort((a, b) => (b.mean ?? -Infinity) - (a.mean ?? -Infinity) || collator.compare(a.id, b.id))
  const totals = days.map((day) => {
    let held = 0
    let sum = 0
    for (const u of units) {
      const v = u.values.get(day)
      if (typeof v !== 'number') continue
      held += 1
      sum += v
    }
    return { day, held, sum, full: held === units.length }
  })
  const out: Capture = {
    days,
    units,
    byId: new Map(units.map((u) => [u.id, u])),
    totals,
    totalByDay: new Map(totals.map((t) => [t.day, t])),
    published: [...published].sort(),
    ahead: Number.isFinite(aheadMin) ? { min: aheadMin, max: aheadMax } : null,
    blankUnit,
  }
  captures.set(response, out)
  return out
}

/** The page's rows, read once. */
export const captureFrom = (ctx: PageContext) => captureOf(ctx.response)

// ---------------------------------------------------------------- the unit asked for

/** The unit the address asks for, as the rows name it (matched without regard to case); null when none is asked for. */
export function unitAsked(ctx: PageContext): string | null {
  const v = (ctx.param(UNIT_PARAM) ?? '').trim()
  return v ? v : null
}

/** The unit held in the rows that the address asks for, or null. */
export function unitShown(ctx: PageContext): Unit | null {
  const asked = unitAsked(ctx)
  const cap = captureFrom(ctx)
  if (!asked || !cap) return null
  return cap.byId.get(asked) ?? cap.units.find((u) => u.id.toLowerCase() === asked.toLowerCase()) ?? null
}

/** A unit is asked for but the rows don't hold it. */
export function unitMissing(ctx: PageContext): string | null {
  const asked = unitAsked(ctx)
  return asked && captureFrom(ctx) && !unitShown(ctx) ? asked : null
}

// ---------------------------------------------------------------- words

/** `Thu 20 Aug 2026, 22:20 BST`: one publication time, or the first and last. */
export function publishedText(cap: Capture): string | null {
  const times = cap.published.map((p) => Date.parse(p)).filter((t) => Number.isFinite(t))
  if (!times.length) return null
  const first = instantLabel(times[0], { year: true })
  if (times.length === 1) return first
  return `${times.length} files, ${first} to ${instantLabel(times[times.length - 1], { year: true })}`
}

/** `2 to 14 days` after publication. */
export function aheadText(cap: Capture): string | null {
  if (!cap.ahead) return null
  const { min, max } = cap.ahead
  const d = (n: number) => `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`
  return min === max ? d(min) : `${min} to ${d(max)}`
}

export const dayText = (day: string) => fmtDay(day)

/** A change in MW with a true sign: `+834 MW`, `−400 MW`. */
export function signedMw(v: number): string {
  if (v === 0) return 'no change'
  return `${v > 0 ? '+' : ''}${MW.format(v)}`
}

// ---------------------------------------------------------------- charts

/**
 * The window's clock on the page's step: every half-hour of every UK day, or
 * the output's own step where it comes back as means. A day's figure is for
 * the whole day, so each of its half-hours carries it and the line holds it
 * flat from midnight to midnight.
 */
function clockOf(window: DateRange, step: number): number[] {
  const [from, to] = windowDomain(window.start, window.end)
  const out: number[] = []
  for (let t = from; t < to && out.length < 20_000; t += step) out.push(t)
  return out
}

/** The GB wind output read beside the page, when it holds a value. */
export interface OutputSeries {
  model: SeriesModel
  def: SeriesDef
}

export function outputSeries(ctx: PageContext): OutputSeries | null {
  const model = ctx.related[OUTPUT_KEY]?.series ?? null
  const def = model?.all.find((d) => d.column === OUTPUT)
  return model && def && def.count > 0 ? { model, def } : null
}

const AVAIL_FIELD = 'avail'

function availDef(label: string, unit = GW, color = AVAIL_COLOR): SeriesDef {
  return { key: AVAIL_FIELD, field: AVAIL_FIELD, column: VALUE, group: null, label, color, unit, from: 'self', count: 0, mean: null, min: null, max: null, signed: false }
}

/**
 * The total forecast available, in GW, held flat across each day every unit
 * has a figure for, with GB wind output on the same axis where it is held.
 */
export function totalPanel(cap: Capture, window: DateRange, output: OutputSeries | null, height: number): ChartPanel {
  const step = output && output.model.stepMs && output.model.stepMs > HALF_HOUR ? output.model.stepMs : HALF_HOUR
  const outAt = new Map<number, number | null>()
  if (output) for (const r of output.model.rows) outAt.set(r.t, typeof r[output.def.field] === 'number' ? (r[output.def.field] as number) : null)
  const rows: WideRow[] = clockOf(window, step).map((t) => {
    const total = cap.totalByDay.get(ukDate(t))
    const row: WideRow = { t, [AVAIL_FIELD]: total?.full ? total.sum * GW.factor : null }
    if (output && outAt.has(t)) row[output.def.field] = outAt.get(t) ?? null
    return row
  })
  const series = [availDef(`Forecast available, all ${cap.units.length} units`)]
  if (output) series.push({ ...output.def, label: 'GB wind output', color: OUTPUT_COLOR })
  return { rows, series, mark: 'line', unit: GW, stepMs: step, bucketed: false, settlement: null, height, zero: true, extremes: null, axisWidth: AXIS_WIDTH }
}

/** One unit's figure in MW, held flat across each day it has one. */
export function unitPanel(unit: Unit, window: DateRange, height: number): ChartPanel {
  const rows: WideRow[] = clockOf(window, HALF_HOUR).map((t) => {
    const v = unit.values.get(ukDate(t))
    return { t, [AVAIL_FIELD]: typeof v === 'number' ? v : null }
  })
  return {
    rows,
    series: [availDef(`${unit.id}, forecast available`, MW, UNIT_COLOR)],
    mark: 'line',
    unit: MW,
    stepMs: HALF_HOUR,
    bucketed: false,
    settlement: null,
    height,
    zero: true,
    extremes: null,
    axisWidth: AXIS_WIDTH,
  }
}

/** How much of the window the output holds, in its own steps. */
export function outputCover(output: OutputSeries, window: DateRange): { held: number; days: number } {
  const [from, to] = windowDomain(window.start, window.end)
  const days = new Set<string>()
  let held = 0
  for (const r of output.model.rows) {
    if (r.t < from || r.t >= to || typeof r[output.def.field] !== 'number') continue
    held += 1
    days.add(ukDate(r.t))
  }
  return { held, days: days.size }
}

/** The day's UK midnight, for the chart's picked-day band. */
export const midnightOf = (day: string) => dayStart(day)

/** The UK day a picked midnight starts, or null. */
export const pickedDay = (ctx: PageContext): string | null => (ctx.picked === undefined ? null : ukDate(ctx.picked))

/** The picked day's end, for words. */
export const dayEnd = (day: string) => nextLondonMidnight(dayStart(day))

// ---------------------------------------------------------------- source lines

/** GB wind output in a source line: its column, the fuel it is cut to, its unit. */
export function outputPart(ctx: PageContext): SourcePart {
  const rel: RelatedData | undefined = ctx.related[OUTPUT_KEY]
  return { source: rel?.source ?? null, dataset: OUTPUT_DATASET, columns: [OUTPUT], filters: rel ? relatedFilters(rel) : OUTPUT_FILTER, unit: 'GW' }
}
