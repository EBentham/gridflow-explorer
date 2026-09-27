/**
 * What this page's panels share. The rows endpoint splits this dataset by its
 * one dimension, `price_derivation_code`, whose role is a filter: every
 * half-hour comes back once per code, the code that half-hour carries holding
 * the values and the others padded with nulls. Left like that, each column
 * would draw as a line per code, broken wherever the other code holds the
 * half-hour. So the page folds the rows back to one per half-hour: the row
 * that holds values, or, where none does, one of the padded rows, so a
 * missing half-hour stays a null (a gap) rather than an absent field. Nothing
 * is averaged or filled. A half-hour two codes both hold would be a clash:
 * it is kept as a gap and counted, never resolved by picking one.
 *
 * Read as time-bucket means (a window too long for full detail), the means
 * come per code. An hourly bucket spans two half-hours and each half-hour
 * carries one code, so where two codes each hold a mean in one hour, each mean
 * is of one half-hour, and the mean of the two is the hour's mean exactly;
 * where one code holds the hour, its mean already is. So hourly means are
 * joined into one row per hour (per column, the mean of the codes' means that
 * hold a value). From two-hour buckets up, how many half-hours each code's
 * mean covers isn't sent, so those aren't joined, and the page says why.
 */
import { listText } from '../../../design/format'
import { datesBetween, dayStart, HOUR_MS, londonMidnight, rangeText } from '../../../design/time'
import type { ManifestDataset, SeriesRow, SeriesRowsResponse } from '../../contract'
import type { PageContext, SeriesView, ValueSpec } from '../../define'
import { buildSeriesModel, type SeriesDef, type SeriesModel } from '../../_template/seriesModel'

export const SSP = 'system_sell_price'
export const SBP = 'system_buy_price'
export const NIV = 'net_imbalance_volume'
export const CI_FORECAST = 'carbon_intensity_forecast_gco2_kwh'
export const CI_ACTUAL = 'carbon_intensity_actual_gco2_kwh'
export const CODE = 'price_derivation_code'
export const VALUE_COLUMNS = [SSP, SBP, NIV, CI_FORECAST, CI_ACTUAL]

/** The related key for NESO's national carbon intensity: read for which days hold it. */
export const CI_SOURCE = 'ci'

/** The value axes' width, so the stacked panels' clocks line up. */
export const AXIS_WIDTH = 52

export const VALUES: ValueSpec[] = [
  { column: SSP, label: 'Sell price', color: 'var(--chart-price)' },
  // A series colour no other series here uses: it shares the price panel whenever it differs from the sell price.
  { column: SBP, label: 'Buy price', color: 'var(--fuel-pumped_storage)' },
  { column: NIV, label: 'Imbalance volume', color: 'var(--chart-fan-soft)' },
  { column: CI_FORECAST, label: 'Intensity, forecast', color: 'var(--chart-price-2)' },
  { column: CI_ACTUAL, label: 'Intensity, actual', color: 'var(--chart-actual)' },
]

export interface Folded {
  /** The page's context with one row per half-hour (or per hour of means): its `response` and `series` are the folded ones. */
  ctx: PageContext
  model: SeriesModel
  /** Half-hours two derivation codes both hold values for: kept as gaps. */
  clashes: number
  /** Half-hours with a price, by the derivation code they carry (not counted for means). */
  codes: Map<string, number>
  /** The rows are hourly means, joined across codes. */
  means: boolean
}

const cache = new WeakMap<SeriesRowsResponse, Omit<Folded, 'ctx'> & { response: SeriesRowsResponse }>()

const holds = (r: SeriesRow) => VALUE_COLUMNS.some((c) => typeof r[c] === 'number')
const codeOf = (r: SeriesRow) => (r[CODE] === null || r[CODE] === undefined ? '' : String(r[CODE]))

function gapRow(ts: number): SeriesRow {
  const gap: SeriesRow = { ts, settlement_date: null, settlement_period: null, [CODE]: null }
  for (const c of VALUE_COLUMNS) gap[c] = null
  return gap
}

