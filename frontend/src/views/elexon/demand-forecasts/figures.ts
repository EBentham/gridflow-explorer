/**
 * What the demand forecast panels share: the column and dataset ids, one
 * colour per measure (a colour follows its measure wherever it is drawn), the
 * value-axis width that lines the working panel's chart up under the main
 * one, and the figures read from the rows: how far ahead each held forecast
 * was issued, the forecast against outturn half-hour by half-hour, and the
 * daily forecasts lined up by delivery date. Nothing is filled in: a step
 * either side lacks has no error, never a zero.
 */
import { daysInWindow } from '../../../design/days'
import { DAY_MS, datesBetween, dayStart, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { RowsResponse } from '../../contract'
import type { PageContext, RelatedData } from '../../define'
import { ISSUED, issuedAt } from '../../_template/issues'
import { seriesOf, type SeriesDef, type SeriesModel } from '../../_template/seriesModel'
import { displayUnit } from '../../_template/units'

export const NDF = 'ndf'
export const TSDF = 'tsdf'
export const NDFD = 'ndfd'
export const TSDFD = 'tsdfd'

/** National demand forecast: `ndf` and `ndfd` carry the same column. */
export const NATIONAL_FC = 'national_demand_mw'
/** Transmission demand forecast: `tsdf` and `tsdfd` carry the same column. */
export const TRANSMISSION_FC = 'forecast_demand_mw'
export const INDO = 'initial_demand_outturn_mw'
export const ITSDO = 'initial_transmission_system_demand_outturn_mw'
export const FORECAST_TYPE = 'forecast_type'

/** The key of the outturn read beside a half-hourly forecast, and beside a daily one. */
export const OUTTURN_KEY = 'outturn'
/** The key of the other daily forecast read beside a daily one. */
export const OTHER_KEY = 'other'

export const COLORS = {
  national: 'var(--chart-fan)',
  transmission: 'var(--chart-fan-soft)',
  outturn: 'var(--chart-actual)',
  outturnMean: 'var(--chart-price-2)',
  error: 'var(--fuel-other)',
} as const

export const GW_UNIT = displayUnit('MW')
/** A signed GW figure from GW: `+0.4`, with a true minus below zero. */
export const signedGw = (v: number) => {
  const text = GW_UNIT.plain(v)
  return `${Number(text.replace('−', '-')) > 0 ? '+' : ''}${text}`
}

/** The page's forecast column: national for `ndf`/`ndfd`, transmission for `tsdf`/`tsdfd`. */
export const forecastColumn = (datasetId: string) => (datasetId === NDF || datasetId === NDFD ? NATIONAL_FC : TRANSMISSION_FC)

// ---------------------------------------------------------------- daily forecasts, by delivery date

/** A daily forecast's figure for one delivery date, in MW as published, and when it was issued. */
export interface DailyFigure {
  mw: number
  issued: number | null
}

/**
 * A daily forecast's figures by delivery date (`YYYY-MM-DD`). The national
 * figure is stamped at UK midnight and the transmission figure at UTC
 * midnight, an hour apart in summer, so the two line up on the date the
 * rows carry, never on the stamp.
 */
export function dailyByDate(response: RowsResponse | null | undefined, column: string): Map<string, DailyFigure> {
  const out = new Map<string, DailyFigure>()
  if (!response || response.kind !== 'series') return out
  for (const r of response.rows) {
    const v = r[column]
    if (typeof v !== 'number') continue
    const date = typeof r.settlement_date === 'string' ? r.settlement_date : typeof r.forecast_date === 'string' ? r.forecast_date : null
    if (!date) continue
    out.set(date, { mw: v, issued: issuedAt(r[ISSUED]) })
  }
  return out
}

/** Whole UK days from the day a forecast was issued to its delivery date: `2` for a forecast issued on the 21st for the 23rd. */
export function daysAhead(date: string, issued: number): number {
  return Math.round((dayStart(date) - londonMidnight(issued)) / DAY_MS)
}

/** The page's daily forecast and the other one: which is national and which transmission. */
export function dailyPair(ctx: PageContext): { national: Map<string, DailyFigure>; transmission: Map<string, DailyFigure>; other: RelatedData | undefined; ownIsNational: boolean } {
  const ownIsNational = ctx.dataset.id === NDFD
  const other = ctx.related[OTHER_KEY]
  const own = dailyByDate(ctx.response, forecastColumn(ctx.dataset.id))
  const theirs = dailyByDate(other?.response, ownIsNational ? TRANSMISSION_FC : NATIONAL_FC)
  return ownIsNational ? { national: own, transmission: theirs, other, ownIsNational } : { national: theirs, transmission: own, other, ownIsNational }
}

/** The outturn a forecast is set against: national demand for the national forecasts, transmission demand for the transmission ones. */
export const outturnColumn = (datasetId: string) => (datasetId === NDF || datasetId === NDFD ? INDO : ITSDO)

/** One delivery day of the window with both daily forecasts, and the page's own measure's outturn peak and mean on it. */
export interface DeliveryDay {
  date: string
  start: number
  national: DailyFigure | null
  transmission: DailyFigure | null
  /** The outturn's half-hours held that day, and those the day has. */
  held: number
  expected: number | null
  /** The outturn's peak and mean, GW, on a day holding every half-hour only. */
  peak: number | null
  mean: number | null
}

export function deliveryDays(ctx: PageContext): DeliveryDay[] {
  if (!ctx.window) return []
  const { national, transmission } = dailyPair(ctx)
  const oModel = ctx.related[OUTTURN_KEY]?.series ?? null
  const oDef = seriesOf(oModel, outturnColumn(ctx.dataset.id))
  const byDay = new Map<number, { held: number; expected: number | null; peak: number | null; mean: number | null }>()
  if (oModel && oDef && !oModel.bucketed) {
    // Bucket means would give a mean of means and no true peak, so only half-hours as held are read.
    for (const d of outturnDays(oModel, oDef, ctx.window)) byDay.set(d.start, d)
  }
  return datesBetween(ctx.window.start, ctx.window.end).map((date) => {
    const start = dayStart(date)
    const o = byDay.get(start)
    return {
      date,
      start,
      national: national.get(date) ?? null,
      transmission: transmission.get(date) ?? null,
      held: o?.held ?? 0,
      expected: o?.expected ?? null,
      peak: o?.peak ?? null,
      mean: o?.mean ?? null,
    }
  })
}

/** Outturn per UK day: half-hours held, and the peak and mean where the day holds every one. */
function outturnDays(model: SeriesModel, def: SeriesDef, window: DateRange): { start: number; held: number; expected: number | null; peak: number | null; mean: number | null }[] {
  return daysInWindow(model.rows, window).map(({ start, rows }) => {
    const vs = rows.map((r) => r[def.field]).filter((v): v is number => typeof v === 'number')
    const expected = stepsInDay(start, model.stepMs)
    const complete = expected !== null && vs.length === expected
    return {
      start,
      held: vs.length,
      expected,
      peak: complete ? Math.max(...vs) : null,
      mean: complete ? vs.reduce((a, b) => a + b, 0) / vs.length : null,
    }
  })
}
