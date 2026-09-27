/**
 * What the benchmark page's panels share: its two columns, and the figures
 * read from the rows the template built (`ctx.series`). Nothing here is
 * filled in: a clock time or a day with nothing held gets a null, never a
 * zero, and the charts break there.
 */
import { clock, datesBetween, dayStart, londonMidnight, HOUR_MS } from '../../../design/time'
import { CHART } from '../../../design/chartTheme'
import type { DateRange } from '../../../lib/range'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'

export const PRICE = 'benchmark_price_gbp_mwh'
export const VOLUME = 'benchmark_volume_mwh'

/** The pilot page this benchmark is read from, as the market index. */
export const MID_ROUTE = '/sources/elexon/market-index-price'

/** The clock-time chart's lowest-to-highest band, and its key mark: the fan's two outer bands' weight. */
export const RANGE_OPACITY = CHART.fan.b90 + CHART.fan.b80

/** A column's series in the model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

/** Minutes past midnight on the UK clock (a clock-change day's repeated hour shares its clock times). */
export function clockMinute(t: number): number {
  const [h, m] = clock(t).split(':').map(Number)
  return h * 60 + m
}

/** `14:30–15:00` for a clock time and a step in minutes. */
export function slotText(minute: number, stepMin: number): string {
  const f = (x: number) => `${String(Math.floor((x % 1440) / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`
  return `${f(minute)}–${f(minute + stepMin)}`
}

export interface Slot {
  /** Minutes past midnight, UK clock. */
  minute: number
  /** Values held at this clock time in the window. */
  n: number
  mean: number | null
  low: { t: number; v: number } | null
  high: { t: number; v: number } | null
  /** The picked day's value at this clock time, when a day is picked. */
  day: number | null
}

/**
 * The window's values gathered by UK clock time: one slot per step of the
 * day, each with how many values it holds and their mean, lowest and
 * highest. Null when the clock can't be read this way: a step longer than an
 * hour, or none, straddles clock times.
 */
export function profileOf(model: SeriesModel, def: SeriesDef, picked: number | undefined): { slots: Slot[]; stepMin: number } | null {
  const step = model.stepMs
  if (step === null || step > HOUR_MS || HOUR_MS % step !== 0) return null
  const stepMin = step / 60000
  const acc = new Map<number, { n: number; sum: number; low: Slot['low']; high: Slot['high']; day: number | null }>()
  for (let m = 0; m < 1440; m += stepMin) acc.set(m, { n: 0, sum: 0, low: null, high: null, day: null })
  for (const row of model.rows) {
    const v = row[def.field]
    if (typeof v !== 'number') continue
    const s = acc.get(clockMinute(row.t))
    if (!s) continue
    s.n += 1
    s.sum += v
    if (!s.low || v < s.low.v) s.low = { t: row.t, v }
    if (!s.high || v > s.high.v) s.high = { t: row.t, v }
    // On the long clock-change day the repeated hour holds two values; the picked line shows the first.
    if (picked !== undefined && londonMidnight(row.t) === picked && s.day === null) s.day = v
  }
  const slots = [...acc.entries()].map(([minute, s]) => ({ minute, n: s.n, mean: s.n ? s.sum / s.n : null, low: s.low, high: s.high, day: s.day }))
  return { slots, stepMin }
}

/**
 * The mean weighted by volume, over the half-hours that hold both a price
 * and a volume; null when none do, or the volumes sum to nothing. Only for
 * rows as published: a window read as means has no volume to weight by.
 */
export function volumeWeighted(model: SeriesModel, price: SeriesDef, volume: SeriesDef): { v: number; n: number } | null {
  if (model.bucketed) return null
  let pv = 0
  let vol = 0
  let n = 0
  for (const row of model.rows) {
    const p = row[price.field]
    const q = row[volume.field]
    if (typeof p !== 'number' || typeof q !== 'number') continue
    pv += p * q
    vol += q
    n += 1
  }
  return n && vol > 0 ? { v: pv / vol, n } : null
}

/** Each UK day of the window: the volume summed over its held half-hours, and how many held one; null sum when none did. */
export function volumeByDay(model: SeriesModel, window: DateRange, def: SeriesDef): Map<number, { sum: number | null; held: number }> {
  const sums = new Map<number, { sum: number; held: number }>()
  for (const row of model.rows) {
    const v = row[def.field]
    if (typeof v !== 'number') continue
    const day = londonMidnight(row.t)
    const s = sums.get(day) ?? { sum: 0, held: 0 }
    s.sum += v
    s.held += 1
    sums.set(day, s)
  }
  return new Map(
    datesBetween(window.start, window.end).map((iso) => {
      const start = dayStart(iso)
      const s = sums.get(start)
      return [start, s ? s : { sum: null, held: 0 }]
    }),
  )
}
