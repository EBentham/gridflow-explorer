/**
 * What the indicated demand and generation panels share: the dataset and
 * column ids, one colour per measure (a colour follows its measure wherever
 * it is drawn), the boundary on the page, and the pair read from the rows.
 *
 * Indicated demand is held negative. Every figure this module hands a chart
 * or a key for demand is that figure with its sign turned, and its names say
 * so; the held figure is kept beside it for the table. Nothing is filled in:
 * a half-hour either side lacks is a gap, never a zero.
 */
import { DAY_MS, HOUR_MS, MINUTE_MS, datesBetween, dayStart, londonMidnight, nextLondonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { SeriesRow } from '../../contract'
import type { PageContext, RelatedData } from '../../define'
import type { SeriesDef, SeriesModel, Settlement, WideRow } from '../../_template/seriesModel'
import { displayUnit, type DisplayUnit } from '../../_template/units'

export const INDDEM = 'inddem'
export const INDGEN = 'indgen'
export const DEMAND = 'indicated_demand_mw'
export const GENERATION = 'indicated_generation_mw'
export const ISSUED = 'published_at'
export const BOUNDARY = 'boundary'

/** The key of the other dataset, read beside the page's own. */
export const OTHER_KEY = 'other'

/** Boundary N opens the page; the other 17 are B1 to B17, named by code alone. */
export const NATIONAL_BOUNDARY = 'N'
export const BOUNDARIES = [NATIONAL_BOUNDARY, ...Array.from({ length: 17 }, (_, i) => `B${i + 1}`)]
/** The page's own URL parameter for the boundary. */
export const BOUNDARY_PARAM = 'boundary'

export const COLORS = {
  generation: 'var(--chart-fan)',
  demand: 'var(--chart-price-2)',
  lead: 'var(--chart-fan-soft)',
} as const

export const LABELS = {
  generation: 'Indicated generation',
  demand: 'Indicated demand, sign flipped',
} as const

/** Both charts' value axes take this width, so their clocks line up. */
export const AXIS_WIDTH = 52

/** Tables keep MW. */
export const MW_UNIT = displayUnit('MW', 'MW')

/** The boundary on the page: the URL's, else N. */
export function boundaryOf(ctx: Pick<PageContext, 'param'>): string {
  const b = ctx.param(BOUNDARY_PARAM)
  return b && BOUNDARIES.includes(b) ? b : NATIONAL_BOUNDARY
}

export const boundaryName = (b: string) => (b === NATIONAL_BOUNDARY ? 'boundary N, national' : `boundary ${b}`)

// ---------------------------------------------------------------- issue times

/**
 * `13 min`, `5 h 20 min`, `2 days 3 h`: how long before its half-hour a
 * figure was issued (`… after` if it came later). Non-breaking spaces keep a
 * lead from wrapping mid-figure.
 */
export function leadText(ms: number): string {
  return leadWords(ms).replace(/ /g, ' ')
}

function leadWords(ms: number): string {
  if (ms < 0) return `${leadWords(-ms)} after`
  const min = Math.round(ms / MINUTE_MS)
  if (min < 60) return `${min} min`
  if (ms < 2 * DAY_MS) {
    const h = Math.floor(min / 60)
    const m = min % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  const hours = Math.round(ms / HOUR_MS)
  const d = Math.floor(hours / 24)
  const h = hours % 24
  return h ? `${d} days ${h} h` : `${d} days`
}

/**
 * Hours before its half-hour a figure was issued. Not a unit the template
 * knows, so it is set out here; the tooltip gives the lead exactly.
 */
export const LEAD_UNIT: DisplayUnit = {
  label: 'h',
  source: 'h',
  factor: 1,
  numeric: true,
  format: (v) => `issued ${leadText(v * HOUR_MS)}${v >= 0 ? ' ahead' : ''}`,
  plain: (v) => (Math.abs(v) < 0.05 ? '0' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`),
  caption: 'Hours issued ahead',
}

const issuedAt = (r: SeriesRow): number | null => {
  const p = r[ISSUED]
  if (typeof p !== 'string') return null
  const t = Date.parse(p)
  return Number.isFinite(t) ? t : null
}

// ---------------------------------------------------------------- the pair

/** One half-hour of the pair: GW for the charts, MW as held for the table. */
export interface PairRow extends WideRow {
  /** Indicated generation, GW. */
  g: number | null
  /** Indicated demand with its sign flipped, GW. */
  d: number | null
  /** Hours the page's own figure was issued ahead of its half-hour. */
  l: number | null
}

export interface PairCell {
  genMw: number | null
  /** Indicated demand as held: negative. */
  demMw: number | null
  genIssued: number | null
  demIssued: number | null
}

export interface Pair {
  boundary: string
  ownIsDemand: boolean
  rows: PairRow[]
  /** As held, by half-hour: the table reads these. */
  cells: Map<number, PairCell>
  stepMs: number | null
  bucketed: boolean
  settlement: Map<number, Settlement> | null
  /** The two chart series: generation, then demand (flipped). */
  gen: SeriesDef | null
  dem: SeriesDef | null
  /** The other dataset, and why it isn't paired when it isn't. */
  other: RelatedData | undefined
  otherState: 'paired' | 'failed' | 'loading' | 'none held' | 'other clock'
  /** Half-hours where both are held and their issue times differ, and where both are held. */
  issueMismatch: number
  bothHeld: number
}

const GW = displayUnit('MW')

function def(key: string, label: string, color: string, count: number): SeriesDef {
  return { key, field: key === 'gen' ? 'g' : 'd', column: key === 'gen' ? GENERATION : DEMAND, group: null, label, color, unit: GW, from: 'pair', count, mean: null, min: null, max: null, signed: false }
}

/** A model's values of one series by time, in MW as held. */
function heldBy(model: SeriesModel, series: SeriesDef): Map<number, number | null> {
  const out = new Map<number, number | null>()
  for (const r of model.rows) {
    if (!(series.field in r)) continue
    const v = r[series.field]
    out.set(r.t, typeof v === 'number' ? v / series.unit.factor : null)
  }
  return out
}

/** Each held row's issue time, by half-hour, for one boundary. */
function issuesBy(rows: SeriesRow[] | undefined, column: string, boundary: string, filtered: boolean): Map<number, number> {
  const out = new Map<number, number>()
  for (const r of rows ?? []) {
    if (!filtered && r[BOUNDARY] !== boundary) continue
    if (typeof r[column] !== 'number') continue
    const at = issuedAt(r)
    if (at !== null) out.set(r.ts, at)
  }
  return out
}

/**
 * The page's own dataset and the other one at the page's boundary, joined on
 * time. The own rows come filtered to the boundary; the other's come split
 * by boundary (a dataset read beside the page can't follow the page's
 * boundary), and the boundary's series is taken from them.
 */
export function pairOf(ctx: PageContext): Pair | null {
  const model = ctx.series
  if (!model) return null
  const ownIsDemand = ctx.dataset.id === INDDEM
  const ownCol = ownIsDemand ? DEMAND : GENERATION
  const otherCol = ownIsDemand ? GENERATION : DEMAND
  const boundary = boundaryOf(ctx)
  const ownDef = model.all.find((d) => d.column === ownCol)
  if (!ownDef) return null
  const other = ctx.related[OTHER_KEY]
  const oModel = other?.series ?? null
  const oDef = oModel?.all.find((d) => d.column === otherCol && d.group === boundary) ?? null
  const clockOk = Boolean(oModel && oModel.stepMs === model.stepMs && oModel.bucketed === model.bucketed)
  const otherState: Pair['otherState'] = !other
    ? 'none held'
    : other.state === 'error' || other.state === 'refreshing'
      ? 'failed'
      : !oModel
        ? other.state === 'empty'
          ? 'none held'
          : 'loading'
        : !oDef || oDef.count === 0
          ? 'none held'
          : clockOk
            ? 'paired'
            : 'other clock'

  const own = heldBy(model, ownDef)
  const theirs = otherState === 'paired' && oModel && oDef ? heldBy(oModel, oDef) : new Map<number, number | null>()
  const ownIssues = model.bucketed ? new Map<number, number>() : issuesBy(ctx.response?.kind === 'series' ? ctx.response.rows : undefined, ownCol, boundary, true)
  const otherRows = other?.response?.kind === 'series' ? other.response.rows : undefined
  const theirIssues = otherState === 'paired' && !model.bucketed ? issuesBy(otherRows, otherCol, boundary, false) : new Map<number, number>()

  const times = [...new Set([...own.keys(), ...theirs.keys()])].sort((a, b) => a - b)
  const cells = new Map<number, PairCell>()
  let issueMismatch = 0
  let bothHeld = 0
  let gCount = 0
  let dCount = 0
  const rows: PairRow[] = times.map((t) => {
    const ov = own.get(t) ?? null
    const tv = theirs.get(t) ?? null
    const genMw = ownIsDemand ? tv : ov
    const demMw = ownIsDemand ? ov : tv
    const oi = ownIssues.get(t) ?? null
    const ti = theirIssues.get(t) ?? null
    const genIssued = ownIsDemand ? ti : oi
    const demIssued = ownIsDemand ? oi : ti
    cells.set(t, { genMw, demMw, genIssued, demIssued })
    if (genMw !== null && demMw !== null && genIssued !== null && demIssued !== null) {
      bothHeld += 1
      if (genIssued !== demIssued) issueMismatch += 1
    }
    if (genMw !== null) gCount += 1
    if (demMw !== null) dCount += 1
    const ownValue = ov
    return {
      t,
      g: genMw === null ? null : genMw * GW.factor,
      // Held negative: turned for display only, and named "sign flipped" wherever it is drawn.
      d: demMw === null ? null : -demMw * GW.factor,
      l: ownValue !== null && oi !== null ? (t - oi) / HOUR_MS : null,
    }
  })

  const genHeld = ownIsDemand ? otherState === 'paired' : true
  const demHeld = ownIsDemand ? true : otherState === 'paired'
  return {
    boundary,
    ownIsDemand,
    rows,
    cells,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    gen: genHeld && gCount > 0 ? def('gen', LABELS.generation, COLORS.generation, gCount) : null,
    dem: demHeld && dCount > 0 ? def('dem', LABELS.demand, COLORS.demand, dCount) : null,
    other,
    otherState,
    issueMismatch,
    bothHeld,
  }
}

/** A focus id from the key, as `SeriesChart` reads it. */
export const pairId = (d: Pick<SeriesDef, 'key'>) => `pair/${d.key}`

// ---------------------------------------------------------------- figures from the pair

export interface Extremes {
  high: { t: number; v: number }
  low: { t: number; v: number }
}

export function extremesIn(rows: PairRow[], field: 'g' | 'd' | 'l'): Extremes | null {
  let high: { t: number; v: number } | null = null
  let low: { t: number; v: number } | null = null
  for (const r of rows) {
    const v = r[field]
    if (typeof v !== 'number') continue
    if (!high || v > high.v) high = { t: r.t, v }
    if (!low || v < low.v) low = { t: r.t, v }
  }
  return high && low ? { high, low } : null
}

export function latestIn(rows: PairRow[], field: 'g' | 'd'): { t: number; v: number } | null {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const v = rows[i][field]
    if (typeof v === 'number') return { t: rows[i].t, v }
  }
  return null
}

export interface IssueStats {
  count: number
  shortest: number
  median: number
  longest: number
  newest: number
}

/** How far ahead of its half-hour each of the page's own figures was issued. Null when the rows carry no issue time. */
export function issueStats(pair: Pair): IssueStats | null {
  const leads: number[] = []
  let newest = -Infinity
  for (const r of pair.rows) {
    if (typeof r.l !== 'number') continue
    leads.push(r.l * HOUR_MS)
    newest = Math.max(newest, r.t - r.l * HOUR_MS)
  }
  if (!leads.length) return null
  leads.sort((a, b) => a - b)
  const mid = leads.length >> 1
  const median = leads.length % 2 ? leads[mid] : (leads[mid - 1] + leads[mid]) / 2
  return { count: leads.length, shortest: leads[0], median, longest: leads[leads.length - 1], newest: Math.round(newest) }
}

// ---------------------------------------------------------------- the days

export interface PairDay {
  date: string
  start: number
  /** Half-hours the day has, when the step is known. */
  expected: number | null
  gHeld: number
  dHeld: number
  gHigh: { t: number; v: number } | null
  gLow: { t: number; v: number } | null
  dHigh: { t: number; v: number } | null
  dLow: { t: number; v: number } | null
  /** The issues behind the page's own figures that day, newest first, with how many half-hours each gives. */
  issues: { at: number; n: number }[]
}

export function pairDays(pair: Pair, window: DateRange): PairDay[] {
  const byDay = new Map<number, PairRow[]>()
  for (const r of pair.rows) {
    const d = londonMidnight(r.t)
    const list = byDay.get(d)
    if (list) list.push(r)
    else byDay.set(d, [r])
  }
  return datesBetween(window.start, window.end).map((date) => {
    const start = dayStart(date)
    const rows = byDay.get(start) ?? []
    const g = extremesIn(rows, 'g')
    const d = extremesIn(rows, 'd')
    const issues = new Map<number, number>()
    for (const r of rows) {
      if (typeof r.l !== 'number') continue
      const at = Math.round(r.t - r.l * HOUR_MS)
      issues.set(at, (issues.get(at) ?? 0) + 1)
    }
    return {
      date,
      start,
      expected: pair.stepMs ? Math.round((nextLondonMidnight(start) - start) / pair.stepMs) : null,
      gHeld: rows.filter((r) => typeof r.g === 'number').length,
      dHeld: rows.filter((r) => typeof r.d === 'number').length,
      gHigh: g?.high ?? null,
      gLow: g?.low ?? null,
      dHigh: d?.high ?? null,
      dLow: d?.low ?? null,
      issues: [...issues.entries()].map(([at, n]) => ({ at, n })).sort((a, b) => b.at - a.at),
    }
  })
}
