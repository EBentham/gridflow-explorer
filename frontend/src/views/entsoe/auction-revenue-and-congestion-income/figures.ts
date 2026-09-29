/**
 * The page's borders and the figures its panels read from the rows.
 *
 * - Every row held names GB as the in area and the Netherlands or Belgium as
 *   the out area. A border is named in area first, with an en dash and no
 *   arrow (`GB–Netherlands`), as on the flows and transfer capacity pages:
 *   which way the capacity sold runs isn't confirmed.
 * - Colours follow the border, as on the flows page: the Netherlands in
 *   `--chart-price-2`, Belgium in `--fuel-wind`, in the revenue bands and in
 *   the capacity allocated lines beneath them alike.
 * - A total is a sum of the hours held on the UK clock, each border-hour
 *   counted once. An hour not held adds nothing and is never counted as €0.
 *   The rows come gap-filled on the hourly clock, so a null is a missing hour.
 */
import { datesBetween, dayStart, HOUR_MS, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { GroupSpec, QuerySpec } from '../../define'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'

export const REVENUE = 'auction_revenue'
export const CONGESTION = 'congestion_income'
export const AMOUNT = 'amount_eur'
export const ALLOCATED = 'total_capacity_allocated'
export const ALLOCATED_MW = 'quantity_mw'
export const IN_AREA = 'in_area_code'
export const OUT_AREA = 'out_area_code'
/** The related read's key for the capacity allocated. */
export const ALLOC_KEY = 'allocated'

export const GB = '10YGB----------A'
export const NL = '10YNL----------L'
export const BE = '10YBE----------2'

/** GB as the in area, one series per out area: the only in area held, named so the source lines say it. */
export const GB_BORDERS: QuerySpec = { group: OUT_AREA, filters: { [IN_AREA]: GB } }

export const BORDERS: GroupSpec[] = [
  { value: NL, label: 'GB–Netherlands', color: 'var(--chart-price-2)' },
  { value: BE, label: 'GB–Belgium', color: 'var(--fuel-wind)' },
]

export const ALLOC_GROUPS: GroupSpec[] = BORDERS.map((b) => ({ ...b, label: `${b.label}, allocated` }))

export interface Tally {
  /** Hours with a value. */
  held: number
  /** Hours the UK days counted fit (23 or 25 on a clock-change day); null when the rows aren't hourly. */
  expected: number | null
  total: number
  /** Hours held at exactly €0. */
  zero: number
  high: { t: number; v: number } | null
  latest: { t: number; v: number } | null
}

export interface DayTally extends Tally {
  day: string
  start: number
}

function tally(values: { t: number; v: number }[], expected: number | null): Tally {
  let total = 0
  let zero = 0
  let high: Tally['high'] = null
  for (const p of values) {
    total += p.v
    if (p.v === 0) zero += 1
    if (!high || p.v > high.v) high = p
  }
  return { held: values.length, expected, total, zero, high, latest: values.at(-1) ?? null }
}

/** A border's values held, oldest first. */
function heldOf(model: SeriesModel, def: SeriesDef): { t: number; v: number }[] {
  const out: { t: number; v: number }[] = []
  for (const r of model.rows) {
    const v = r[def.field]
    if (typeof v === 'number') out.push({ t: r.t, v })
  }
  return out
}

/** Hourly rows only: a total of means isn't a total. */
const hourly = (model: SeriesModel) => !model.bucketed && model.stepMs === HOUR_MS

/** Every UK day of the window, held or not, with the border's figures for it. */
export function dayTallies(model: SeriesModel, def: SeriesDef, window: DateRange): DayTally[] {
  const byDay = new Map<number, { t: number; v: number }[]>()
  for (const p of heldOf(model, def)) {
    const d = londonMidnight(p.t)
    const list = byDay.get(d)
    if (list) list.push(p)
    else byDay.set(d, [p])
  }
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    return { day, start, ...tally(byDay.get(start) ?? [], hourly(model) ? stepsInDay(start, HOUR_MS) : null) }
  })
}

/** The window's figures for a border: every hour held, against the hours its UK days fit. */
export function windowTally(model: SeriesModel, def: SeriesDef, window: DateRange): Tally {
  const days = dayTallies(model, def, window)
  const expected = days.every((d) => d.expected !== null) ? days.reduce((s, d) => s + (d.expected ?? 0), 0) : null
  return tally(heldOf(model, def), expected)
}

/** Whether totals can be read: the rows are each hour as published, not bucket means. */
export const totalsReadable = hourly

/** `145 of 168`; the count alone when the day fits no more. */
export function heldText(t: Pick<Tally, 'held' | 'expected'>): string {
  const held = t.held.toLocaleString('en-GB')
  return t.expected === null || t.held >= t.expected ? held : `${held} of ${t.expected.toLocaleString('en-GB')}`
}

export const isPartial = (t: Pick<Tally, 'held' | 'expected'>) => t.held > 0 && t.expected !== null && t.held < t.expected

/** The page's own borders, in the page's order. */
export const bordersOf = (model: SeriesModel | null): SeriesDef[] => (model ? model.drawn.filter((d) => d.from === 'self') : [])

/**
 * The UK days on which the capacity allocated beneath holds fewer hours on
 * some border than that border's revenue: so a line ending early reads as
 * not held there, not as a fall to zero.
 */
export function fewerAllocatedDays(model: SeriesModel, alloc: SeriesModel, window: DateRange): number[] {
  const out = new Set<number>()
  for (const own of bordersOf(model)) {
    const revenue = dayTallies(model, own, window)
    const beside = alloc.all.find((d) => d.group === own.group)
    const allocated = beside ? dayTallies(alloc, beside, window) : null
    revenue.forEach((d, i) => {
      if (d.held > 0 && (allocated?.[i].held ?? 0) < d.held) out.add(d.start)
    })
  }
  return [...out].sort((a, b) => a - b)
}
