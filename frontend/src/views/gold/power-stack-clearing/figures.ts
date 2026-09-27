/**
 * What the power stack page's panels share: the columns of the three stack
 * datasets and of the market index read beside them, the run the page reads,
 * each fuel's name and colour, and the figures the panels quote. Every figure
 * comes from the rows as held: a half-hour missing a value is left out of a
 * mean or a count, never read as zero, and nothing here re-derives what
 * gridflow's model computed.
 */
import { niceTicks, type Scale } from '../../../design/format'
import { datesBetween, dayStart, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { Scalar, SeriesRow } from '../../contract'
import type { PageContext, QuerySpec } from '../../define'

// ---------------------------------------------------------------- the run

/** The column naming the model run's version and set-up. */
export const POLICY = 'vintage_policy_id'
/** The published headline run. gridflow also holds an earlier version of it for the same half-hours. */
export const HEADLINE = 'smp_headline_perfect_prog_v2'
/** One row per half-hour: the headline run, pinned, so its split is one value and the columns are the series. */
export const RUN_QUERY: QuerySpec = { group: POLICY, filters: { [POLICY]: HEADLINE } }

// ---------------------------------------------------------------- columns

export const CLEARING_DATASET = 'gold_stack_clearing'
export const RESIDUAL_DATASET = 'gold_stack_residual_demand'
export const CURVE_DATASET = 'gold_stack_supply_curve_points'
export const MARKET_DATASET = 'gold_gb_day_ahead_benchmark'

// gold_stack_clearing
export const PRICE = 'clearing_price_gbp_per_mwh'
export const DEMAND = 'clearing_demand_mw'
export const CAPACITY = 'total_available_capacity_mw'
export const FLOOR = 'price_floor_gbp_per_mwh'
export const AT_FLOOR = 'floor_binding'
export const MARGINAL_FUEL = 'marginal_fuel_type'
export const MARGINAL_UNIT = 'marginal_bm_unit_id'

// gold_gb_day_ahead_benchmark
export const MARKET = 'benchmark_price_gbp_mwh'

// gold_stack_residual_demand
export const INDO = 'indo_mw'
export const WIND = 'wind_mw'
export const SOLAR = 'solar_mw'
export const RESIDUAL = 'residual_demand_mw'
export const HYDRO = 'netted_NPSHYD_mw'
export const OTHER = 'netted_OTHER_mw'
export const PUMPED = 'netted_PS_mw'
/** The interconnectors netted off demand, by their Elexon generation-by-fuel codes. */
export const INTERCONNECTOR_CODES = ['INTELEC', 'INTEW', 'INTFR', 'INTGRNL', 'INTIFA2', 'INTIRL', 'INTNED', 'INTNEM', 'INTNSL', 'INTVKL'] as const
export const INTERCONNECTORS: string[] = INTERCONNECTOR_CODES.map((c) => `netted_${c}_mw`)

// gold_stack_supply_curve_points
export const COST = 'marginal_cost_gbp_per_mwh'
export const AVAILABLE = 'available_capacity_mw'
export const CUMULATIVE = 'cumulative_capacity_mw'
export const RANK = 'merit_order_rank'
export const PROVENANCE = 'cost_provenance'
export const UNIT = 'bm_unit_id'
export const FUEL = 'fuel_type'

// ---------------------------------------------------------------- drawing

/** Every chart's value axis takes this width, so charts stacked in different panels share a clock. */
export const AXIS_WIDTH = 52

/** The market index: the price that actually traded, drawn in the chart language's colour for an outturn. */
export const MARKET_COLOR = 'var(--chart-actual)'
/** The model's own figures: its clearing price and where its stack clears. */
export const MODEL_COLOR = 'var(--chart-fan-soft)'

export interface FuelStyle {
  label: string
  color: string
}

/**
 * Each fuel's name and colour, the page's one legend for all three views:
 * the design's fuel bands (coal and OCGT are its peaking band), and solar in
 * its own colour. The stack holds no solar unit today; solar is netted off
 * demand on the residual view.
 */
const FUELS: Record<string, FuelStyle> = {
  BIOMASS: { label: 'Biomass', color: 'var(--fuel-biomass)' },
  NUCLEAR: { label: 'Nuclear', color: 'var(--fuel-nuclear)' },
  CCGT: { label: 'Gas (CCGT)', color: 'var(--fuel-gas)' },
  COAL: { label: 'Coal', color: 'var(--fuel-peaking)' },
  OCGT: { label: 'Gas (OCGT)', color: 'var(--fuel-peaking)' },
  SOLAR: { label: 'Solar', color: 'var(--fuel-solar)' },
}

/** A fuel type's name and colour; one the page doesn't know keeps its code. */
export function fuelStyle(code: string | null): FuelStyle {
  if (code === null) return { label: 'Fuel not held', color: 'var(--fuel-other)' }
  return FUELS[code] ?? { label: code, color: 'var(--fuel-other)' }
}

/** A fuel in a sentence: `gas (CCGT)`, `nuclear`; a code the page doesn't know as held. */
export function fuelWords(code: string | null): string {
  const style = fuelStyle(code)
  if (code === null || !(code in FUELS)) return style.label
  return style.label.charAt(0).toLowerCase() + style.label.slice(1)
}

/** Where no unit set the price: the model's floor. A neutral chart ink, never a fuel's colour. */
export const FLOOR_STYLE: FuelStyle = { label: 'The price floor', color: 'var(--chart-tick)' }

// ---------------------------------------------------------------- reading cells

export const num = (v: Scalar | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
export const str = (v: Scalar | undefined): string | null => (typeof v === 'string' && v !== '' ? v : null)
const bool = (v: Scalar | undefined): boolean | null => (typeof v === 'boolean' ? v : null)

// ---------------------------------------------------------------- links between the views

/**
 * The address of the supply curve for one UK day, at one half-hour of it
 * when given. A day is its lightest read (a row per unit per half-hour), so
 * links into the curve open one day. The theme carries over; nothing else
 * does, as the clearing view's own settings mean nothing there.
 */
export function curveSearch(current: URLSearchParams, day: string, at?: number): string {
  const next = new URLSearchParams()
  const theme = current.get('theme')
  if (theme) next.set('theme', theme)
  next.set('dataset', CURVE_DATASET)
  next.set('from', day)
  next.set('to', day)
  if (at !== undefined) next.set('at', String(at))
  return `?${next.toString()}`
}

/** The current address with the window set to the days the published run covers. */
export function publishedSearch(current: URLSearchParams, first: string, last: string): string {
  const next = new URLSearchParams(current)
  next.delete('days')
  next.set('from', first)
  next.set('to', last)
  return `?${next.toString()}`
}

/** Whether the family's supply-curve dataset is held, so a link to it leads somewhere. */
export const curveHeld = (ctx: PageContext): boolean => Boolean(ctx.family.datasets.find((d) => d.id === CURVE_DATASET)?.held)

/** A related dataset's rows, when they were read. */
export function relatedRows(ctx: PageContext, key: string): SeriesRow[] | null {
  const response = ctx.related[key]?.response
  return response?.kind === 'series' ? response.rows : null
}

/** The page's own series rows, when they were read. */
export function ownRows(ctx: PageContext): SeriesRow[] {
  return ctx.response?.kind === 'series' ? ctx.response.rows : []
}

// ---------------------------------------------------------------- clearing

/** One half-hour of the clearing run, with the market index price at the same time. */
export interface ClearingPoint {
  t: number
  /** The modelled clearing price, £/MWh. */
  model: number | null
  /** The market index price, £/MWh. */
  market: number | null
  /** The demand the stack clears against, MW. */
  demand: number | null
  /** Priced capacity available in the stack, MW. */
  capacity: number | null
  /** The price floor in force, £/MWh. */
  floor: number | null
  /** True where the floor set the price, false where a unit's cost did, null when not held. */
  atFloor: boolean | null
  /** The fuel and unit whose cost set the price; null at the floor or when not held. */
  fuel: string | null
  unit: string | null
}

/** Each held half-hour of the clearing rows, oldest first, joined by time to the market index rows. */
export function clearingPoints(rows: SeriesRow[], market: SeriesRow[] | null): ClearingPoint[] {
  const marketAt = new Map<number, number | null>()
  for (const r of market ?? []) marketAt.set(r.ts, num(r[MARKET]))
  return rows
    .map((r) => ({
      t: r.ts,
      model: num(r[PRICE]),
      market: marketAt.get(r.ts) ?? null,
      demand: num(r[DEMAND]),
      capacity: num(r[CAPACITY]),
      floor: num(r[FLOOR]),
      atFloor: bool(r[AT_FLOOR]),
      fuel: str(r[MARGINAL_FUEL]),
      unit: str(r[MARGINAL_UNIT]),
    }))
    .sort((a, b) => a.t - b.t)
}

/** What set a half-hour's price: a fuel, the floor, or nothing held. */
export function setterOf(p: Pick<ClearingPoint, 'atFloor' | 'fuel'>): { key: string; style: FuelStyle } | null {
  if (p.atFloor === true) return { key: 'floor', style: FLOOR_STYLE }
  if (p.fuel !== null) return { key: p.fuel, style: fuelStyle(p.fuel) }
  return null
}

/** Runs of consecutive half-hours where the floor set the price, as their first and last times. */
export function floorRuns(points: ClearingPoint[], stepMs: number | null): { start: number; last: number }[] {
  if (stepMs === null) return []
  const out: { start: number; last: number }[] = []
  let run: { start: number; last: number } | null = null
  for (const p of points) {
    if (p.atFloor === true) {
      if (run && p.t - run.last <= stepMs) run.last = p.t
      else {
        run = { start: p.t, last: p.t }
        out.push(run)
      }
    } else run = null
  }
  return out
}

export interface Mean {
  mean: number | null
  n: number
}

export function meanOf(values: (number | null)[]): Mean {
  let sum = 0
  let n = 0
  for (const v of values) {
    if (v === null) continue
    sum += v
    n += 1
  }
  return { mean: n ? sum / n : null, n }
}

export interface Stats extends Mean {
  min: number | null
  max: number | null
}

/** The mean, lowest and highest of the values held; nulls are left out. */
export function statsOf(values: (number | null)[]): Stats {
  let min: number | null = null
  let max: number | null = null
  for (const v of values) {
    if (v === null) continue
    min = min === null ? v : Math.min(min, v)
    max = max === null ? v : Math.max(max, v)
  }
  return { ...meanOf(values), min, max }
}

/** Modelled minus market, where both are held; null otherwise. */
export const gapOf = (p: ClearingPoint): number | null => (p.model !== null && p.market !== null ? p.model - p.market : null)

/** How many half-hours each fuel, or the floor, set the price in; most first. */
export function setterCounts(points: ClearingPoint[]): { key: string; style: FuelStyle; n: number }[] {
  const counts = new Map<string, { key: string; style: FuelStyle; n: number }>()
  for (const p of points) {
    const s = setterOf(p)
    if (!s) continue
    const c = counts.get(s.key) ?? { ...s, n: 0 }
    c.n += 1
    counts.set(s.key, c)
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.style.label.localeCompare(b.style.label))
}

/**
 * Whether the floor set the price exactly where clearing demand was below
 * zero, over the half-hours holding both: the rows' own evidence for how the
 * floor bound in this window, said only when it holds without exception.
 */
export function floorMatchesNegativeDemand(points: ClearingPoint[]): boolean {
  let floors = 0
  for (const p of points) {
    if (p.atFloor === null || p.demand === null) continue
    if (p.atFloor !== (p.demand < 0)) return false
    if (p.atFloor) floors += 1
  }
  return floors > 0
}

/** The distinct floor prices held in the window, lowest first. */
export function floorPrices(points: ClearingPoint[]): number[] {
  return [...new Set(points.map((p) => p.floor).filter((v): v is number => v !== null))].sort((a, b) => a - b)
}

/**
 * The price axis. `full` spans every value held. Otherwise it spans the
 * market index and the prices the stack set, and where the floor set a
 * modelled price below that it adds one step under zero: the line runs off
 * the foot of the chart there, so the stack's prices stay readable.
 */
export function priceScale(points: ClearingPoint[], full: boolean): { scale: Scale; clipped: boolean } {
  let lo = 0
  let hi = 0
  let floorLow = Infinity
  for (const p of points) {
    if (p.market !== null) {
      lo = Math.min(lo, p.market)
      hi = Math.max(hi, p.market)
    }
    if (p.model === null) continue
    if (full || p.atFloor !== true) {
      lo = Math.min(lo, p.model)
      hi = Math.max(hi, p.model)
    } else floorLow = Math.min(floorLow, p.model)
  }
  const scale = niceTicks(lo, hi)
  if (full || floorLow >= scale.domain[0]) return { scale, clipped: false }
  const step = scale.ticks[1] - scale.ticks[0]
  const bottom = scale.domain[0] - step
  return { scale: { domain: [bottom, scale.domain[1]], ticks: [bottom, ...scale.ticks] }, clipped: true }
}

/** One UK day of the clearing run and the market beside it. */
export interface ClearingDay {
  day: string
  start: number
  /** Half-hours the day has on the UK clock; null off a regular clock. */
  expected: number | null
  /** Half-hours holding a modelled price. */
  held: number
  model: Mean
  market: Mean
  gap: Mean
  atFloor: number
  /** The fuel that set the price in most of the day's half-hours set by a unit. */
  mostly: { key: string; style: FuelStyle; n: number } | null
}

export function clearingDays(points: ClearingPoint[], window: DateRange, stepMs: number | null): ClearingDay[] {
  const byDay = new Map<number, ClearingPoint[]>()
  for (const p of points) {
    const d = londonMidnight(p.t)
    const list = byDay.get(d)
    if (list) list.push(p)
    else byDay.set(d, [p])
  }
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    const ps = byDay.get(start) ?? []
    const units = setterCounts(ps.filter((p) => p.atFloor !== true))
    return {
      day,
      start,
      expected: stepsInDay(start, stepMs),
      held: ps.filter((p) => p.model !== null).length,
      model: meanOf(ps.map((p) => p.model)),
      market: meanOf(ps.map((p) => p.market)),
      gap: meanOf(ps.map(gapOf)),
      atFloor: ps.filter((p) => p.atFloor === true).length,
      mostly: units[0] ?? null,
    }
  })
}

