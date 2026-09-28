/**
 * What the generation panels share: the columns and datasets, the zones and
 * production types in words, the page's own URL parameters, and the figures
 * read from the rows the template built (`ctx.series`).
 *
 * These rows come on mixed clocks: one zone or unit is published per
 * quarter-hour, another per hour, so a response has no single step
 * (`grain_ms` null) and the backend marks no missing step with a null. Each
 * series' own step is read from its own rows here (a `Track`), and every
 * figure is counted on that clock. Nothing is filled in: a step a series
 * doesn't hold gets a null (a gap), never a value, and a sum or a
 * difference is worked out only at the steps every part of it holds.
 */
import { SERIES_COLORS } from '../../../design/chartTheme'
import { plural } from '../../../design/format'
import { dayStart, datesBetween, HOUR_MS, londonMidnight, MINUTE_MS, stepNoun, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { GroupSpec, PageContext } from '../../define'
import { ENTSOE_PRODUCTION_TYPES } from '../../_template/codes'
import { seriesId, type SeriesDef, type SeriesModel, type WideRow } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'

// ---------------------------------------------------------------- datasets and columns

export const WS_ID = 'wind_solar_forecast'
export const TOTAL_ID = 'generation_forecast'
export const UNITS_ID = 'actual_generation_units'
export const LOAD_ID = 'load_forecast'

/** Both forecasts hold their figure in this column. */
export const FORECAST = 'generation_forecast_mw'
export const LOAD = 'load_forecast_mw'
export const OUTPUT = 'generation_mw'

export const AREA = 'area_code'
export const TYPE = 'production_type'
export const UNIT = 'unit_mrid'

/** Related datasets, by their key on this page. */
export const TOTAL_KEY = 'total'
export const LOAD_KEY = 'load'

/** The page's own URL parameters. */
export const ZONE_PARAM = 'zone'
export const TYPE_PARAM = 'type'

/** Chart panels on one page take this value-axis width, so their clocks line up. */
export const AXIS_WIDTH = 52

const QUARTER_MS = 15 * MINUTE_MS

// ---------------------------------------------------------------- zones

export interface Zone {
  /** The EIC code the rows carry in `area_code`. */
  value: string
  /** Its value in `?zone=`. */
  param: string
  label: string
  /** The name inside a sentence. */
  prose: string
  /** Its line on the total forecast chart; the same colours as the load page's zones. */
  color: string
  /** The step the research found for its forecasts, used only when its rows hold one point. */
  cardStep: number
}

const DE_LU: Zone = { value: '10Y1001A1001A82H', param: 'de-lu', label: 'Germany-Luxembourg', prose: 'Germany-Luxembourg', color: 'var(--chart-price)', cardStep: QUARTER_MS }
const FR: Zone = { value: '10YFR-RTE------C', param: 'fr', label: 'France', prose: 'France', color: 'var(--chart-price-2)', cardStep: QUARTER_MS }
const NL: Zone = { value: '10YNL----------L', param: 'nl', label: 'Netherlands', prose: 'the Netherlands', color: 'var(--fuel-wind)', cardStep: QUARTER_MS }
const BE: Zone = { value: '10YBE----------2', param: 'be', label: 'Belgium', prose: 'Belgium', color: 'var(--fuel-pumped_storage)', cardStep: HOUR_MS }
const IE: Zone = { value: '10Y1001A1001A59C', param: 'ie', label: 'Ireland (SEM)', prose: 'Ireland (SEM)', color: 'var(--fuel-biomass)', cardStep: HOUR_MS }

/** The zones each dataset holds rows for, largest first. */
export const WS_ZONES: Zone[] = [DE_LU, FR, NL, BE, IE]
export const TOTAL_ZONES: Zone[] = [DE_LU, FR, NL, BE]
export const UNIT_ZONES: Zone[] = [FR, NL, BE]

const ALL_ZONES = [DE_LU, FR, NL, BE, IE]

export const zoneGroups = (zones: Zone[]): GroupSpec[] => zones.map(({ value, label, color }) => ({ value, label, color }))

/** The zone a dataset reads from `?zone=`: its own first zone when the parameter names none of its zones. */
export function zoneFrom(params: URLSearchParams | ((name: string) => string | null), zones: Zone[]): Zone {
  const p = typeof params === 'function' ? params(ZONE_PARAM) : params.get(ZONE_PARAM)
  return zones.find((z) => z.param === p) ?? zones[0]
}

export const zoneByCode = (code: string | null | undefined): Zone | undefined => ALL_ZONES.find((z) => z.value === code)

/** The zone a page's rows are filtered to, as the response says. */
export function filteredZone(ctx: PageContext, zones: Zone[]): Zone {
  const code = ctx.response?.filters?.[AREA]
  return zoneByCode(typeof code === 'string' ? code : null) ?? zoneFrom(ctx.param, zones)
}

// ---------------------------------------------------------------- production types

export interface Fuel {
  code: string
  label: string
  /** Its colour token: the fuel it is (DESIGN §3). */
  color: string
}

/** The hatch the offshore-wind band is filled with (`WindHatch.tsx`). */
export const OFFSHORE_HATCH_ID = 'gen-wind-offshore-hatch'
/** The same hatch in CSS, for swatches: wind's colour crossed by the chart surface. */
export const OFFSHORE_STRIPE = 'repeating-linear-gradient(45deg, var(--fuel-wind) 0 3.5px, var(--chart-surface) 3.5px 5px)'

/** The wind and solar forecast's three types, stack order bottom first. */
export const WS_TYPES: (Fuel & { swatch: string; fill: string; prose: string })[] = [
  { code: 'B19', label: 'Wind onshore', prose: 'onshore wind', color: 'var(--fuel-wind)', swatch: 'var(--fuel-wind)', fill: 'var(--fuel-wind)' },
  { code: 'B18', label: 'Wind offshore', prose: 'offshore wind', color: 'var(--fuel-wind)', swatch: OFFSHORE_STRIPE, fill: `url(#${OFFSHORE_HATCH_ID})` },
  { code: 'B16', label: 'Solar', prose: 'solar', color: 'var(--fuel-solar)', swatch: 'var(--fuel-solar)', fill: 'var(--fuel-solar)' },
]

export const WIND_CODES = ['B18', 'B19']
export const SOLAR_CODE = 'B16'

/**
 * The production types the unit rows carry across France, the Netherlands
 * and Belgium, in DESIGN §3's stack order. A zone holding no unit of a type
 * shows the empty state for it, in words.
 */
export const UNIT_TYPES: Fuel[] = [
  { code: 'B14', label: 'Nuclear', color: 'var(--fuel-nuclear)' },
  { code: 'B11', label: 'Hydro run-of-river', color: 'var(--fuel-hydro)' },
  { code: 'B12', label: 'Hydro reservoir', color: 'var(--fuel-hydro)' },
  { code: 'B01', label: 'Biomass', color: 'var(--fuel-biomass)' },
  { code: 'B18', label: 'Wind offshore', color: 'var(--fuel-wind)' },
  { code: 'B04', label: 'Fossil gas', color: 'var(--fuel-gas)' },
  { code: 'B05', label: 'Fossil hard coal', color: 'var(--fuel-peaking)' },
  { code: 'B06', label: 'Fossil oil', color: 'var(--fuel-peaking)' },
  { code: 'B20', label: 'Other', color: 'var(--fuel-other)' },
  { code: 'B10', label: 'Hydro pumped storage', color: 'var(--fuel-pumped_storage)' },
  { code: 'B25', label: 'Energy storage', color: 'var(--fuel-pumped_storage)' },
]

export function typeFrom(params: URLSearchParams | ((name: string) => string | null)): Fuel {
  const p = typeof params === 'function' ? params(TYPE_PARAM) : params.get(TYPE_PARAM)
  return UNIT_TYPES.find((f) => f.code === p) ?? UNIT_TYPES[0]
}

/** ENTSO-E's own name for a type, with its code: `Fossil hard coal (B05)`. */
export const typeName = (code: string) => `${ENTSOE_PRODUCTION_TYPES[code] ?? code} (${code})`

/** The unit a page's rows are filtered to, as the response says. */
export function filteredType(ctx: PageContext): Fuel {
  const code = ctx.response?.filters?.[TYPE]
  return UNIT_TYPES.find((f) => f.code === code) ?? typeFrom(ctx.param)
}

/** Unit lines take the series tokens in turn (a unit has no colour of its own), after the model's order. */
export const unitColor = (i: number) => SERIES_COLORS[i % SERIES_COLORS.length]

// ---------------------------------------------------------------- tracks: a series on its own clock

export interface Point {
  t: number
  v: number
}

/** Held values on a clock of their own. */
export interface Clocked {
  step: number | null
  points: Point[]
}

export interface Track extends Clocked {
  def: SeriesDef
  /** Its step: the bucket when the rows are means, else the commonest spacing of its own held times; null when unknown. */
  step: number | null
  /** Its held values in the window, in time order. */
  points: Point[]
}

export function pointsOf(rows: WideRow[], def: SeriesDef): Point[] {
  const out: Point[] = []
  for (const r of rows) {
    const v = r[def.field]
    if (typeof v === 'number') out.push({ t: r.t, v })
  }
  return out
}

/** The commonest spacing between consecutive held times: a gap only ever adds a longer one. */
function ownStep(points: Point[]): number | null {
  const counts = new Map<number, number>()
  for (let i = 1; i < points.length; i += 1) {
    const d = points[i].t - points[i - 1].t
    if (d > 0) counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  let best: number | null = null
  let n = 0
  for (const [d, c] of counts) {
    if (c > n || (c === n && best !== null && d < best)) {
      best = d
      n = c
    }
  }
  return best
}

export function trackOf(model: SeriesModel, def: SeriesDef, fallback: number | null = null): Track {
  const points = pointsOf(model.rows, def)
  const step = model.bucketed ? model.stepMs : (ownStep(points) ?? fallback)
  return { def, step, points }
}

/** The one step every track shares, or null when they differ (a tooltip then names the instant). */
export function commonStep(tracks: Track[]): number | null {
  const steps = [...new Set(tracks.filter((k) => k.points.length).map((k) => k.step))]
  return steps.length === 1 ? (steps[0] ?? null) : null
}

/**
 * The rows with each track's missing steps marked: every step of the
 * track's own clock inside the window that it holds no value for gets a
 * null, so that its line breaks there instead of running straight across
 * days it doesn't hold. A track's clock is laid from its own first held
 * time. The rows given are left as they are.
 */
export function markGaps(rows: WideRow[], tracks: Track[], domain: [number, number]): WideRow[] {
  const byT = new Map<number, WideRow>(rows.map((r) => [r.t, { ...r }]))
  for (const k of tracks) {
    if (k.step === null || k.step <= 0 || !k.points.length) continue
    const step = k.step
    const anchor = k.points[0].t
    const first = anchor - Math.floor((anchor - domain[0]) / step) * step
    for (let t = first; t < domain[1]; t += step) {
      let row = byT.get(t)
      if (!row) {
        row = { t }
        byT.set(t, row)
      }
      if (typeof row[k.def.field] !== 'number') row[k.def.field] = null
    }
  }
  return [...byT.values()].sort((a, b) => a.t - b.t)
}

/**
 * A track's values on a coarser clock: each period of `step` starting at a
 * time in `times` gets the mean of the track's values inside it, only when
 * the track holds every one of its own steps there. On its own step it is
 * the values as held. Null when the clocks don't nest (a coarser track read
 * onto a finer clock would pass one value off as several).
 */
export function onClock(track: Clocked, step: number, times: Iterable<number>): Map<number, number> | null {
  const own = track.step
  const at = new Map(track.points.map((p) => [p.t, p.v]))
  const out = new Map<number, number>()
  if (own === null || own === step) {
    for (const t of times) {
      const v = at.get(t)
      if (v !== undefined) out.set(t, v)
    }
    return out
  }
  if (own > step || step % own !== 0) return null
  const n = step / own
  for (const t of times) {
    let sum = 0
    let held = 0
    for (let i = 0; i < n; i += 1) {
      const v = at.get(t + i * own)
      if (v === undefined) break
      sum += v
      held += 1
    }
    if (held === n) out.set(t, sum / n)
  }
  return out
}

/**
 * The sum of several tracks at each step every one of them holds, on the
 * coarsest of their clocks: a step any of them misses is a gap, never a
 * partial sum. Null when their clocks don't nest.
 */
export function sumTracks(tracks: Clocked[]): Clocked | null {
  const held = tracks.filter((k) => k.points.length)
  if (!held.length) return { step: null, points: [] }
  // A track of one point has no step of its own: it is read at its exact time.
  const step = Math.max(...held.map((k) => k.step ?? 0)) || null
  const coarse = held.find((k) => k.step === step) ?? held[0]
  const times = coarse.points.map((p) => p.t)
  const maps: Map<number, number>[] = []
  for (const k of held) {
    const m = onClock(k, step ?? 0, times)
    if (!m) return null
    maps.push(m)
  }
  const points: Point[] = []
  for (const t of times) {
    let sum = 0
    let all = true
    for (const m of maps) {
      const v = m.get(t)
      if (v === undefined) {
        all = false
        break
      }
      sum += v
    }
    if (all) points.push({ t, v: sum })
  }
  return { step, points }
}

export interface PairRow {
  t: number
  a: number | null
  b: number | null
  /** `a` less `b`, where both are held. */
  d: number | null
}

export interface Pair {
  /** The coarser of the two clocks, which both are read on. */
  step: number | null
  rows: PairRow[]
  /** The steps both hold. */
  both: Point[]
}

/**
 * Two series joined step for step on the coarser of their clocks (a finer
 * one averaged into it where it holds every step), with `a` less `b` where
 * both hold the step. Null when their clocks don't nest.
 */
export function joinPair(a: Clocked, b: Clocked): Pair | null {
  const step = Math.max(a.step ?? 0, b.step ?? 0) || null
  const coarse = (b.step ?? 0) > (a.step ?? 0) ? b : a
  const times = [...new Set([...coarse.points.map((p) => p.t), ...(coarse === a ? b : a).points.map((p) => p.t).filter((t) => step === null || coarse.points.length === 0 || (t - coarse.points[0].t) % step === 0)])].sort((x, y) => x - y)
  const am = onClock(a, step ?? 0, times)
  const bm = onClock(b, step ?? 0, times)
  if (!am || !bm) return null
  const both: Point[] = []
  const rows = times.flatMap((t) => {
    const av = am.get(t) ?? null
    const bv = bm.get(t) ?? null
    if (av === null && bv === null) return []
    const d = av !== null && bv !== null ? av - bv : null
    if (d !== null) both.push({ t, v: d })
    return [{ t, a: av, b: bv, d }]
  })
  return { step, rows, both }
}

// ---------------------------------------------------------------- days and coverage

export interface TrackDay {
  day: string
  start: number
  /** Steps its clock has in the day; null when unknown, or for means longer than an hour. */
  expected: number | null
  held: number
  points: Point[]
}

/** Every UK day of the window with one track's held values: a day holding none is listed too. */
export function trackDays(points: Point[], step: number | null, window: DateRange, bucketed: boolean): TrackDay[] {
  const byDay = new Map<number, Point[]>()
  for (const p of points) {
    const d = londonMidnight(p.t)
    const list = byDay.get(d)
    if (list) list.push(p)
    else byDay.set(d, [p])
  }
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    const held = byDay.get(start) ?? []
    const expected = bucketed && step !== null && step > HOUR_MS ? null : stepsInDay(start, step)
    return { day, start, expected, held: held.length, points: held }
  })
}

