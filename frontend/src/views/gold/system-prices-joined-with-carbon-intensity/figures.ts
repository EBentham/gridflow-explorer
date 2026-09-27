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
 * come per code, and two codes can hold a mean in one bucket. Their weights
 * aren't sent, so they can't be joined honestly: the page doesn't fold them
 * and says why.
 */
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

/** The related key for NESO's national carbon intensity: read for its local coverage. */
export const CI_SOURCE = 'ci'

/** The value axes' width, so the stacked panels' clocks line up. */
export const AXIS_WIDTH = 52

export const VALUES: ValueSpec[] = [
  { column: SSP, label: 'Sell price', color: 'var(--chart-price)' },
  { column: SBP, label: 'Buy price', color: 'var(--chart-price-2)' },
  { column: NIV, label: 'Imbalance volume', color: 'var(--chart-fan-soft)' },
  { column: CI_FORECAST, label: 'Intensity, forecast', color: 'var(--chart-price-2)' },
  { column: CI_ACTUAL, label: 'Intensity, actual', color: 'var(--chart-actual)' },
]

export interface Folded {
  /** The page's context with one row per half-hour: its `response` and `series` are the folded ones. */
  ctx: PageContext
  model: SeriesModel
  /** Half-hours two derivation codes both hold values for: kept as gaps. */
  clashes: number
  /** Half-hours with a price, by the derivation code they carry. */
  codes: Map<string, number>
}

const cache = new WeakMap<SeriesRowsResponse, Omit<Folded, 'ctx'> & { response: SeriesRowsResponse }>()

const holds = (r: SeriesRow) => VALUE_COLUMNS.some((c) => typeof r[c] === 'number')

function fold(response: SeriesRowsResponse, values: ValueSpec[]) {
  const hit = cache.get(response)
  if (hit) return hit
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
    if (held.length === 1) {
      rows.push(held[0])
      if (typeof held[0][SSP] === 'number') {
        const code = held[0][CODE] === null || held[0][CODE] === undefined ? '' : String(held[0][CODE])
        codes.set(code, (codes.get(code) ?? 0) + 1)
      }
      continue
    }
    if (held.length > 1) clashes += 1
    const gap: SeriesRow = { ts, settlement_date: null, settlement_period: null, [CODE]: null }
    for (const c of VALUE_COLUMNS) gap[c] = null
    rows.push(gap)
  }
  const folded: SeriesRowsResponse = {
    ...response,
    group: null,
    rows,
    // The code as a column of text, so the table shows which one each half-hour carries.
    columns: [...response.columns, { column: CODE, unit: 'category', label: 'price derivation code' }],
  }
  const out = { response: folded, model: buildSeriesModel(folded, { values }), clashes, codes }
  cache.set(response, out)
  return out
}

/** The page's rows folded to one per half-hour; null before rows are read, or when they come as bucket means. */
export function folded(ctx: PageContext): Folded | null {
  const response = ctx.response
  if (!response || response.kind !== 'series' || response.truncation?.bucket_ms) return null
  const view = ctx.view as SeriesView
  const f = fold(response, view.values ?? VALUES)
  return { ctx: { ...ctx, response: f.response, series: f.model }, model: f.model, clashes: f.clashes, codes: f.codes }
}

/** The rows are time-bucket means: nothing is folded or drawn as one line. */
export const isBucketed = (ctx: PageContext) => Boolean(ctx.response?.truncation?.bucket_ms)

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