// ---------------------------------------------------------------- residual demand

/** The residual view's three lines, top of the waterfall first. */
export const LINE_COLUMNS = [INDO, RESIDUAL, DEMAND]

/** A piece of what comes off demand before the priced stack: one column, or the interconnectors together. */
export interface NetPiece {
  key: string
  label: string
  color: string
  columns: string[]
}

/**
 * Bottom of the stack first, in the design's fuel order (hydro, wind, other,
 * pumped storage, then imports), with solar beside wind, in the page legend's
 * solar colour.
 */
export const NET_PIECES: NetPiece[] = [
  { key: 'hydro', label: 'Hydro, not pumped', color: 'var(--fuel-hydro)', columns: [HYDRO] },
  { key: 'wind', label: 'Wind', color: 'var(--fuel-wind)', columns: [WIND] },
  { key: 'solar', label: 'Solar', color: fuelStyle('SOLAR').color, columns: [SOLAR] },
  { key: 'other', label: 'Other', color: 'var(--fuel-other)', columns: [OTHER] },
  { key: 'pumped', label: 'Pumped storage', color: 'var(--fuel-pumped_storage)', columns: [PUMPED] },
  { key: 'imports', label: 'Net imports', color: 'var(--fuel-imports)', columns: INTERCONNECTORS },
]

