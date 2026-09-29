/**
 * What the physical notifications page's panels share: the columns it reads,
 * the one unit a reader asks for, each unit's fuel as Elexon's availability
 * forecast lists it, and the lines, sums and counts the panels draw.
 *
 * Every figure comes from the rows as read. A half-hour a unit holds no
 * level for is left out of its mean, lowest, highest and counts, never read
 * as zero, and a sum across units is taken only where every unit holds one.
 * Only the start levels are drawn: gridflow keeps one run of each
 * half-hour's notification, the first, so the end level it holds is the
 * half-hour's end only when the unit notified one run (the page's caveat,
 * and NEEDS.md, say so).
 */
import { FUEL_BANDS, fuelVar } from '../../../design/fuels'
import { datesBetween, dayStart, londonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { RowsResponse, Scalar } from '../../contract'
import type { PageContext, RelatedData } from '../../define'
import type { ChartPanel } from '../../_template/SeriesChart'
import { daySummaries, type DaySummary, type SeriesDef, type SeriesModel, type WideRow } from '../../_template/seriesModel'
import { relatedFilters, type SourcePart } from '../../_template/panelHelpers'
import { displayUnit } from '../../_template/units'

// ---------------------------------------------------------------- columns and keys

/** The level notified for the start of each half-hour, MW. */
export const START = 'level_from'
/** The level at the end of the half-hour's first run as kept, MW (see the caveat). */
export const END = 'level_to'
/** The balancing mechanism unit: the dataset's one column to split or filter by. */
export const UNIT = 'bm_unit_id'

/** Elexon's 2 to 14 day availability forecast, read for the fuel it lists against each unit. */
export const FUEL_KEY = 'fuel'
export const FUEL_DATASET = 'uou2t14d'
export const FUEL_COLUMN = 'fuel_type'
export const FUEL_VALUE = 'output_usable_mw'

/** Elexon's market index price, APXMIDP (the dataset's default provider). */
export const PRICE_KEY = 'price'
export const PRICE_DATASET = 'mid'
export const PRICE = 'market_index_price'
/** The price that traded, in the chart language's colour for an outturn, as on the power stack page. */
export const PRICE_COLOR = 'var(--chart-actual)'

/** The page's own URL parameter: the one unit to read alone. */
export const UNIT_PARAM = 'unit'

/** How many units the backend keeps when no unit is asked for (its `default_top_n`, `LIMIT 20`). */
export const TOP_N = 20

/** Every chart on the page takes this value-axis width, so their clocks line up. */
export const AXIS_WIDTH = 56

/** A stack of many units reads in GW; one unit's level keeps MW (DESIGN §6). */
export const GW = displayUnit('MW', 'GW')
export const MW = displayUnit('MW', 'MW')

const collator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' })

// ---------------------------------------------------------------- the unit asked for

/** What the rows endpoint takes as a filter value: letters, digits, spaces and `_ . - / :`, 1 to 64 of them. */
const UNIT_ID = /^[A-Za-z0-9 _.\-/:]{1,64}$/

/** A unit id the endpoint can filter by, trimmed; null for anything else. */
export function validUnit(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  return UNIT_ID.test(v) ? v : null
}

/** The unit read alone: the filter the rows came back with, or, before they arrive, the one the address asks for. */
export function unitShown(ctx: PageContext): string | null {
  if (ctx.response) {
    const f = ctx.response.filters?.[UNIT]
    return f === null || f === undefined ? null : String(f)
  }
  return validUnit(ctx.param(UNIT_PARAM))
}

/** The units the backend kept by default, largest first, as its truncation reason names them. */
export function topIds(response: RowsResponse | null): string[] {
  const reason = response?.truncation?.reasons.find((r) => r.type === 'default_top_n')
  const ids = reason?.selected_ids
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []
}

// ---------------------------------------------------------------- fuel

export interface Fuel {
  /** Elexon's fuel code as the availability forecast holds it; null when it lists none, or more than one. */
  code: string | null
  label: string
  /** A token: the design's fuel band, or a neutral ink where the fuel isn't known. */
  color: string
  /** Its place in the stack, bottom first: the design's fuel bands, then codes the page doesn't know, then no fuel. */
  order: number
}

/** Elexon's fuel codes on the design's fuel bands, as the generation mix folds them. `INT…` codes are interconnectors. */
const BAND_OF: Record<string, string> = {
  NUCLEAR: 'nuclear',
  NPSHYD: 'hydro',
  BIOMASS: 'biomass',
  WIND: 'wind',
  CCGT: 'gas',
  OCGT: 'peaking',
  COAL: 'peaking',
  OIL: 'peaking',
  OTHER: 'other',
  PS: 'pumped_storage',
}

/** The peaking band's own fuels, named as the generation mix names them. */
const PEAKING_LABELS: Record<string, string> = { OCGT: 'Gas (OCGT)', COAL: 'Coal', OIL: 'Oil' }

/** No fuel colour for a fuel the page can't name: the chart's neutral ink, as the power stack page uses for its floor. */
const NEUTRAL = 'var(--chart-tick)'

export const NO_FUEL: Fuel = { code: null, label: 'Fuel not listed', color: NEUTRAL, order: FUEL_BANDS.length + 2 }
const MIXED_FUEL: Fuel = { code: null, label: 'More than one fuel listed', color: NEUTRAL, order: FUEL_BANDS.length + 1 }

/** A fuel code's name, colour and place in the stack; a code the page doesn't know keeps its code as its name. */
export function fuelOf(code: string): Fuel {
  const band = code.startsWith('INT') ? 'imports' : BAND_OF[code]
  const i = band ? FUEL_BANDS.findIndex((b) => b.key === band) : -1
  if (i < 0) return { code, label: code, color: NEUTRAL, order: FUEL_BANDS.length }
  const label = band === 'imports' ? 'Interconnector' : (PEAKING_LABELS[code] ?? FUEL_BANDS[i].label)
  return { code, label, color: fuelVar(FUEL_BANDS[i].key), order: i }
}

export interface FuelLookup {
  /** The availability forecast's read: the lookup is empty until it has data. */
  rel: RelatedData | undefined
  /** Each unit the forecast lists, with its fuel code; null where its rows in the window name more than one. */
  codes: Map<string, string | null>
}

const lookups = new WeakMap<RowsResponse, Map<string, string | null>>()

/** Each unit's fuel, from the availability forecast read beside the page. Its rows for missing days carry no fuel and are passed over. */
export function fuelLookup(ctx: PageContext): FuelLookup {
  const rel = ctx.related[FUEL_KEY]
  const response = rel?.response ?? null
  if (!response) return { rel, codes: new Map() }
  let codes = lookups.get(response)
  if (!codes) {
    codes = new Map()
    for (const r of response.rows) {
      const id = r[UNIT]
      const code = r[FUEL_COLUMN]
      if (typeof id !== 'string' || typeof code !== 'string' || code === '') continue
      const had = codes.get(id)
      if (had === undefined) codes.set(id, code)
      else if (had !== null && had !== code) codes.set(id, null)
    }
    lookups.set(response, codes)
  }
  return { rel, codes }
}

/** A unit's fuel as the forecast lists it. */
export function fuelFor(lookup: FuelLookup, unit: string): Fuel {
  if (!lookup.codes.has(unit)) return NO_FUEL
  const code = lookup.codes.get(unit)
  return code ? fuelOf(code) : MIXED_FUEL
}

/** Every unit the forecast lists, fuel by fuel in stack order, then by id: the unit picker's list. */
export function listedUnits(lookup: FuelLookup): { id: string; fuel: Fuel }[] {
  return [...lookup.codes.keys()]
    .map((id) => ({ id, fuel: fuelFor(lookup, id) }))
    .sort((a, b) => a.fuel.order - b.fuel.order || a.fuel.label.localeCompare(b.fuel.label) || collator.compare(a.id, b.id))
}

/** The id as the forecast lists it, matched without regard to case; the id as typed when it lists none. */
export function listedId(lookup: FuelLookup, typed: string): string {
  if (lookup.codes.has(typed)) return typed
  const lower = typed.toLowerCase()
  return [...lookup.codes.keys()].find((id) => id.toLowerCase() === lower) ?? typed
}

// ---------------------------------------------------------------- the units' lines

export interface UnitLine {
  id: string
  /** Its start levels in the page's series model, MW. */
  def: SeriesDef
  /** Its end levels as kept, MW, when the rows hold the column. */
  end: SeriesDef | undefined
  fuel: Fuel
}

/** Stack order: fuel by fuel from the bottom, and within a fuel the smallest mean first, so the largest tops its fuel's band. */
function stackOrder(a: UnitLine, b: UnitLine): number {
  return a.fuel.order - b.fuel.order || a.fuel.label.localeCompare(b.fuel.label) || (a.def.mean ?? -Infinity) - (b.def.mean ?? -Infinity) || collator.compare(a.id, b.id)
}

/** The units the rows hold, each with its fuel, in stack order (bottom first). One unit read alone gives one line. */
export function unitLines(ctx: PageContext): UnitLine[] {
  const model = ctx.series
  if (!model) return []
  const lookup = fuelLookup(ctx)
  const one = unitShown(ctx) ?? ''
  const idOf = (d: SeriesDef) => d.group ?? one
  const ends = new Map(model.all.filter((d) => d.column === END).map((d) => [idOf(d), d]))
  return model.all
    .filter((d) => d.column === START)
    .map((def) => ({ id: idOf(def), def, end: ends.get(idOf(def)), fuel: fuelFor(lookup, idOf(def)) }))
    .sort(stackOrder)
}

/** The line the key has selected, when the page draws many. */
export function focusedLine(ctx: PageContext, lines: UnitLine[]): UnitLine | undefined {
  return lines.length > 1 ? lines.find((l) => l.id === ctx.focus) : undefined
}

/** The one level a line holds in every half-hour it holds, when it never moves; null when it moves or holds none. */
export function flatLevel(line: UnitLine | undefined): number | null {
  if (!line || !line.def.count || line.def.min === null) return null
  return line.def.min === line.def.max ? line.def.min : null
}

/** A line as a chart series: named by its unit, coloured by its fuel. */
function asSeries(line: UnitLine, unit = MW): SeriesDef {
  const scale = (v: number | null) => (v === null ? null : v * unit.factor)
  return { ...line.def, key: line.id, label: line.id, color: line.fuel.color, unit, mean: scale(line.def.mean), min: scale(line.def.min), max: scale(line.def.max) }
}

/** Every unit's start levels stacked, in GW, fuel by fuel: the top of the stack is these units' sum, where each holds a level. */
export function stackPanel(model: SeriesModel, lines: UnitLine[], height: number): ChartPanel {
  const rows = model.rows.map((r) => {
    const out: WideRow = { t: r.t }
    for (const l of lines) {
      const v = r[l.def.field]
      if (v !== undefined) out[l.def.field] = typeof v === 'number' ? v * GW.factor : null
    }
    return out
  })
  return {
    rows,
    series: lines.map((l) => asSeries(l, GW)),
    mark: 'stacked',
    unit: GW,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    height,
    zero: true,
    axisWidth: AXIS_WIDTH,
  }
}

/** One unit's start levels as a line, in MW, with its highest and lowest labelled when they differ. */
export function linePanel(model: SeriesModel, line: UnitLine, height: number): ChartPanel {
  const def = asSeries(line)
  return {
    rows: model.rows,
    series: [def],
    mark: 'line',
    unit: MW,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    height,
    zero: true,
    // A level held flat all window has no highest or lowest worth a label: the key says it held one level.
    extremes: def.min !== def.max ? def : null,
    axisWidth: AXIS_WIDTH,
  }
}

// ---------------------------------------------------------------- the price read beside it

export interface PriceSeries {
  model: SeriesModel
  def: SeriesDef
}

/** The market index price read for the window, when it holds a value. */
export function priceSeries(ctx: PageContext): PriceSeries | null {
  const model = ctx.related[PRICE_KEY]?.series ?? null
  const def = model?.all.find((d) => d.column === PRICE)
  return model && def && def.count > 0 ? { model, def } : null
}

/** The price on the chart's clock, under the levels; runs below zero banded. */
export function pricePanel(price: PriceSeries, height: number): ChartPanel {
  const { model, def } = price
  return {
    rows: model.rows,
    series: [def],
    mark: 'line',
    unit: def.unit,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    height,
    belowZero: def.min !== null && def.min < 0 ? def : null,
    axisWidth: AXIS_WIDTH,
  }
}

/** Whether the price comes at the levels' own step, so a half-hour's price can stand beside its level. */
export function sameClock(model: SeriesModel, price: PriceSeries | null): price is PriceSeries {
  return price !== null && price.model.stepMs === model.stepMs && price.model.bucketed === model.bucketed
}

/** How many of the window's half-hours (or means) hold a price, of how many it has; null where its periods straddle UK days. */
export function priceCover(price: PriceSeries, window: DateRange): { held: number; expected: number } | null {
  const days = daySummaries(price.model, window, price.def)
  if (!days.length || days.some((d) => d.expected === null)) return null
  return { held: days.reduce((s, d) => s + d.held, 0), expected: days.reduce((s, d) => s + (d.expected ?? 0), 0) }
}

/** The price at each time it holds one. */
export function priceAt(price: PriceSeries): Map<number, number> {
  const out = new Map<number, number>()
  for (const r of price.model.rows) {
    const v = r[price.def.field]
    if (typeof v === 'number') out.set(r.t, v)
  }
  return out
}

// ---------------------------------------------------------------- figures

/** A cell's number, or null for a gap. */
export const num = (v: Scalar | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

export interface Levels {
  /** Half-hours (or means) holding a start level. */
  held: number
  /** Of those, how many sit at zero, above it and below it. */
  zero: number
  above: number
  below: number
}

/** How a unit's held start levels split around zero. */
export function levelsOf(model: SeriesModel, def: SeriesDef): Levels {
  const out: Levels = { held: 0, zero: 0, above: 0, below: 0 }
  for (const r of model.rows) {
    const v = r[def.field]
    if (typeof v !== 'number') continue
    out.held += 1
    if (v > 0) out.above += 1
    else if (v < 0) out.below += 1
    else out.zero += 1
  }
  return out
}

export interface FullSum {
  t: number
  /** MW. */
  sum: number
  /** By fuel label, MW. */
  byFuel: Map<string, number>
}

/** The latest time every line holds a start level at, with their sum and each fuel's part: no sum is taken over a missing unit. */
export function latestFullSum(model: SeriesModel, lines: UnitLine[]): FullSum | null {
  if (!lines.length) return null
  for (let i = model.rows.length - 1; i >= 0; i -= 1) {
    const r = model.rows[i]
    const values = lines.map((l) => r[l.def.field])
    if (!values.every((v) => typeof v === 'number')) continue
    const byFuel = new Map<string, number>()
    let sum = 0
    lines.forEach((l, j) => {
      const v = values[j] as number
      sum += v
      byFuel.set(l.fuel.label, (byFuel.get(l.fuel.label) ?? 0) + v)
    })
    return { t: r.t, sum, byFuel }
  }
  return null
}

/** The latest start level a line holds, and when. */
export function latestOf(model: SeriesModel, def: SeriesDef): { t: number; v: number } | null {
  for (let i = model.rows.length - 1; i >= 0; i -= 1) {
    const v = model.rows[i][def.field]
    if (typeof v === 'number') return { t: model.rows[i].t, v }
  }
  return null
}

export interface UnitDay extends DaySummary {
  zero: number
  /** The mean market index price over the half-hours of the day it holds, when it is on the levels' clock. */
  price: number | null
  priceHeld: number
}

/** Each UK day of the window: the unit's start levels held, their mean, lowest and highest, the half-hours at zero, and the day's mean price. */
export function unitDays(model: SeriesModel, window: DateRange, def: SeriesDef, price: PriceSeries | null): UnitDay[] {
  const zeros = new Map<number, number>()
  for (const r of model.rows) {
    if (r[def.field] === 0) zeros.set(londonMidnight(r.t), (zeros.get(londonMidnight(r.t)) ?? 0) + 1)
  }
  const prices = new Map<number, { sum: number; n: number }>()
  if (price && sameClock(model, price)) {
    for (const r of price.model.rows) {
      const v = r[price.def.field]
      if (typeof v !== 'number') continue
      const d = londonMidnight(r.t)
      const p = prices.get(d) ?? { sum: 0, n: 0 }
      p.sum += v
      p.n += 1
      prices.set(d, p)
    }
  }
  return daySummaries(model, window, def).map((d) => {
    const p = prices.get(d.start)
    return { ...d, zero: zeros.get(d.start) ?? 0, price: p ? p.sum / p.n : null, priceHeld: p?.n ?? 0 }
  })
}

export interface Pair {
  t: number
  /** Price, £/MWh. */
  x: number
  /** Start level, MW. */
  y: number
}

/** Each half-hour holding both a start level and a price, paired; nothing is paired across a gap. */
export function pricePairs(model: SeriesModel, def: SeriesDef, price: PriceSeries): Pair[] {
  const at = priceAt(price)
  const out: Pair[] = []
  for (const r of model.rows) {
    const y = r[def.field]
    const x = at.get(r.t)
    if (typeof y === 'number' && x !== undefined) out.push({ t: r.t, x, y })
  }
  return out
}

export interface PriceSplit {
  label: string
  n: number
  mean: number
}

/** The mean price over the paired half-hours where the unit's start level sat above zero, at zero and below it. */
export function priceSplit(pairs: Pair[]): PriceSplit[] {
  const parts: [string, (y: number) => boolean][] = [
    ['Above zero', (y) => y > 0],
    ['At zero', (y) => y === 0],
    ['Below zero', (y) => y < 0],
  ]
  return parts.flatMap(([label, test]) => {
    const xs = pairs.filter((p) => test(p.y)).map((p) => p.x)
    return xs.length ? [{ label, n: xs.length, mean: xs.reduce((s, x) => s + x, 0) / xs.length }] : []
  })
}

/** The days a window holds, as UK midnights, for "held N of M days" words. */
export function windowDays(window: DateRange): number[] {
  return datesBetween(window.start, window.end).map(dayStart)
}

// ---------------------------------------------------------------- source lines

/** The availability forecast in a source line: its fuel column, by unit. */
export function fuelPart(ctx: PageContext): SourcePart {
  const rel = ctx.related[FUEL_KEY]
  return { source: rel?.source ?? null, dataset: FUEL_DATASET, columns: [FUEL_COLUMN], by: UNIT }
}

/** The market index price in a source line: its column, the provider it is cut to, its unit. */
export function pricePart(ctx: PageContext): SourcePart {
  const rel = ctx.related[PRICE_KEY]
  return { source: rel?.source ?? null, dataset: PRICE_DATASET, columns: [PRICE], filters: rel ? relatedFilters(rel) : null, unit: '£/MWh' }
}