/** What one step of a track is called: `quarter-hours`, `hours`, or `half-hourly means` for bucketed rows. */
export function stepWords(step: number | null, bucketed: boolean): string {
  return bucketed && step ? meansText(step) : stepNoun(step)
}

/** How often a series is given, in words: `per quarter-hour`, `per hour`, `as half-hourly means`. */
export function perText(step: number | null, bucketed: boolean): string {
  if (bucketed && step) return `as ${meansText(step)}`
  if (step === QUARTER_MS) return 'per quarter-hour'
  if (step === HOUR_MS) return 'per hour'
  if (step === null) return 'at the times held'
  return `every ${Math.round(step / MINUTE_MS)} minutes`
}

export interface Stats {
  count: number
  mean: number | null
  low: Point | null
  high: Point | null
}

export function statsOf(points: Point[]): Stats {
  let sum = 0
  let low: Point | null = null
  let high: Point | null = null
  for (const p of points) {
    sum += p.v
    if (!low || p.v < low.v) low = p
    if (!high || p.v > high.v) high = p
  }
  return { count: points.length, mean: points.length ? sum / points.length : null, low, high }
}

const nameList = (names: string[], last: 'and' | 'or') => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} ${last} ${names.at(-1)}`)

export interface Tracked {
  prose: string
  step: number | null
  points: Point[]
}

/**
 * The window's days that some series holds only in part, series by series
 * on each one's own clock, in words: `Mon 21 Sep holds 4 of 96
 * quarter-hours for France, and nothing for Belgium.` The template's
 * coverage line can't count these, as the rows have no single step. At most
 * three days are named (the first two and the last); the rest are counted.
 */
export function partialDaySentences(series: Tracked[], window: DateRange, bucketed: boolean, dayLabel: (ms: number) => string): string[] {
  const per = series.map((s) => ({ s, days: trackDays(s.points, s.step, window, bucketed), noun: stepWords(s.step, bucketed) }))
  const notes: string[] = []
  datesBetween(window.start, window.end).forEach((_, i) => {
    const start = per[0]?.days[i]?.start
    if (start === undefined) return
    const entries = per.map(({ s, days, noun }) => ({ prose: s.prose, held: days[i].held, expected: days[i].expected, noun }))
    const some = entries.filter((e) => e.held > 0)
    const part = entries.filter((e) => e.held > 0 && e.expected !== null && e.held < e.expected)
    const none = entries.filter((e) => e.held === 0)
    if (!some.length || (!part.length && !none.length)) return
    const groups = new Map<string, string[]>()
    for (const e of part) {
      const k = `${e.held} of ${e.expected} ${e.noun}`
      groups.set(k, [...(groups.get(k) ?? []), e.prose])
    }
    const one = per.length === 1
    const bits = [...groups.entries()].map(([k, names]) => (one ? k : `${k} for ${nameList(names, 'and')}`))
    if (none.length) bits.push(`nothing for ${nameList(none.map((e) => e.prose), 'or')}`)
    const label = dayLabel(start)
    if (!part.length) {
      notes.push(`${label} is held in full for ${nameList(some.map((e) => e.prose), 'and')}, and ${bits.join('')}.`)
      return
    }
    const said = bits.length > 1 ? `${bits.slice(0, -1).join(', ')}, and ${bits.at(-1)}` : bits[0]
    notes.push(`${label} holds ${said}.`)
  })
  if (notes.length <= 3) return notes
  const rest = notes.length - 3
  return [...notes.slice(0, 2), `${rest === 1 ? 'One more day is' : `${plural(rest, 'more day is', 'more days are')}`} held in part between them; the days table gives the counts.`, notes.at(-1) as string]
}

/** The time most of these latest values share, for a key to say once. */
export function commonLatest(times: (number | undefined)[]): number | undefined {
  const counts = new Map<number, number>()
  for (const t of times) if (t !== undefined) counts.set(t, (counts.get(t) ?? 0) + 1)
  let best: number | undefined
  let n = 0
  for (const [t, c] of counts) {
    if (c > n) {
      best = t
      n = c
    }
  }
  return best
}

// ---------------------------------------------------------------- focus

/** The series selected in the key, if it is one of these. */
export const focusedDef = (ctx: PageContext, defs: SeriesDef[]): SeriesDef | undefined => defs.find((d) => seriesId(d) === ctx.focus)