/** A piece's MW at a row: the sum of its columns when every one is held; null otherwise, never a part-sum. */
export function pieceValue(row: SeriesRow, piece: NetPiece): number | null {
  let sum = 0
  for (const c of piece.columns) {
    const v = num(row[c])
    if (v === null) return null
    sum += v
  }
  return sum
}

/**
 * The rows' own check of how the residual and clearing demand follow from
 * demand: residual = demand − wind − solar, and clearing = residual − the
 * netted columns. Counted over the half-hours holding every column; `worst`
 * is the largest difference found, MW.
 */
export function demandIdentity(rows: SeriesRow[]): { n: number; residual: number; clearing: number; worst: number } {
  const TOLERANCE_MW = 0.5
  let n = 0
  let residual = 0
  let clearing = 0
  let worst = 0
  const netted = [HYDRO, OTHER, PUMPED, ...INTERCONNECTORS]
  for (const r of rows) {
    const indo = num(r[INDO])
    const wind = num(r[WIND])
    const solar = num(r[SOLAR])
    const res = num(r[RESIDUAL])
    const clr = num(r[DEMAND])
    const parts = netted.map((c) => num(r[c]))
    if (indo === null || wind === null || solar === null || res === null || clr === null || parts.some((v) => v === null)) continue
    n += 1
    const a = Math.abs(indo - wind - solar - res)
    const b = Math.abs(res - parts.reduce<number>((s, v) => s + (v ?? 0), 0) - clr)
    worst = Math.max(worst, a, b)
    if (a <= TOLERANCE_MW) residual += 1
    if (b <= TOLERANCE_MW) clearing += 1
  }
  return { n, residual, clearing, worst }
}

