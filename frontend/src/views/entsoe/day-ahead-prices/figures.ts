/**
 * What the day-ahead page's panels share: its columns, the five zones in
 * words, and the figures read from the rows the template built
 * (`ctx.series`).
 *
 * The rows come on a mixed clock: the continental zones price each
 * quarter-hour and Ireland (SEM) each hour, so the response has no single
 * step (`grain_ms` null) and the backend marks no missing step with a null.
 * Each zone's own step is read from its own rows here, and every figure is
 * counted on that zone's own clock. Nothing is filled in: a step a zone
 * doesn't hold gets a null (a gap), never a value.
 */
import { clock, dayStart, datesBetween, HOUR_MS, londonMidnight, MINUTE_MS, stepNoun, stepsInDay } from '../../../design/time'
import { CHART } from '../../../design/chartTheme'
import type { DateRange } from '../../../lib/range'
import type { GroupSpec } from '../../define'
import type { SeriesDef, SeriesModel, WideRow } from '../../_template/seriesModel'

export const PRICE = 'price_eur_mwh'
export const AREA = 'area_code'

/** The GB benchmark, read beside the zones for the same window. */
export const GB_KEY = 'gb'
export const GB_PRICE = 'benchmark_price_gbp_mwh'
export const GB_ROUTE = '/sources/gold/gb-day-ahead-benchmark-from-the-market-index-price'

/** Both chart panels take this value-axis width, so their clocks line up. */
export const AXIS_WIDTH = 56

const QUARTER_MS = 15 * MINUTE_MS

export interface Zone {
  /** The EIC code the rows carry in `area_code`. */
  value: string
  /** gridflow's name for it (`connectors/entsoe/area_codes.py`). */
  label: string
  /** The name inside a sentence. */
  prose: string
  color: string
  /** The step the research card found for it: PT15M on the continent, PT60M for Ireland (SEM). */
  cardStep: number
}

/**
 * The zones gridflow reads, in the order of its `DEFAULT_ZONES` (GB is the
 * sixth, and ENTSO-E answers nothing for it). Each keeps one colour from the
 * series tokens; `--chart-price` is left to GB's benchmark, as on its own page.
 */
export const ZONES: Zone[] = [
  { value: '10YFR-RTE------C', label: 'France', prose: 'France', color: 'var(--chart-price-2)', cardStep: QUARTER_MS },
  { value: '10YNL----------L', label: 'Netherlands', prose: 'the Netherlands', color: 'var(--fuel-wind)', cardStep: QUARTER_MS },
  { value: '10YBE----------2', label: 'Belgium', prose: 'Belgium', color: 'var(--fuel-imports)', cardStep: QUARTER_MS },
  { value: '10Y1001A1001A82H', label: 'Germany / Luxembourg', prose: 'Germany / Luxembourg', color: 'var(--fuel-pumped_storage)', cardStep: QUARTER_MS },
  { value: '10Y1001A1001A59C', label: 'Ireland (SEM)', prose: 'Ireland (SEM)', color: 'var(--fuel-biomass)', cardStep: HOUR_MS },
]

export const GROUPS: GroupSpec[] = ZONES.map(({ value, label, color }) => ({ value, label, color }))

/** A column's series in a model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null | undefined, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

export interface Point {
  t: number
  v: number
}

export interface ZoneFigures {
  /** The EIC code. */
  value: string
  label: string
  prose: string
  color: string
  /** Its series, when the rows hold it in this window. */
  def: SeriesDef | null
  /** Its step: the rows' own spacing (the bucket when they are means), else the card's; null when neither is known. */
  step: number | null
  /** Its held values in the window, in time order. */
  points: Point[]
  /** Steps its clock has in the window; null when the step doesn't divide an hour. */
  expected: number | null
  mean: number | null
  low: Point | null
  high: Point | null
  latest: Point | null
  /** Held values below zero. */
  below: number
  /** Its longest run of consecutive held steps below zero. */
  longestBelow: { start: number; last: number; n: number; min: number } | null
}

