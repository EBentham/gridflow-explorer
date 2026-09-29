/**
 * What the embedded forecast page's panels share: the four columns, the
 * colours (embedded wind hatched as on the historic generation mix page, solar
 * in its fuel colour), the related mix's columns, and the figures read from
 * the rows themselves: which forecast issue each half-hour comes from and how
 * far ahead it was made, the capacity NESO assumed, and each UK day's figures.
 * Nothing here is filled in: a half-hour with no value is left out of every
 * figure, never counted as zero.
 */
import { plural } from '../../../design/format'
import { DAY_MS, HOUR_MS, MINUTE_MS, datesBetween, dayStart, instantLabel, londonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { RowsResponse } from '../../contract'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'

export const WIND_FC = 'embedded_wind_forecast'
export const WIND_CAP = 'embedded_wind_capacity'
export const SOLAR_FC = 'embedded_solar_forecast'
export const SOLAR_CAP = 'embedded_solar_capacity'

/** The related historic generation mix, and its two columns set beside the forecast. */
export const MIX_KEY = 'mix'
export const MIX_WIND = 'wind_emb'
export const MIX_SOLAR = 'solar'

/** The embedded-wind hatch's id: `WindHatch.tsx` draws the pattern in the main panel. */
export const WIND_HATCH_ID = 'ewsf-wind-hatch'

/** The same hatch in CSS for the key's swatch, 45° like the pattern: 1.5px of chart surface every 5px. */
export const WIND_STRIPE = 'repeating-linear-gradient(45deg, var(--fuel-wind) 0 3.5px, var(--chart-surface) 3.5px 5px)'

export const WIND_COLOR = 'var(--fuel-wind)'
export const SOLAR_COLOR = 'var(--fuel-solar)'
export const RECORDED_COLOR = 'var(--chart-actual)'

/** The working panel's charts share this value-axis width with the main chart, so the clocks line up. */
export const AXIS_WIDTH = 44

/** A column's series in a model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null | undefined, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

/** A column's id in the template's focus and keys: the rows aren't split, so it is `self/<column>`. */
export const idOf = (column: string) => `self/${column}`

// ---------------------------------------------------------------- the forecast issue

/**
 * `6 days`, `13 h`, `35 min`: how long before its half-hour a forecast was
 * issued, rounded down to whole days past two days. Joined with non-breaking
 * spaces, so a lead never wraps mid-figure.
 */
export function leadText(ms: number): string {
  const words = (() => {
    const min = Math.floor(ms / MINUTE_MS)
    if (min < 60) return `${min} min`
    if (ms < 2 * DAY_MS) return `${Math.floor(ms / HOUR_MS)} h`
    return `${Math.floor(ms / DAY_MS)} days`
  })()
  return words.replace(/ /g, ' ')
}

export interface Issues {
  /** Each issue time held behind a forecast value in the window, oldest first. */
  times: number[]
  /** How long before its half-hour each forecast value was issued: the shortest and the longest. */
  shortest: number
  longest: number
  /** Half-hours with a forecast value and an issue time. */
  count: number
  /** Of those, the half-hours that had already begun when their forecast was issued. */
  late: number
}

const heldValue = (r: Record<string, unknown>) => typeof r[WIND_FC] === 'number' || typeof r[SOLAR_FC] === 'number'

/**
 * The issues behind the forecast values in the window, read from the rows'
 * own `issue_time`, and how far ahead of each half-hour they were made. Null
 * when no row carries both a value and an issue time (rows read as means
 * carry none).
 */
export function issuesOf(response: RowsResponse | null | undefined): Issues | null {
  if (!response || response.kind !== 'series') return null
  const times = new Set<number>()
  let shortest = Infinity
  let longest = -Infinity
  let count = 0
  let late = 0
  for (const r of response.rows) {
    if (!heldValue(r) || typeof r.issue_time !== 'string') continue
    const at = Date.parse(r.issue_time)
    if (!Number.isFinite(at)) continue
    times.add(at)
    const lead = r.ts - at
    shortest = Math.min(shortest, lead)
    longest = Math.max(longest, lead)
    count += 1
    if (lead < 0) late += 1
  }
  if (!count) return null
  return { times: [...times].sort((a, b) => a - b), shortest, longest, count, late }
}

/**
 * How far ahead the window's forecasts were made: `6 days to 13 days`, or
 * `up to 13 days` when some half-hours had already begun at their issue,
 * which `late` then says in words (a lead is measured to the half-hour's start).
 */
export function aheadParts(issues: Issues): { value: string; late: string | null } {
  const { shortest, longest } = issues
  if (shortest >= 0) return { value: shortest === longest ? leadText(shortest) : `${leadText(shortest)} to ${leadText(longest)}`, late: null }
  const n = issues.late
  const late = `${n === 1 ? 'One half-hour' : `${plural(n, 'half-hour', 'half-hours')}`} had already begun when ${n === 1 ? 'its' : 'their'} forecast was issued, by ${n === 1 ? '' : 'up to '}${leadText(-shortest)}.`
  return { value: longest >= 0 ? `up to ${leadText(longest)}` : 'none', late }
}

/** Which forecast the window's half-hours come from, and how far ahead it was made. */
export function vintageText(issues: Issues): string {
  const { value, late } = aheadParts(issues)
  const ahead = value.startsWith('up to') || !value.includes(' to ') ? value : `between ${value.replace(' to ', ' and ')}`
  const tail = late ? ` ${late}` : ''
  const when = (t: number) => instantLabel(t, { year: true })
  if (issues.times.length === 1) {
    return `Every half-hour here comes from one forecast, issued ${when(issues.times[0])}, made ${ahead} before the half-hour it is for.${tail}`
  }
  const newest = issues.times[issues.times.length - 1]
  return `The half-hours here come from ${plural(issues.times.length, 'issue', 'issues')} of the forecast, the oldest issued ${when(issues.times[0])} and the newest ${when(newest)}. Each half-hour shows the latest issue held for it, made ${ahead} before it.${tail}`
}

/** A capacity column's values in the window: lowest and highest, or null when none is held. */
export function capacityOf(model: SeriesModel | null | undefined, column: string): { def: SeriesDef; min: number; max: number } | null {
  const def = seriesOf(model, column)
  if (!def || def.min === null || def.max === null) return null
  return { def, min: def.min, max: def.max }
}

// ---------------------------------------------------------------- per UK day

export interface DayFigures {
  held: number
  mean: number | null
  peak: { t: number; v: number } | null
  /** MW × ½ h summed over the half-hours held, in MWh; null when none held or the rows are means. */
  energy: number | null
}

/**
 * Each UK day of the window for one series: the half-hours holding a value,
 * their mean, the peak and when, and the energy they sum to. A day with none
 * held has a null mean and no peak, never a zero.
 */
export function dayFigures(model: SeriesModel, window: DateRange, def: SeriesDef | undefined): Map<number, DayFigures> {
  const acc = new Map<number, { held: number; sum: number; peak: { t: number; v: number } | null }>()
  if (def) {
    for (const row of model.rows) {
      const v = row[def.field]
      if (typeof v !== 'number') continue
      const day = londonMidnight(row.t)
      const a = acc.get(day) ?? { held: 0, sum: 0, peak: null }
      a.held += 1
      a.sum += v
      if (!a.peak || v > a.peak.v) a.peak = { t: row.t, v }
      acc.set(day, a)
    }
  }
  // The model holds display units (GW); the energy is in MWh, so it undoes the display factor.
  const toMw = def ? 1 / def.unit.factor : 1
  const halfHourly = !model.bucketed && model.stepMs === 30 * MINUTE_MS
  return new Map<number, DayFigures>(
    datesBetween(window.start, window.end).map((iso): [number, DayFigures] => {
      const start = dayStart(iso)
      const a = acc.get(start)
      if (!a) return [start, { held: 0, mean: null, peak: null, energy: null }]
      return [start, { held: a.held, mean: a.sum / a.held, peak: a.peak, energy: halfHourly ? (a.sum * toMw) / 2 : null }]
    }),
  )
}