// ---------------------------------------------------------------- the supply curve

/** One unit in the stack at one half-hour, as held. */
export interface CurveUnit {
  unit: string
  fuel: string | null
  rank: number
  /** £/MWh. */
  cost: number
  /** MW. */
  available: number
  /** MW through the merit order, this unit included, as held. */
  cumulative: number
  provenance: string | null
}

/** The half-hours holding at least one unit's cost, oldest first. */
export function curveTimes(rows: SeriesRow[]): number[] {
  const times = new Set<number>()
  for (const r of rows) if (num(r[COST]) !== null) times.add(r.ts)
  return [...times].sort((a, b) => a - b)
}

/** The half-hour the page shows: `?at=` when the window holds it, else the latest held. */
export function chosenTime(param: string | null, times: number[]): number | null {
  if (!times.length) return null
  const asked = param === null ? NaN : Number(param)
  return times.includes(asked) ? asked : times[times.length - 1]
}

/** The units held at one half-hour, in merit order; a unit missing any of its figures is left out, not zeroed. */
export function curveAt(rows: SeriesRow[], t: number): CurveUnit[] {
  const out: CurveUnit[] = []
  for (const r of rows) {
    if (r.ts !== t) continue
    const unit = str(r[UNIT])
    const cost = num(r[COST])
    const available = num(r[AVAILABLE])
    const cumulative = num(r[CUMULATIVE])
    const rank = num(r[RANK])
    if (unit === null || cost === null || available === null || cumulative === null || rank === null) continue
    out.push({ unit, fuel: str(r[FUEL]), rank, cost, available, cumulative, provenance: str(r[PROVENANCE]) })
  }
  return out.sort((a, b) => a.rank - b.rank)
}