/** The smallest spacing between a zone's own held times: its step, as a gap only ever widens a spacing. */
function ownStep(points: Point[]): number | null {
  let best: number | null = null
  for (let i = 1; i < points.length; i += 1) {
    const d = points[i].t - points[i - 1].t
    if (d > 0 && (best === null || d < best)) best = d
  }
  return best
}

/** Steps a clock of `step` has over the window's UK days (clock changes included). */
function stepsInWindow(window: DateRange, step: number | null): number | null {
  if (step === null) return null
  let n = 0
  for (const day of datesBetween(window.start, window.end)) {
    const s = stepsInDay(dayStart(day), step)
    if (s === null) return null
    n += s
  }
  return n
}

/** The runs of consecutive held steps below zero on a zone's own clock; a gap ends a run. */
export function runsBelow(points: Point[], step: number | null): { start: number; last: number; n: number; min: number }[] {
  if (step === null) return []
  const out: { start: number; last: number; n: number; min: number }[] = []
  let run: (typeof out)[number] | null = null
  for (const p of points) {
    if (p.v < 0) {
      if (run && p.t - run.last <= step) {
        run.last = p.t
        run.n += 1
        run.min = Math.min(run.min, p.v)
      } else {
        run = { start: p.t, last: p.t, n: 1, min: p.v }
        out.push(run)
      }
    } else run = null
  }
  return out
}

/**
 * Every zone of the five, and any other the rows hold, with its figures for
 * the window, in the zones' order. A zone the window holds nothing of is
 * listed too, with no values, so that it is said rather than dropped.
 */
export function zoneFigures(model: SeriesModel, window: DateRange): ZoneFigures[] {
  const own = model.all.filter((d) => d.from === 'self')
  const known = ZONES.map((z) => ({ zone: z, def: own.find((d) => d.group === z.value) ?? null }))
  const extra = own.filter((d) => !ZONES.some((z) => z.value === d.group)).map((d) => ({ zone: null, def: d }))
  return [...known, ...extra].map(({ zone, def }) => {
    const points: Point[] = []
    if (def) {
      for (const row of model.rows) {
        const v = row[def.field]
        if (typeof v === 'number') points.push({ t: row.t, v })
      }
    }
    const step = model.bucketed ? model.stepMs : (ownStep(points) ?? zone?.cardStep ?? null)
    let sum = 0
    let low: Point | null = null
    let high: Point | null = null
    for (const p of points) {
      sum += p.v
      if (!low || p.v < low.v) low = p
      if (!high || p.v > high.v) high = p
    }
    const runs = runsBelow(points, step)
    const longestBelow = runs.reduce<(typeof runs)[number] | null>((a, r) => (a === null || r.n > a.n ? r : a), null)
    const value = zone?.value ?? def?.group ?? ''
    return {
      value,
      label: zone?.label ?? def?.label ?? value,
      prose: zone?.prose ?? def?.label ?? value,
      color: zone?.color ?? def?.color ?? 'var(--chart-price-2)',
      def,
      step,
      points,
      expected: stepsInWindow(window, step),
      mean: points.length ? sum / points.length : null,
      low,
      high,
      latest: points.at(-1) ?? null,
      below: points.filter((p) => p.v < 0).length,
      longestBelow,
    }
  })
}

/** What one step of a zone's clock is called: `quarter-hours`, `hours`, or `hourly means` for bucketed rows. */
export function zoneNoun(z: Pick<ZoneFigures, 'step'>, bucketed: boolean): string {
  if (bucketed) return z.step === HOUR_MS ? 'hourly means' : 'means'
  return stepNoun(z.step)
}

/** How often a zone is priced, in words: `per quarter-hour`, `per hour`. */
export function perStep(step: number | null): string {
  if (step === QUARTER_MS) return 'per quarter-hour'
  if (step === HOUR_MS) return 'per hour'
  if (step === null) return 'step not known'
  return `every ${Math.round(step / MINUTE_MS)} minutes`
}

