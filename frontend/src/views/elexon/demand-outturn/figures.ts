/**
 * What the demand outturn panels share: the column ids, one colour per
 * measure (a colour follows its measure wherever it is drawn), the value-axis
 * width that lines the working panel's chart up under the main one, and the
 * figures read from the rows. Nothing is filled in: a half-hour missing from
 * either measure has no gap figure, never a zero.
 */
import { datesBetween, dayStart, londonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { SeriesDef, SeriesModel, WideRow } from '../../_template/seriesModel'

export const INDO = 'initial_demand_outturn_mw'
export const ITSDO = 'initial_transmission_system_demand_outturn_mw'
export const ATL = 'total_load_mw'
/** INDOD's column carries the same name as INDO's; its unit is not confirmed. */
export const INDOD = 'initial_demand_outturn_mw'

export const COLORS = {
  national: 'var(--chart-actual)',
  transmission: 'var(--chart-fan)',
  load: 'var(--chart-fan-soft)',
  gap: 'var(--chart-price-2)',
} as const

/** The key of the related transmission demand read beside national demand. */
export const TSD_KEY = 'tsd'
/** The key of the related national demand read beside the daily figure. */
export const NATIONAL_KEY = 'national'

/** Both charts' value axes take this width, so their clocks line up. */
export const AXIS_WIDTH = 52

/** A column's series in a model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null | undefined, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

/**
 * Transmission demand less national demand at each half-hour both hold a
 * value, in the models' display unit (GW). A half-hour either lacks is null:
 * a gap in the bars, not a zero.
 */
export function gapRows(national: SeriesModel, nDef: SeriesDef, transmission: SeriesModel, tDef: SeriesDef): { rows: WideRow[]; count: number; sum: number; min: number | null; max: number | null } {
  const tAt = new Map(transmission.rows.map((r) => [r.t, r[tDef.field]]))
  let count = 0
  let sum = 0
  let min: number | null = null
  let max: number | null = null
  const rows = national.rows.map((r) => {
    const n = r[nDef.field]
    const t = tAt.get(r.t)
    if (typeof n !== 'number' || typeof t !== 'number') return { t: r.t, gap: null }
    const g = t - n
    count += 1
    sum += g
    min = min === null ? g : Math.min(min, g)
    max = max === null ? g : Math.max(max, g)
    return { t: r.t, gap: g }
  })
  return { rows, count, sum, min, max }
}

/** Per UK day of the window: a series' values summed over the half-hours held, and how many held one. */
export function sumsByDay(model: SeriesModel, window: DateRange, def: SeriesDef): Map<number, { sum: number | null; held: number }> {
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
      return [start, s ?? { sum: null, held: 0 }]
    }),
  )
}