/** The clearing run's half-hour at `t`, from the related clearing rows, with the market index beside it. */
export function clearingAt(ctx: PageContext, t: number): ClearingPoint | null {
  const row = relatedRows(ctx, 'clearing')?.find((r) => r.ts === t)
  return row ? (clearingPoints([row], relatedRows(ctx, 'market'))[0] ?? null) : null
}

/** The market index price at `t`, from the related market rows. */
export function marketAt(ctx: PageContext, t: number): number | null {
  const row = relatedRows(ctx, 'market')?.find((r) => r.ts === t)
  return row ? num(row[MARKET]) : null
}

/** The units the window holds rows for but with no figures at this half-hour (the backend's gap rows). */
export function missingUnits(rows: SeriesRow[], t: number): string[] {
  const out: string[] = []
  for (const r of rows) {
    if (r.ts !== t || num(r[COST]) !== null) continue
    const unit = str(r[UNIT])
    if (unit !== null) out.push(unit)
  }
  return out.sort()
}

/** Each fuel in the stack at a half-hour: its units, capacity and cost range, cheapest fuel first. */
export function fuelsIn(units: CurveUnit[]): { fuel: string | null; style: FuelStyle; units: number; mw: number; low: number; high: number }[] {
  const by = new Map<string, { fuel: string | null; style: FuelStyle; units: number; mw: number; low: number; high: number }>()
  for (const u of units) {
    const key = u.fuel ?? ''
    const f = by.get(key) ?? { fuel: u.fuel, style: fuelStyle(u.fuel), units: 0, mw: 0, low: Infinity, high: -Infinity }
    f.units += 1
    f.mw += u.available
    f.low = Math.min(f.low, u.cost)
    f.high = Math.max(f.high, u.cost)
    by.set(key, f)
  }
  return [...by.values()].sort((a, b) => a.low - b.low || a.style.label.localeCompare(b.style.label))
}

