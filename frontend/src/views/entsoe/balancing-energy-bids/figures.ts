/**
 * The bids added up: what every panel of the page reads.
 *
 * The rows come split by bid (`bid_mrid`), one row per bid per step of the
 * window, a null where a bid holds no value. At each step the page adds the
 * MW of the bids holding a value, and counts them. A step no bid holds is a
 * gap, never zero: nothing in the rows tells an empty book from a step that
 * wasn't fetched.
 *
 * A window too long for one read comes back as each bid's mean over a
 * longer step. Those means are not added up: a bid offered for part of a
 * step would count as if offered for all of it. What still holds is the
 * count (a bid has a mean in a step when it was offered at some point in
 * it), so a window read as means gets the bids per step and no MW.
 */
import { fmtN } from '../../../design/format'
import { datesBetween, dayStart, HOUR_MS, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { SeriesRowsResponse } from '../../contract'
import type { PageContext } from '../../define'
import type { SeriesDef, WideRow } from '../../_template/seriesModel'
import { displayUnit, type DisplayUnit } from '../../_template/units'
import { BID, QUANTITY, selectionOf, type Direction, type Selection } from './zones'

/** The main chart and the working panel's chart take this value-axis width, so their clocks line up. */
export const AXIS_WIDTH = 60

/** A count of bids: numbers of rows, so there is no unit to confirm. */
export const BIDS_UNIT: DisplayUnit = {
  label: 'bids',
  source: 'count',
  factor: 1,
  numeric: true,
  format: (v) => `${fmtN(v, 0)} ${v === 1 ? 'bid' : 'bids'}`,
  plain: (v) => fmtN(v, 0),
  caption: 'bids',
}

/** Totals stay in MW: a zone's total runs from tens of MW to a few thousand, and GW would hide the smaller. */
export const MW_UNIT = displayUnit('MW', 'MW')

export interface Book {
  /** One row per step of the window: `total` (MW, null when not summed or not held) and `bids`. */
  rows: WideRow[]
  /** Only the steps some bid holds. */
  heldRows: WideRow[]
  total: SeriesDef
  bids: SeriesDef
  stepMs: number | null
  /** The rows are each bid's mean over a longer step: no MW is added up. */
  bucketed: boolean
  /** Steps some bid holds, and the steps the window's days hold on this clock (null off an hourly-or-finer clock). */
  held: number
  expected: number | null
  /** Different bids holding a value in the window. */
  bidCount: number
  /** The largest one bid offered at one step (not for means). */
  largest: { t: number; v: number; bid: string } | null
  /** Every bid offering that largest MW at some step, and at how many bid-steps: ties are named, not settled. */
  largestBids: string[]
  largestSteps: number
  /** Each held step's largest bid (not for means). */
  tops: Map<number, { v: number; bid: string }>
  /** No held step sits next to another: points, not a run, so bars rather than a band. */
  isolated: boolean
  /** The most steps any UK day of the window holds. */
  mostPerDay: number
  /** Steps holding each number of bids, largest count first: `[[100, 7]]` reads "7 steps hold 100 bids". */
  bidsPerStep: [number, number][]
}

const cache = new WeakMap<SeriesRowsResponse, Book>()

function def(key: string, label: string, color: string, unit: DisplayUnit, column: string): SeriesDef {
  return { key, field: key, column, group: null, label, color, unit, from: 'self', count: 0, mean: null, min: null, max: null, signed: false }
}

function tally(d: SeriesDef, rows: WideRow[]) {
  let sum = 0
  for (const r of rows) {
    const v = r[d.field]
    if (typeof v !== 'number') continue
    d.count += 1
    sum += v
    d.min = d.min === null ? v : Math.min(d.min, v)
    d.max = d.max === null ? v : Math.max(d.max, v)
  }
  d.mean = d.count ? sum / d.count : null
}

/** The bids of a read, added up per step. */
export function bookOf(response: SeriesRowsResponse, dir: Direction, window: DateRange | null): Book {
  const hit = cache.get(response)
  if (hit) return hit
  const bucketed = response.truncation?.bucket_ms != null
  const stepMs = response.truncation?.bucket_ms ?? response.grain_ms
  type Acc = { total: number; bids: number; top: number | null; topBid: string | null }
  const byT = new Map<number, Acc>()
  const ids = new Set<string>()
  for (const r of response.rows) {
    let a = byT.get(r.ts)
    if (!a) {
      a = { total: 0, bids: 0, top: null, topBid: null }
      byT.set(r.ts, a)
    }
    const v = r[QUANTITY]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    a.total += v
    a.bids += 1
    const bid = String(r[BID] ?? '')
    ids.add(bid)
    if (a.top === null || v > a.top) {
      a.top = v
      a.topBid = bid
    }
  }
  const rows: WideRow[] = []
  let largest: Book['largest'] = null
  const tops = new Map<number, { v: number; bid: string }>()
  for (const [t, a] of [...byT.entries()].sort((x, y) => x[0] - y[0])) {
    const held = a.bids > 0
    rows.push({ t, total: held && !bucketed ? a.total : null, bids: held ? a.bids : null })
    if (bucketed || a.top === null || a.topBid === null) continue
    tops.set(t, { v: a.top, bid: a.topBid })
    if (!largest || a.top > largest.v) largest = { t, v: a.top, bid: a.topBid }
  }
  const largestBids = new Set<string>()
  let largestSteps = 0
  if (largest) {
    for (const r of response.rows) {
      if (r[QUANTITY] !== largest.v) continue
      largestBids.add(String(r[BID] ?? ''))
      largestSteps += 1
    }
  }
  const heldRows = rows.filter((r) => typeof r.bids === 'number')
  const total = def('total', `Offered, ${dir.label}`, dir.color, MW_UNIT, QUANTITY)
  const bids = def('bids', 'Bids offered', 'var(--chart-fan-soft)', BIDS_UNIT, BID)
  tally(total, rows)
  tally(bids, rows)

  let isolated = stepMs !== null && heldRows.length > 0
  for (let i = 1; i < heldRows.length && isolated; i += 1) if (stepMs !== null && heldRows[i].t - heldRows[i - 1].t <= stepMs) isolated = false

  const perDay = new Map<number, number>()
  for (const r of heldRows) {
    const d = londonMidnight(r.t)
    perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }

  const perStep = new Map<number, number>()
  for (const r of heldRows) if (typeof r.bids === 'number') perStep.set(r.bids, (perStep.get(r.bids) ?? 0) + 1)

  let expected: number | null = window ? 0 : null
  if (window && !(bucketed && stepMs !== null && stepMs > HOUR_MS)) {
    for (const iso of datesBetween(window.start, window.end)) {
      const n = stepsInDay(dayStart(iso), stepMs)
      expected = n === null || expected === null ? null : expected + n
    }
  } else expected = null

  const book: Book = {
    rows,
    heldRows,
    total,
    bids,
    stepMs,
    bucketed,
    held: heldRows.length,
    expected,
    bidCount: ids.size,
    largest,
    largestBids: [...largestBids],
    largestSteps,
    tops,
    isolated,
    mostPerDay: Math.max(0, ...perDay.values()),
    bidsPerStep: [...perStep.entries()].sort((a, b) => b[0] - a[0]),
  }
  cache.set(response, book)
  return book
}

export interface DayFigures {
  day: string
  start: number
  /** Steps the day holds on the clock; null for means over steps longer than an hour, which straddle UK days. */
  expected: number | null
  held: number
  /** Different bids holding a value in the day's steps. */
  bids: number
  /** The most bids in one of the day's steps. */
  mostBids: number | null
  /** The total's mean over the steps held, lowest and highest; null when not summed. */
  mean: number | null
  low: { t: number; v: number } | null
  high: { t: number; v: number } | null
}

/**
 * Each UK day of the window, held or not: how many steps it holds, how many
 * different bids, and the total's mean, lowest and highest over the steps
 * held. A step longer than an hour counts in the day it starts in.
 */
export function dayFigures(response: SeriesRowsResponse, book: Book, window: DateRange): DayFigures[] {
  const bidsByDay = new Map<number, Set<string>>()
  for (const r of response.rows) {
    if (typeof r[QUANTITY] !== 'number') continue
    const d = londonMidnight(r.ts)
    let s = bidsByDay.get(d)
    if (!s) {
      s = new Set()
      bidsByDay.set(d, s)
    }
    s.add(String(r[BID] ?? ''))
  }
  const rowsByDay = new Map<number, WideRow[]>()
  for (const r of book.heldRows) {
    const d = londonMidnight(r.t)
    const list = rowsByDay.get(d)
    if (list) list.push(r)
    else rowsByDay.set(d, [r])
  }
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    const rows = rowsByDay.get(start) ?? []
    let sum = 0
    let n = 0
    let low: DayFigures['low'] = null
    let high: DayFigures['high'] = null
    let mostBids: number | null = null
    for (const r of rows) {
      if (typeof r.bids === 'number') mostBids = mostBids === null ? r.bids : Math.max(mostBids, r.bids)
      const v = r.total
      if (typeof v !== 'number') continue
      sum += v
      n += 1
      if (!low || v < low.v) low = { t: r.t, v }
      if (!high || v > high.v) high = { t: r.t, v }
    }
    return {
      day,
      start,
      expected: book.bucketed && book.stepMs !== null && book.stepMs > HOUR_MS ? null : stepsInDay(start, book.stepMs),
      held: rows.length,
      bids: bidsByDay.get(start)?.size ?? 0,
      mostBids,
      mean: n ? sum / n : null,
      low,
      high,
    }
  })
}

/** `1,234`. */
export const n = (x: number) => x.toLocaleString('en-GB')

/** The zone and direction shown, and their bids added up once the rows are read. */
export function pageBook(ctx: PageContext): Selection & { book: Book | null } {
  const sel = selectionOf(ctx.response?.filters, ctx.param)
  const response = ctx.response
  const book = response && response.kind === 'series' ? bookOf(response, sel.dir, ctx.window) : null
  return { ...sel, book }
}