/** One hour's means across the codes that hold it: per column, the mean of the codes' means holding a value. */
function joinHour(ts: number, held: SeriesRow[]): SeriesRow {
  const row = gapRow(ts)
  for (const c of VALUE_COLUMNS) {
    const vs = held.map((r) => r[c]).filter((v): v is number => typeof v === 'number')
    row[c] = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null
  }
  row[CODE] = listText([...new Set(held.map(codeOf))].sort().map((c) => c || 'blank'))
  return row
}

function fold(response: SeriesRowsResponse, values: ValueSpec[]) {
  const hit = cache.get(response)
  if (hit) return hit
  const means = response.truncation?.bucket_ms === HOUR_MS
  const byTs = new Map<number, SeriesRow[]>()
  for (const r of response.rows) {
    const list = byTs.get(r.ts)
    if (list) list.push(r)
    else byTs.set(r.ts, [r])
  }
  let clashes = 0
  const codes = new Map<string, number>()
  const rows: SeriesRow[] = []
  for (const [ts, list] of [...byTs.entries()].sort((a, b) => a[0] - b[0])) {
    const held = list.filter(holds)
    if (means) {
      rows.push(held.length ? joinHour(ts, held) : gapRow(ts))
      continue
    }
    if (held.length === 1) {
      rows.push(held[0])
      if (typeof held[0][SSP] === 'number') codes.set(codeOf(held[0]), (codes.get(codeOf(held[0])) ?? 0) + 1)
      continue
    }
    if (held.length > 1) clashes += 1
    rows.push(gapRow(ts))
  }
  const folded: SeriesRowsResponse = {
    ...response,
    group: null,
    rows,
    // The code as a column of text, so the table shows which one each half-hour (or the codes each hour) carries.
    columns: [...response.columns, { column: CODE, unit: 'category', label: 'price derivation code' }],
  }
  const out = { response: folded, model: buildSeriesModel(folded, { values }), clashes, codes, means }
  cache.set(response, out)
  return out
}

/** The rows are means over buckets longer than an hour: they can't be joined across codes, so nothing is drawn as one line. */
export function unjoinable(ctx: PageContext): boolean {
  const bucket = ctx.response?.truncation?.bucket_ms
  return typeof bucket === 'number' && bucket > HOUR_MS
}

/** The rows are hourly means, joined across codes: drawn, but the key's and days' half-hour figures are withheld. */
export const isMeans = (ctx: PageContext) => ctx.response?.truncation?.bucket_ms === HOUR_MS

/** The page's rows folded to one per half-hour, or per hour of means; null before rows are read, or for means over longer buckets. */
export function folded(ctx: PageContext): Folded | null {
  const response = ctx.response
  if (!response || response.kind !== 'series' || unjoinable(ctx)) return null
  const view = ctx.view as SeriesView
  const f = fold(response, view.values ?? VALUES)
  return { ctx: { ...ctx, response: f.response, series: f.model }, model: f.model, clashes: f.clashes, codes: f.codes, means: f.means }
}

export interface IntensityRuns {
  /** Days of the window holding any national intensity. */
  held: number
  days: number
  /** Runs of consecutive days held, and of days not held, as date ranges. */
  heldRuns: string[]
  emptyRuns: string[]
}

/**
 * Which UK days of the window hold NESO's national carbon intensity, from its
 * own rows read beside this page, as runs of consecutive days held and not
 * held; null when those rows aren't read.
 */
export function intensityRuns(ctx: PageContext): IntensityRuns | null {
  const rel = ctx.related[CI_SOURCE]
  const model = rel?.series
  if (!ctx.window || !model || (rel.state !== 'data' && rel.state !== 'empty')) return null
  const heldDays = new Set<number>()
  for (const row of model.rows) {
    if (model.all.some((d) => typeof row[d.field] === 'number')) heldDays.add(londonMidnight(row.t))
  }
  const days = datesBetween(ctx.window.start, ctx.window.end)
  const heldRuns: string[] = []
  const emptyRuns: string[] = []
  let run: { held: boolean; first: string; last: string } | null = null
  for (const day of days) {
    const held = heldDays.has(dayStart(day))
    if (run && run.held === held) {
      run.last = day
      continue
    }
    if (run) (run.held ? heldRuns : emptyRuns).push(rangeText(run.first, run.last))
    run = { held, first: day, last: day }
  }
  if (run) (run.held ? heldRuns : emptyRuns).push(rangeText(run.first, run.last))
  return { held: days.filter((d) => heldDays.has(dayStart(d))).length, days: days.length, heldRuns, emptyRuns }
}

