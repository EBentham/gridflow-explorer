/**
 * What this page's panels share: the seven columns of `market_depth`, their
 * labels and colours, the value-axis width that lines the working panel's
 * chart up under the main one, and the system prices read beside it.
 *
 * The system prices come from the rows endpoint split by their one
 * dimension, `price_derivation_code`: every half-hour once per code, the
 * code it carries holding the values and the others padded with nulls.
 * `systemPrices` folds them back to one row per half-hour (the row that
 * holds values; a padded row where none does, so a missing half-hour stays
 * a gap). A half-hour two codes both hold is a clash: kept as a gap and
 * counted, never settled by picking one. Rows read as time-bucket means come
 * apart by code too, and how many half-hours each code's mean covers isn't
 * sent, so means are not folded: the page says so instead of drawing them.
 */
import { datesBetween, dayStart, londonMidnight, stepsInDay } from '../../../design/time'
import type { SeriesRow, SeriesRowsResponse } from '../../contract'
import type { PageContext, ValueSpec } from '../../define'
import { buildSeriesModel, type SeriesDef, type SeriesModel } from '../../_template/seriesModel'

export const IMBALANCE = 'indicated_imbalance_mwh'
export const OFFER = 'offer_volume_mwh'
export const BID = 'bid_volume_mwh'
export const ACC_OFFER = 'total_accepted_offer_volume_mwh'
export const ACC_BID = 'total_accepted_bid_volume_mwh'
export const PRICED_OFFER = 'priced_accepted_offers_volume_mwh'
export const PRICED_BID = 'priced_accepted_bids_volume_mwh'

export const OFFERED = [OFFER, BID]
export const ACCEPTED = [ACC_OFFER, PRICED_OFFER, ACC_BID, PRICED_BID]

/**
 * Offers take the colour the system prices use for a short system and bids
 * the one for a long system. The priced parts take hues of their own, as a
 * darker shade of the same hue sat too close to its total in the dark
 * theme; the indicated imbalance takes one no other series here uses.
 */
export const VALUES: ValueSpec[] = [
  { column: OFFER, label: 'Offer volume', color: 'var(--chart-niv-short)' },
  { column: BID, label: 'Bid volume', color: 'var(--chart-niv-long)' },
  { column: ACC_OFFER, label: 'Accepted offers', color: 'var(--chart-niv-short)' },
  { column: PRICED_OFFER, label: 'Priced accepted offers', color: 'var(--fuel-biomass)' },
  { column: ACC_BID, label: 'Accepted bids', color: 'var(--chart-niv-long)' },
  { column: PRICED_BID, label: 'Priced accepted bids', color: 'var(--fuel-pumped_storage)' },
  { column: IMBALANCE, label: 'Indicated imbalance', color: 'var(--fuel-imports)' },
]

/** Every chart on the page gives its value axis this width, so the clocks line up. */
export const AXIS_WIDTH = 60

/** The related key for Elexon's system prices. */
export const PRICES = 'sp'
export const SSP = 'system_sell_price'
export const NIV = 'net_imbalance_volume'
const CODE = 'price_derivation_code'
const PRICE_COLUMNS = [SSP, 'system_buy_price', NIV]

export const PRICE_VALUES: ValueSpec[] = [
  { column: SSP, label: 'System sell price', color: 'var(--chart-price)' },
  { column: NIV, label: 'Net imbalance volume', color: 'var(--chart-fan-soft)' },
]

/** A column's series in a model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null | undefined, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

export interface FoldedPrices {
  model: SeriesModel
  /** Half-hours two derivation codes both hold values for: kept as gaps. */
  clashes: number
}

const cache = new WeakMap<SeriesRowsResponse, FoldedPrices>()

const holds = (r: SeriesRow) => PRICE_COLUMNS.some((c) => typeof r[c] === 'number')

function gapRow(ts: number): SeriesRow {
  const gap: SeriesRow = { ts, settlement_date: null, settlement_period: null }
  for (const c of PRICE_COLUMNS) gap[c] = null
  return gap
}

export type PricesState =
  | { kind: 'ok'; folded: FoldedPrices }
  /** Still loading, failed, or holds nothing: the panel says which from `ctx.related`. */
  | { kind: 'none' }
  /** Read as time-bucket means, which come apart by derivation code. */
  | { kind: 'means' }