/** The unit whose block the clearing demand falls in, by the held cumulative capacity; null below zero or past the stack. */
export function unitAtDemand(units: CurveUnit[], demandMw: number): CurveUnit | null {
  if (demandMw <= 0) return null
  return units.find((u) => u.cumulative - u.available < demandMw && demandMw <= u.cumulative) ?? null
}

/**
 * How the cost of each unit was set, as its `cost_provenance` note names it:
 * each term, each value, whether the note marks it an assumption or a source,
 * and the fuel codes whose units use it.
 */
export interface CostEntry {
  value: string
  /** The note's own prefix: `assumption:` or `source:`; null when it carries neither. */
  marked: 'assumption' | 'source' | null
  fuels: (string | null)[]
}

export interface CostTerm {
  term: string
  entries: CostEntry[]
}

const collator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' })

export function costTerms(units: CurveUnit[]): { terms: CostTerm[]; unreadable: number; missing: number } {
  const terms = new Map<string, Map<string, CostEntry>>()
  let unreadable = 0
  let missing = 0
  for (const u of units) {
    if (u.provenance === null) {
      missing += 1
      continue
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(u.provenance)
    } catch (err) {
      if (!(err instanceof SyntaxError)) throw err
      unreadable += 1
      continue
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      unreadable += 1
      continue
    }
    for (const [term, raw] of Object.entries(parsed as Record<string, unknown>)) {
      const text = typeof raw === 'string' ? raw : JSON.stringify(raw)
      const prefix = /^(assumption|source):(.*)$/s.exec(text)
      const marked = prefix ? (prefix[1] as 'assumption' | 'source') : null
      const value = prefix ? prefix[2] : text
      const values = terms.get(term) ?? new Map<string, CostEntry>()
      const key = `${marked ?? ''}:${value}`
      const entry = values.get(key) ?? { value, marked, fuels: [] }
      if (!entry.fuels.includes(u.fuel)) entry.fuels.push(u.fuel)
      values.set(key, entry)
      terms.set(term, values)
    }
  }
  const byLabel = (a: string | null, b: string | null) => collator.compare(fuelStyle(a).label, fuelStyle(b).label)
  return {
    terms: [...terms.entries()]
      .sort((a, b) => collator.compare(a[0], b[0]))
      .map(([term, values]) => ({
        term,
        entries: [...values.values()].map((e) => ({ ...e, fuels: [...e.fuels].sort(byLabel) })).sort((a, b) => collator.compare(a.value, b.value)),
      })),
    unreadable,
    missing,
  }
}

/** A cost term's name in words; one the page doesn't know keeps its key. */
const TERM_WORDS: Record<string, string> = {
  carbon_intensity: 'Carbon intensity',
  carbon_price: 'Carbon price',
  efficiency: 'Efficiency',
  efficiency_ordering: 'Efficiency order',
  efficiency_range: 'Efficiency range',
  fuel_mapping: 'Fuel mapping',
  fuel_price: 'Fuel price',
  fx_gbp_per_eur: 'Pounds per euro',
  fx_gbp_per_usd: 'Pounds per dollar',
  variable_om: 'Variable running cost',
}

export const termWords = (term: string): string | null => TERM_WORDS[term] ?? null
