/**
 * What the solar-site panels share: the column ids, the six sites with a
 * colour each (a colour follows its site on both datasets and on the archive
 * read beside the model re-run), and the figures read from the rows.
 *
 * Daily totals are sums of what is held and nothing else: each hour's mean
 * W/m² counted for one hour gives Wh/m². A day short of any hour gets no
 * total, and a window read as bucket means gets none at all.
 */
import { SERIES_COLORS } from '../../../design/chartTheme'
import { datesBetween, dayStart, HALF_HOUR, HOUR_MS, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { GroupSpec } from '../../define'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'

export const GTI = 'global_tilted_irradiance_wm2'
export const GHI = 'shortwave_radiation_wm2'
export const DIRECT = 'direct_radiation_wm2'
export const DNI = 'direct_normal_irradiance_wm2'
export const DIFFUSE = 'diffuse_radiation_wm2'
/** GB solar generation in NESO's historic generation mix. */
export const SOLAR_MW = 'solar'

/** The related GB solar generation read beside the archive. */
export const OUTPUT_KEY = 'output'
/** The related archive read beside the model re-run. */
export const ARCHIVE_KEY = 'archive'

/** Both charts' value axes take this width, so their clocks line up. */
export const AXIS_WIDTH = 52

/** The six sites, in gridflow's own order, each with its own colour. */
const SITE_LIST: [string, string][] = [
  ['east_anglia_norfolk', 'East Anglia (Norfolk)'],
  ['wiltshire_somerset', 'Wiltshire and Somerset'],
  ['kent', 'Kent'],
  ['cornwall', 'Cornwall'],
  ['sussex', 'Sussex'],
  ['oxfordshire', 'Oxfordshire'],
]

export const SITES: GroupSpec[] = SITE_LIST.map(([value, label], i) => ({ value, label, color: SERIES_COLORS[i] }))

/** The archive's sites beside the re-run: the same colours, named as the archive. */
export const ARCHIVE_SITES: GroupSpec[] = SITES.map((s) => ({ ...s, label: `${s.label}, archive` }))

export const siteLabel = (value: string | null): string => SITES.find((s) => s.value === value)?.label ?? value ?? 'None'

/** A column's series in a model, when the rows hold it; for one site when named. */
export const seriesOf = (model: SeriesModel | null | undefined, column: string, site?: string | null): SeriesDef | undefined =>
  model?.all.find((d) => d.column === column && (site === undefined || d.group === site))

/** Every series of one column, one per site, in the sites' order. */
export const sitesOf = (model: SeriesModel | null | undefined, column: string): SeriesDef[] => model?.all.filter((d) => d.column === column) ?? []

/** A model holds hourly rows as read, not bucket means: only then do its hours sum to a day's irradiation. */
export const hourly = (model: SeriesModel | null | undefined): boolean => Boolean(model && !model.bucketed && model.stepMs === HOUR_MS)

/** A model holds half-hourly rows as read, not bucket means. */
export const halfHourly = (model: SeriesModel | null | undefined): boolean => Boolean(model && !model.bucketed && model.stepMs === HALF_HOUR)

export interface DayTotal {
  /** London midnight starting the UK day. */
  start: number
  /** Steps with a value, and the steps the day has on this clock. */
  held: number
  expected: number | null
  /** The held values summed; null when nothing is held. */
  sum: number | null
  /** The highest held value, and when. */
  peak: { t: number; v: number } | null
}

/** Per UK day of the window: one series' held values summed, counted, and its peak. Every day is listed, held or not. */
export function totalsByDay(model: SeriesModel, window: DateRange, def: SeriesDef): Map<number, DayTotal> {
  const acc = new Map<number, { sum: number; held: number; peak: { t: number; v: number } }>()
  for (const row of model.rows) {
    const v = row[def.field]
    if (typeof v !== 'number') continue
    const day = londonMidnight(row.t)
    const a = acc.get(day)
    if (!a) acc.set(day, { sum: v, held: 1, peak: { t: row.t, v } })
    else {
      a.sum += v
      a.held += 1
      if (v > a.peak.v) a.peak = { t: row.t, v }
    }
  }
  return new Map(
    datesBetween(window.start, window.end).map((iso) => {
      const start = dayStart(iso)
      const a = acc.get(start)
      return [start, { start, held: a?.held ?? 0, expected: stepsInDay(start, model.stepMs), sum: a ? a.sum : null, peak: a?.peak ?? null }]
    }),
  )
}

/** A day's total when every step of it is held, else null: a day held in part is never totalled. */
export const completeSum = (d: DayTotal | undefined): number | null => (d && d.sum !== null && d.expected !== null && d.held === d.expected ? d.sum : null)

/** Hourly W/m² summed over a day is Wh/m²; printed as kWh/m² to two places. */
export const kwhM2 = (whM2: number): string => (whM2 / 1000).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** A difference in kWh/m² with a true minus sign and no negative zero. */
export function kwhDiff(whM2: number): string {
  const r = Math.round(whM2 / 10) / 100
  if (r === 0) return '0.00'
  return `${r < 0 ? '−' : '+'}${Math.abs(r).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Unique values of a text column in the rows, e.g. when a dataset's rows were fetched. */
export function isoValues(rows: readonly Record<string, unknown>[], column: string): string[] {
  const out = new Set<string>()
  for (const r of rows) {
    const v = r[column]
    if (typeof v === 'string' && v) out.add(v)
  }
  return [...out].sort()
}