/** The system prices read beside the page, folded to one row per half-hour. */
export function systemPrices(ctx: PageContext): PricesState {
  const response = ctx.related[PRICES]?.response
  if (!response || response.kind !== 'series') return { kind: 'none' }
  if (response.truncation?.bucket_ms) return { kind: 'means' }
  const hit = cache.get(response)
  if (hit) return { kind: 'ok', folded: hit }
  const byTs = new Map<number, SeriesRow[]>()
  for (const r of response.rows) {
    const list = byTs.get(r.ts)
    if (list) list.push(r)
    else byTs.set(r.ts, [r])
  }
  let clashes = 0
  const rows: SeriesRow[] = []
  for (const [ts, list] of [...byTs.entries()].sort((a, b) => a[0] - b[0])) {
    const held = list.filter(holds)
    if (held.length === 1) {
      // One row per half-hour now, whichever code it carries: the split is gone.
      const row = { ...held[0] }
      delete row[CODE]
      rows.push(row)
      continue
    }
    if (held.length > 1) clashes += 1
    rows.push(gapRow(ts))
  }
  const flat: SeriesRowsResponse = { ...response, group: null, rows }
  const folded = { model: buildSeriesModel(flat, { values: PRICE_VALUES, from: PRICES }), clashes }
  cache.set(response, folded)
  return { kind: 'ok', folded }
}

export interface Held {
  /** Steps with a value. */
  held: number
  /** Steps the window's days hold on this clock (48 a day; 46 or 50 on clock-change days); null off a regular clock. */
  expected: number | null
}

/** How many of the window's steps a series holds a value for. */
export function heldOf(model: SeriesModel, ctx: PageContext, def: SeriesDef | undefined): Held {
  let expected: number | null = 0
  if (ctx.window) {
    for (const iso of datesBetween(ctx.window.start, ctx.window.end)) {
      const n = stepsInDay(dayStart(iso), model.stepMs)
      expected = n === null || expected === null ? null : expected + n
    }
  } else expected = null
  return { held: def?.count ?? 0, expected }
}

export interface DayFigures {
  day: string
  start: number
  /** Steps the day holds on the clock; null off a regular clock or for means longer than an hour. */
  expected: number | null
  /** Steps holding each: the indicated imbalance, the offer volume, the accepted offers. */
  imbalance: number
  offered: number
  accepted: number
  /** Accepted volumes summed over the half-hours holding them; null when none do. */
  accOffer: number | null
  accBid: number | null
  /** The system sell price's mean over the day's half-hours with one, unweighted, and how many. */
  price: number | null
  priced: number
}

/**
 * Each UK day of the window: what it holds of each part of the rows, the
 * accepted volumes summed over the half-hours that hold them, and the system
 * price's mean. Nothing is filled: a day with nothing held sums to nothing.
 */
export function dayFigures(ctx: PageContext, prices: SeriesModel | null): DayFigures[] {
  const model = ctx.series
  if (!model || !ctx.window) return []
  const defs = {
    imbalance: seriesOf(model, IMBALANCE),
    offered: seriesOf(model, OFFER),
    accepted: seriesOf(model, ACC_OFFER),
    accBid: seriesOf(model, ACC_BID),
  }
  const ssp = seriesOf(prices, SSP)
  type Acc = { imbalance: number; offered: number; accepted: number; accOffer: number | null; accBid: number | null; priceSum: number; priced: number }
  const byDay = new Map<number, Acc>()
  const at = (t: number) => {
    const day = londonMidnight(t)
    let a = byDay.get(day)
    if (!a) {
      a = { imbalance: 0, offered: 0, accepted: 0, accOffer: null, accBid: null, priceSum: 0, priced: 0 }
      byDay.set(day, a)
    }
    return a
  }
  const num = (v: unknown): v is number => typeof v === 'number'
  for (const row of model.rows) {
    const a = at(row.t)
    if (defs.imbalance && num(row[defs.imbalance.field])) a.imbalance += 1
    if (defs.offered && num(row[defs.offered.field])) a.offered += 1
    const ao = defs.accepted ? row[defs.accepted.field] : null
    if (num(ao)) {
      a.accepted += 1
      a.accOffer = (a.accOffer ?? 0) + ao
    }
    const ab = defs.accBid ? row[defs.accBid.field] : null
    if (num(ab)) a.accBid = (a.accBid ?? 0) + ab
  }
  if (prices && ssp) {
    for (const row of prices.rows) {
      const v = row[ssp.field]
      if (!num(v)) continue
      const a = at(row.t)
      a.priceSum += v
      a.priced += 1
    }
  }
  return datesBetween(ctx.window.start, ctx.window.end).map((day) => {
    const start = dayStart(day)
    const a = byDay.get(start)
    return {
      day,
      start,
      expected: model.bucketed ? null : stepsInDay(start, model.stepMs),
      imbalance: a?.imbalance ?? 0,
      offered: a?.offered ?? 0,
      accepted: a?.accepted ?? 0,
      accOffer: a?.accOffer ?? null,
      accBid: a?.accBid ?? null,
      price: a && a.priced ? a.priceSum / a.priced : null,
      priced: a?.priced ?? 0,
    }
  })
}
