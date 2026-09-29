/**
 * Each UK day's energy by type, from half-hours as held: a half-hour's MW
 * figure times half an hour, summed over the half-hours the day holds. A day
 * missing some half-hours is summed over those it holds and marked as held in
 * part; it is never scaled up to a whole day.
 */
import { HALF_HOUR, dayStart, datesBetween, nextLondonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'

export interface TypeDay {
  def: SeriesDef
  /** Half-hours holding a figure. */
  held: number
  /** GWh over those half-hours; null when none is held. */
  gwh: number | null
}

export interface EnergyDay {
  day: string
  start: number
  /** Half-hours in the UK day (46 or 50 on clock-change days). */
  expected: number
  types: TypeDay[]
  /** Every type holds every half-hour. */
  whole: boolean
}

const HOURS = HALF_HOUR / 3_600_000

export function energyDays(model: SeriesModel, defs: SeriesDef[], window: DateRange): EnergyDay[] {
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    const end = nextLondonMidnight(start)
    const expected = stepsInDay(start, HALF_HOUR) ?? 48
    const rows = model.rows.filter((r) => r.t >= start && r.t < end)
    const types = defs.map((def) => {
      let held = 0
      let mwh = 0
      for (const r of rows) {
        const v = r[def.field]
        if (typeof v !== 'number') continue
        held += 1
        mwh += (v / def.unit.factor) * HOURS
      }
      return { def, held, gwh: held ? mwh / 1000 : null }
    })
    return { day, start, expected, types, whole: types.every((x) => x.held === expected) }
  })
}

/** A day's energy for the types given, summed, when the day is whole for each of them. */
export function wholeSum(d: EnergyDay, groups: string[]): number | null {
  const parts = d.types.filter((x) => x.def.group !== null && groups.includes(x.def.group))
  if (!parts.length || parts.some((x) => x.held !== d.expected || x.gwh === null)) return null
  return parts.reduce((a, x) => a + (x.gwh as number), 0)
}
