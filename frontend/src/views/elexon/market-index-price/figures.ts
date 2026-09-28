/**
 * What the pilot's panels share: the two columns, the value-axis width that
 * lines the volume chart up under the price chart, and each UK day's volume
 * summed over the half-hours held. Nothing here is filled in: a day with no
 * volume held sums to nothing, not zero.
 */
import { datesBetween, dayStart, londonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'

export const PRICE = 'market_index_price'
export const VOLUME = 'market_index_volume'

/** Both charts' value axes take this width, so their clocks line up. */
export const AXIS_WIDTH = 52

/** A column's series in the model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

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