// ---------------------------------------------------------------- days

export interface ZoneDay {
  day: string
  /** London midnight starting the day. */
  start: number
  expected: number | null
  held: number
  mean: number | null
  low: Point | null
  high: Point | null
  below: number
}

/** Every UK day of the window with one zone's held values: a day it holds nothing of is listed, with none held. */
export function zoneDays(z: ZoneFigures, window: DateRange, bucketed: boolean): ZoneDay[] {
  const byDay = new Map<number, Point[]>()
  for (const p of z.points) {
    const d = londonMidnight(p.t)
    const list = byDay.get(d)
    if (list) list.push(p)
    else byDay.set(d, [p])
  }
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    const points = byDay.get(start) ?? []
    let sum = 0
    let low: Point | null = null
    let high: Point | null = null
    for (const p of points) {
      sum += p.v
      if (!low || p.v < low.v) low = p
      if (!high || p.v > high.v) high = p
    }
    // Bucket means longer than an hour straddle UK days: no count is expected of them.
    const expected = bucketed && z.step !== null && z.step > HOUR_MS ? null : stepsInDay(start, z.step)
    return { day, start, expected, held: points.length, mean: points.length ? sum / points.length : null, low, high, below: points.filter((p) => p.v < 0).length }
  })
}

// ---------------------------------------------------------------- gaps

/**
 * The rows with each zone's missing steps marked: every step of the zone's
 * own clock inside the window that it holds no value for gets a null, so
 * that its line breaks there instead of running straight across a day it
 * doesn't hold. A zone's clock is laid from its own first held time. The
 * model's rows are left as they are.
 */
export function markGaps(model: SeriesModel, zones: ZoneFigures[], domain: [number, number]): WideRow[] {
  const byT = new Map<number, WideRow>(model.rows.map((r) => [r.t, { ...r }]))
  for (const z of zones) {
    if (!z.def || z.step === null || z.step <= 0) continue
    const step = z.step
    const anchor = z.points[0]?.t ?? domain[0]
    const first = anchor - Math.floor((anchor - domain[0]) / step) * step
    for (let t = first; t < domain[1]; t += step) {
      let row = byT.get(t)
      if (!row) {
        row = { t }
        byT.set(t, row)
      }
      if (typeof row[z.def.field] !== 'number') row[z.def.field] = null
    }
  }
  return [...byT.values()].sort((a, b) => a.t - b.t)
}

// ---------------------------------------------------------------- coverage in words

