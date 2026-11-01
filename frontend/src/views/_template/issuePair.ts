/**
 * Two day-ahead datasets read as one pair: the page's own and the other one,
 * read beside it under `OTHER_KEY`, joined on the half-hour, each figure
 * with the issue it comes from (Elexon's indicated demand and generation,
 * and indicated imbalance and margin). The two sides are `a` and `b` whichever
 * dataset is open; `ownIsA` says which is the page's own. Nothing is filled
 * in: a half-hour either side lacks is a gap, never a zero.
 */
import { HOUR_MS, stepsInDay } from '../../design/time'
import { daysInWindow } from '../../design/days'
import type { DateRange } from '../../lib/range'
import type { SeriesRow } from '../contract'
import type { PageContext, RelatedData } from '../define'
import { ISSUED, issuedAt, issuesIn, issueTally } from './issues'
import { extremesIn, type SeriesDef, type SeriesModel, type Settlement, type WideRow } from './seriesModel'
import { displayUnit } from './units'

/** The key of the other dataset, read beside the page's own. */
export const OTHER_KEY = 'other'

/** One side of the pair. */
export interface PairSide {
  dataset: string
  column: string
  label: string
  color: string
  /** Held negative, so drawn with its sign turned (indicated demand). */
  flip?: boolean
}

/** One half-hour of the pair, GW for the charts (a flipped side turned). */
export interface PairRow extends WideRow {
  a: number | null
  b: number | null
  /** Hours the page's own figure was issued ahead of its half-hour. */
  l: number | null
}

/** One half-hour as held, in MW, with each figure's issue: the table reads these. */
export interface PairCell {
  aMw: number | null
  bMw: number | null
  aIssued: number | null
  bIssued: number | null
}

export interface Pair {
  ownIsA: boolean
  rows: PairRow[]
  cells: Map<number, PairCell>
  stepMs: number | null
  bucketed: boolean
  settlement: Map<number, Settlement> | null
  /** Each side's chart series, when it is held (the other's only when paired). */
  a: SeriesDef | null
  b: SeriesDef | null
  own: SeriesDef | null
  other: SeriesDef | null
  /** The other dataset, and why it isn't paired when it isn't. */
  related: RelatedData | undefined
  otherState: 'paired' | 'failed' | 'loading' | 'none held' | 'other clock'
  /** Half-hours where both are held with issue times, where those differ, and the widest difference. */
  bothHeld: number
  issueMismatch: number
  widestMismatch: number
}

const GW = displayUnit('MW')

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

/** Each held row's issue time, by half-hour. */
function issuesBy(rows: SeriesRow[] | undefined, column: string): Map<number, number> {
  const out = new Map<number, number>()
  for (const r of rows ?? []) {
    if (typeof r[column] !== 'number') continue
    const at = issuedAt(r[ISSUED])
    if (at !== null) out.set(r.ts, at)
  }
  return out
}

function def(side: PairSide, key: 'a' | 'b', count: number): SeriesDef {
  return { key, field: key, column: side.column, group: null, label: side.label, color: side.color, unit: GW, from: 'pair', count, mean: null, min: null, max: null, signed: false }
}

