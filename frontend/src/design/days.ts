/**
 * A window's rows grouped by UK day, one entry for every day in the window
 * whether or not it is held, so a missing day is listed as missing rather
 * than silently dropped. `expected` is the half-hours the day has on the UK
 * clock (48, or 46 and 50 on clock-change days), so a partial day can say so.
 */
import type { DateRange } from '../lib/range'
import { datesBetween, dayStart, halfHoursInDay, londonMidnight } from './time'

export interface DayGroup<T> {
  /** `YYYY-MM-DD` on the UK clock. */
  day: string
  /** The instant the day starts (London midnight). */
  start: number
  rows: T[]
  /** Half-hours in the day on the UK clock. */
  expected: number
}

export function daysInWindow<T extends { t: number }>(rows: T[], range: DateRange): DayGroup<T>[] {
  const byStart = new Map<number, T[]>()
  for (const r of rows) {
    const d = londonMidnight(r.t)
    const list = byStart.get(d)
    if (list) list.push(r)
    else byStart.set(d, [r])
  }
  return datesBetween(range.start, range.end).map((day) => {
    const start = dayStart(day)
    return { day, start, rows: byStart.get(start) ?? [], expected: halfHoursInDay(start) }
  })
}

/** Days held for only part of their half-hours, in plain words: `Wed 16 Sep holds 39 of 48 half-hours.` */
export function partialDays<T>(days: DayGroup<T>[]): DayGroup<T>[] {
  return days.filter((d) => d.rows.length > 0 && d.rows.length < d.expected)
}