export const seriesOf = (model: SeriesModel | null, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

/** Half-hours whose sell and buy prices both hold, and how many of those differ. */
export function priceSides(model: SeriesModel): { both: number; differ: number } {
  const ssp = seriesOf(model, SSP)
  const sbp = seriesOf(model, SBP)
  if (!ssp || !sbp) return { both: 0, differ: 0 }
  let both = 0
  let differ = 0
  for (const r of model.rows) {
    const a = r[ssp.field]
    const b = r[sbp.field]
    if (typeof a !== 'number' || typeof b !== 'number') continue
    both += 1
    if (a !== b) differ += 1
  }
  return { both, differ }
}

/** Half-hours with a price, and of those how many carry a forecast and an actual intensity. */
export function intensityCover(model: SeriesModel): { priced: number; forecast: number; actual: number } {
  const ssp = seriesOf(model, SSP)
  const f = seriesOf(model, CI_FORECAST)
  const a = seriesOf(model, CI_ACTUAL)
  let priced = 0
  let forecast = 0
  let actual = 0
  for (const r of model.rows) {
    if (!ssp || typeof r[ssp.field] !== 'number') continue
    priced += 1
    if (f && typeof r[f.field] === 'number') forecast += 1
    if (a && typeof r[a.field] === 'number') actual += 1
  }
  return { priced, forecast, actual }
}

/** NESO's national carbon intensity as the source list holds it: where its local rows run. */
export function intensityDepth(ctx: PageContext): Pick<ManifestDataset, 'coverage'>['coverage'] {
  return ctx.related[CI_SOURCE]?.dataset?.coverage ?? null
}

export interface Third {
  n: number
  ciLow: number
  ciHigh: number
  mean: number
  low: number
  high: number
}

/** Below this many half-hours holding both, the thirds are too thin to set side by side. */
export const MIN_PAIRS = 30

/**
 * The half-hours holding both a price and a forecast intensity, ranked by the
 * intensity and cut into three runs of near-equal size: each run's intensity
 * range, and the price's mean, lowest and highest over it. Plain figures of
 * the rows held, unweighted; no fit, no claim of cause.
 */
export function priceByIntensity(model: SeriesModel): { pairs: number; thirds: Third[] } {
  const ssp = seriesOf(model, SSP)
  const f = seriesOf(model, CI_FORECAST)
  if (!ssp || !f) return { pairs: 0, thirds: [] }
  const pairs: { ci: number; p: number }[] = []
  for (const r of model.rows) {
    const p = r[ssp.field]
    const ci = r[f.field]
    if (typeof p === 'number' && typeof ci === 'number') pairs.push({ ci, p })
  }
  if (pairs.length < MIN_PAIRS) return { pairs: pairs.length, thirds: [] }
  pairs.sort((a, b) => a.ci - b.ci || a.p - b.p)
  const cuts = [0, Math.round(pairs.length / 3), Math.round((2 * pairs.length) / 3), pairs.length]
  const thirds: Third[] = []
  for (let i = 0; i < 3; i += 1) {
    const part = pairs.slice(cuts[i], cuts[i + 1])
    const prices = part.map((x) => x.p)
    thirds.push({
      n: part.length,
      ciLow: part[0].ci,
      ciHigh: part[part.length - 1].ci,
      mean: prices.reduce((s, v) => s + v, 0) / part.length,
      low: Math.min(...prices),
      high: Math.max(...prices),
    })
  }
  return { pairs: pairs.length, thirds }
}