/** The page's own dataset and the other one, joined on the half-hour. */
export function pairOf(ctx: PageContext, a: PairSide, b: PairSide): Pair | null {
  const model = ctx.series
  if (!model) return null
  const ownIsA = ctx.dataset.id === a.dataset
  const ownSide = ownIsA ? a : b
  const otherSide = ownIsA ? b : a
  const ownDef = model.all.find((d) => d.column === ownSide.column)
  if (!ownDef) return null
  const related = ctx.related[OTHER_KEY]
  const oModel = related?.series ?? null
  const oDef = oModel?.all.find((d) => d.column === otherSide.column) ?? null
  const clockOk = Boolean(oModel && oModel.stepMs === model.stepMs && oModel.bucketed === model.bucketed)
  const otherState: Pair['otherState'] = !related
    ? 'none held'
    : related.state === 'error' || related.state === 'refreshing'
      ? 'failed'
      : !oModel
        ? related.state === 'empty'
          ? 'none held'
          : 'loading'
        : !oDef || oDef.count === 0
          ? 'none held'
          : clockOk
            ? 'paired'
            : 'other clock'
  const paired = otherState === 'paired'

  const own = heldBy(model, ownDef)
  const theirs = paired && oModel && oDef ? heldBy(oModel, oDef) : new Map<number, number | null>()
  const ownIssues = model.bucketed ? new Map<number, number>() : issuesBy(ctx.response?.kind === 'series' ? ctx.response.rows : undefined, ownSide.column)
  const otherRows = related?.response?.kind === 'series' ? related.response.rows : undefined
  const theirIssues = paired && !model.bucketed ? issuesBy(otherRows, otherSide.column) : new Map<number, number>()

  const times = [...new Set([...own.keys(), ...theirs.keys()])].sort((x, y) => x - y)
  const cells = new Map<number, PairCell>()
  let bothHeld = 0
  let issueMismatch = 0
  let widestMismatch = 0
  let aCount = 0
  let bCount = 0
  const gw = (side: PairSide, mw: number | null) => (mw === null ? null : (side.flip ? -mw : mw) * GW.factor)
  const rows: PairRow[] = times.map((t) => {
    const ov = own.get(t) ?? null
    const tv = theirs.get(t) ?? null
    const oi = ownIssues.get(t) ?? null
    const ti = theirIssues.get(t) ?? null
    const cell: PairCell = ownIsA ? { aMw: ov, bMw: tv, aIssued: oi, bIssued: ti } : { aMw: tv, bMw: ov, aIssued: ti, bIssued: oi }
    cells.set(t, cell)
    if (cell.aMw !== null && cell.bMw !== null && cell.aIssued !== null && cell.bIssued !== null) {
      bothHeld += 1
      if (cell.aIssued !== cell.bIssued) {
        issueMismatch += 1
        widestMismatch = Math.max(widestMismatch, Math.abs(cell.aIssued - cell.bIssued))
      }
    }
    if (cell.aMw !== null) aCount += 1
    if (cell.bMw !== null) bCount += 1
    return { t, a: gw(a, cell.aMw), b: gw(b, cell.bMw), l: ov !== null && oi !== null ? (t - oi) / HOUR_MS : null }
  })

  const aDef = (ownIsA || paired) && aCount > 0 ? def(a, 'a', aCount) : null
  const bDef = (!ownIsA || paired) && bCount > 0 ? def(b, 'b', bCount) : null
  return {
    ownIsA,
    rows,
    cells,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    a: aDef,
    b: bDef,
    own: ownIsA ? aDef : bDef,
    other: ownIsA ? bDef : aDef,
    related,
    otherState,
    bothHeld,
    issueMismatch,
    widestMismatch,
  }
}

export interface PairDay {
  date: string
  start: number
  /** Half-hours the day has, when the step is known. */
  expected: number | null
  aHeld: number
  bHeld: number
  aLow: { t: number; v: number } | null
  aHigh: { t: number; v: number } | null
  bLow: { t: number; v: number } | null
  bHigh: { t: number; v: number } | null
  /** The issues behind the page's own figures that day, newest first, with how many half-hours each gives. */
  issues: { at: number; n: number }[]
}

/** Every UK day in the window, held or not, with each side's held count and range and the day's issues. */
export function pairDays(pair: Pair, window: DateRange): PairDay[] {
  return daysInWindow(pair.rows, window).map(({ day, start, rows }) => {
    const a = extremesIn(rows, 'a')
    const b = extremesIn(rows, 'b')
    return {
      date: day,
      start,
      expected: stepsInDay(start, pair.stepMs),
      aHeld: rows.filter((r) => typeof r.a === 'number').length,
      bHeld: rows.filter((r) => typeof r.b === 'number').length,
      aLow: a?.low ?? null,
      aHigh: a?.high ?? null,
      bLow: b?.low ?? null,
      bHigh: b?.high ?? null,
      issues: issueTally(issuesIn(rows)),
    }
  })
}