const nameList = (names: string[], last: 'and' | 'or') => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ${last} ${names.at(-1)}`)

/**
 * A day of the window that some zone holds only in part, or holds nothing
 * of while another zone holds some, in words: `Mon 21 Sep holds 92 of 96
 * quarter-hours for France, the Netherlands and Belgium, and 23 of 24 hours
 * for Ireland (SEM).` Null for a day every zone holds in full, or none
 * holds at all (the template counts those).
 */
function dayNote(label: string, entries: { prose: string; held: number; expected: number | null; noun: string }[]): string | null {
  const some = entries.filter((e) => e.held > 0)
  const part = entries.filter((e) => e.held > 0 && e.expected !== null && e.held < e.expected)
  const none = entries.filter((e) => e.held === 0)
  if (!some.length || (!part.length && !none.length)) return null
  const groups = new Map<string, string[]>()
  for (const e of part) {
    const k = `${e.held} of ${e.expected} ${e.noun}`
    groups.set(k, [...(groups.get(k) ?? []), e.prose])
  }
  const bits = [...groups.entries()].map(([k, names]) => `${k} for ${nameList(names, 'and')}`)
  if (none.length) bits.push(`nothing for ${nameList(none.map((e) => e.prose), 'or')}`)
  if (!part.length) {
    // Only whole days and empty ones: name the zones held in full.
    return `${label} is held in full for ${nameList(some.map((e) => e.prose), 'and')}, and ${bits.join('')}.`
  }
  const said = bits.length > 1 ? `${bits.slice(0, -1).join(', ')}, and ${bits.at(-1)}` : bits[0]
  return `${label} holds ${said}.`
}

/**
 * The window's days that some zone holds only in part, in words, zone by
 * zone on each zone's own clock: the template's coverage line can't count
 * them, as the rows have no single step. At most three days are named (the
 * first two and the last); the rest are counted.
 */
export function partialDaySentences(zones: ZoneFigures[], window: DateRange, bucketed: boolean, dayLabel: (ms: number) => string): string[] {
  const perZone = zones.map((z) => ({ z, days: zoneDays(z, window, bucketed), noun: zoneNoun(z, bucketed) }))
  const notes: string[] = []
  datesBetween(window.start, window.end).forEach((_, i) => {
    const start = perZone[0]?.days[i]?.start
    if (start === undefined) return
    const note = dayNote(
      dayLabel(start),
      perZone.map(({ z, days, noun }) => ({ prose: z.prose, held: days[i].held, expected: days[i].expected, noun })),
    )
    if (note) notes.push(note)
  })
  if (notes.length <= 3) return notes
  const rest = notes.length - 3
  return [...notes.slice(0, 2), `${rest === 1 ? 'One more day is' : `${rest} more days are`} held in part between them; the days table gives each zone's count.`, notes.at(-1) as string]
}

// ---------------------------------------------------------------- shape through the day

/** Minutes past midnight on the UK clock (a clock-change day's repeated hour shares its clock times). */
export function clockMinute(t: number): number {
  const [h, m] = clock(t).split(':').map(Number)
  return h * 60 + m
}

/** `14:30–14:45` for a clock time and a step in minutes. */
export function slotText(minute: number, stepMin: number): string {
  const f = (x: number) => `${String(Math.floor((x % 1440) / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
  return `${f(minute)}–${f(minute + stepMin)}`
}

export interface Slot {
  /** Minutes past midnight, UK clock. */
  minute: number
  /** Values held at this clock time in the window. */
  n: number
  mean: number | null
  low: Point | null
  high: Point | null
  /** The picked day's value at this clock time, when a day is picked. */
  day: number | null
}

/**
 * One zone's values gathered by UK clock time: a slot per step of its own
 * clock, each with how many values it holds and their mean, lowest and
 * highest. Null when its clock can't be read this way (a step longer than an
 * hour, or none).
 */
export function zoneProfile(z: ZoneFigures, picked: number | undefined): { slots: Slot[]; stepMin: number } | null {
  if (z.step === null || z.step > HOUR_MS || HOUR_MS % z.step !== 0) return null
  const stepMin = z.step / MINUTE_MS
  const acc = new Map<number, { n: number; sum: number; low: Point | null; high: Point | null; day: number | null }>()
  for (let m = 0; m < 1440; m += stepMin) acc.set(m, { n: 0, sum: 0, low: null, high: null, day: null })
  for (const p of z.points) {
    const s = acc.get(clockMinute(p.t))
    if (!s) continue
    s.n += 1
    s.sum += p.v
    if (!s.low || p.v < s.low.v) s.low = p
    if (!s.high || p.v > s.high.v) s.high = p
    // On the long clock-change day the repeated hour holds two values; the picked line shows the first.
    if (picked !== undefined && londonMidnight(p.t) === picked && s.day === null) s.day = p.v
  }
  return { slots: [...acc.entries()].map(([minute, s]) => ({ minute, n: s.n, mean: s.n ? s.sum / s.n : null, low: s.low, high: s.high, day: s.day })), stepMin }
}

/** The clock-time chart's lowest-to-highest band, and its key mark: the fan's two outer bands' weight. */
export const RANGE_OPACITY = CHART.fan.b90 + CHART.fan.b80
