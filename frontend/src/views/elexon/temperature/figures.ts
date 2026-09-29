/**
 * What the temperature panels share: the column ids, one colour per measure,
 * the unit as printed, and the figures read from the rows. `temp` holds one figure per UK day, placed on the day
 * it was measured; a day not held is a gap, never a zero.
 */
import { fmtN, listText } from '../../../design/format'
import { dayStart, londonMidnight, shiftDate, ukDate } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import { plannedParts } from '../../_template/panelHelpers'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'
import type { PageContext } from '../../define'

export const TEMP = 'temperature'
/** National demand per half-hour (`indo`), read beside the temperature. */
export const INDO = 'initial_demand_outturn_mw'
/** The key of the related national demand. */
export const DEMAND_KEY = 'demand'

export const COLORS = {
  temp: 'var(--chart-price-2)',
  demand: 'var(--chart-actual)',
} as const

/** The temperature's unit as printed (`°C`): from the rows read, else as planned from the source list. */
export function tempUnit(ctx: PageContext): string | null | undefined {
  const t = seriesOf(ctx.series, TEMP)
  return t ? t.unit.label : plannedParts(ctx).unit
}

/** A figure at the one decimal the rows hold: two days tie when these match. */
export const tempText = (v: number) => fmtN(v, 1)

/** A column's series in a model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null | undefined, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

/** Each held day's figure, oldest first, with the London midnight starting its day. */
export function heldFigures(model: SeriesModel, def: SeriesDef): { day: number; v: number }[] {
  const out: { day: number; v: number }[] = []
  for (const r of model.rows) {
    const v = r[def.field]
    if (typeof v === 'number') out.push({ day: londonMidnight(r.t), v })
  }
  return out
}

export interface SpanMean {
  /** The last day of the span: the latest day held. */
  last: number
  /** Days of the span inside this window (7, or fewer when the window is shorter). */
  days: number
  held: number
  mean: number
}

/**
 * The mean of the figures held on the 7 UK days ending on the latest day
 * held, counting only days inside the window read. Null when fewer than two
 * days are held there: one figure is not a mean.
 */
export function sevenDayMean(held: { day: number; v: number }[], window: DateRange): SpanMean | null {
  const latest = held[held.length - 1]
  if (!latest) return null
  const lastIso = ukDate(latest.day)
  const spanStart = shiftDate(lastIso, -6)
  const from = spanStart < window.start ? window.start : spanStart
  const firstMs = dayStart(from)
  const inSpan = held.filter((h) => h.day >= firstMs && h.day <= latest.day)
  if (inSpan.length < 2) return null
  const days = Math.round((dayStart(lastIso) - firstMs) / 86_400_000) + 1
  return { last: latest.day, days, held: inSpan.length, mean: inSpan.reduce((s, h) => s + h.v, 0) / inSpan.length }
}

/** `Fri 18 Sep and Mon 21 Sep`: every held day at a value, as the rows round it, so a tie is never hidden. */
export function daysAt(held: { day: number; v: number }[], v: number, label: (ms: number) => string): string {
  const at = held.filter((h) => tempText(h.v) === tempText(v)).map((h) => label(h.day))
  if (at.length <= 3) return listText(at)
  return `${listText(at.slice(0, 2))} and ${at.length - 2} more days`
}
