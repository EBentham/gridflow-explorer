/**
 * What the demand-centre weather panels share: the column ids, the seven
 * cities with one colour each (a colour follows its city on every panel and
 * both datasets), the value-axis width that lines the working panel's chart
 * up under the main one, and the figures read from the rows. Nothing is
 * filled in: an hour a city lacks is left out of every mean, extreme and
 * count, never read as zero.
 */
import { SERIES_COLORS } from '../../../design/chartTheme'
import { datesBetween, dayStart, HOUR_MS, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { GroupSpec } from '../../define'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'

export const TEMP = 'temperature_2m_c'
export const HDD = 'hdd_k'
export const CDD = 'cdd_k'
export const WIND = 'wind_speed_10m_mps'
export const SUN = 'shortwave_radiation_wm2'
export const HUMIDITY = 'relative_humidity_2m_pct'
export const RAIN = 'precipitation_mm'
export const PRESSURE = 'surface_pressure_hpa'
export const SNOWFALL = 'snowfall_cm'
export const SNOW_DEPTH = 'snow_depth_m'
export const AIR_DENSITY = 'air_density_kg_m3'

/** National demand, read beside the reanalysis: Elexon's `indo`. */
export const DEMAND = 'initial_demand_outturn_mw'
export const DEMAND_KEY = 'demand'
/** The reanalysis temperature, read beside the hindcast. */
export const ARCHIVE_KEY = 'archive'

export const DEMAND_COLOR = 'var(--chart-actual)'

/** Both charts' value axes take this width, so their clocks line up. */
export const AXIS_WIDTH = 52

const CITY_NAMES: [string, string][] = [
  ['belfast', 'Belfast'],
  ['birmingham', 'Birmingham'],
  ['cardiff', 'Cardiff'],
  ['glasgow', 'Glasgow'],
  ['leeds', 'Leeds'],
  ['london', 'London'],
  ['manchester', 'Manchester'],
]

/** The seven sites, each pinned to its own colour. */
export const CITIES: GroupSpec[] = CITY_NAMES.map(([value, label], i) => ({ value, label, color: SERIES_COLORS[i] }))

/** `1,176 city-hours`, or `588 city values (2-hour means)` when the rows are bucket means. */
export function cityStepsText(n: number, model: Pick<SeriesModel, 'bucketed' | 'stepMs'>): string {
  const count = n.toLocaleString('en-GB')
  if (model.bucketed && model.stepMs) return `${count} city values (${meansText(model.stepMs)})`
  if (model.stepMs === HOUR_MS) return `${count} city-hours`
  return `${count} city values`
}

/** A column's series in a model, when the rows hold it (the first, for a split column). */
export const seriesOf = (model: SeriesModel | null | undefined, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

/** Every city's series of one column. */
export const citySeries = (model: SeriesModel | null | undefined, column: string): SeriesDef[] => model?.all.filter((d) => d.column === column) ?? []

/** The city's name, from its series. */
export const cityName = (d: SeriesDef) => CITIES.find((c) => c.value === d.group)?.label ?? d.group ?? d.label

export interface CityPoint {
  t: number
  v: number
  city: string
}

export interface Spread {
  /** City-hours (or city-means) held. */
  held: number
  mean: number | null
  low: CityPoint | null
  high: CityPoint | null
}

/** Mean, lowest and highest over every held (time, city) value of these series, in the rows given. */
export function spreadOf(rows: SeriesModel['rows'], defs: SeriesDef[]): Spread {
  let held = 0
  let sum = 0
  let low: CityPoint | null = null
  let high: CityPoint | null = null
  for (const row of rows) {
    for (const d of defs) {
      const v = row[d.field]
      if (typeof v !== 'number') continue
      held += 1
      sum += v
      if (!low || v < low.v) low = { t: row.t, v, city: cityName(d) }
      if (!high || v > high.v) high = { t: row.t, v, city: cityName(d) }
    }
  }
  return { held, mean: held ? sum / held : null, low, high }
}

export interface WeatherDay {
  day: string
  start: number
  /** City-steps the day would hold on the rows' clock (24 hours × 7 cities); null when the steps straddle days. */
  expected: number | null
  temp: Spread
  /** Mean heating and cooling degrees over the city-steps held; null when none. */
  hdd: number | null
  cdd: number | null
  /** National demand's mean and peak over the half-hours held, when it is read. */
  demand: { held: number; mean: number | null; peak: number | null } | null
}

const meanOf = (rows: SeriesModel['rows'], defs: SeriesDef[]) => spreadOf(rows, defs).mean

/** Every UK day of the window, held or not, with the cities' figures and national demand beside them. */
export function weatherDays(model: SeriesModel, window: DateRange, demand: { model: SeriesModel; def: SeriesDef } | null): WeatherDay[] {
  const temps = citySeries(model, TEMP)
  const hdds = citySeries(model, HDD)
  const cdds = citySeries(model, CDD)
  const group = (rows: SeriesModel['rows']) => {
    const by = new Map<number, SeriesModel['rows']>()
    for (const r of rows) {
      const d = londonMidnight(r.t)
      const list = by.get(d)
      if (list) list.push(r)
      else by.set(d, [r])
    }
    return by
  }
  const own = group(model.rows)
  const dem = demand ? group(demand.model.rows) : null
  // Means of buckets longer than an hour straddle UK days: no expected count.
  const clockOk = !model.bucketed || (model.stepMs !== null && model.stepMs <= HOUR_MS)
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    const rows = own.get(start) ?? []
    const steps = clockOk ? stepsInDay(start, model.stepMs) : null
    let dFig: WeatherDay['demand'] = null
    if (demand && dem) {
      const vals = (dem.get(start) ?? []).map((r) => r[demand.def.field]).filter((v): v is number => typeof v === 'number')
      dFig = { held: vals.length, mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, peak: vals.length ? Math.max(...vals) : null }
    }
    return {
      day,
      start,
      expected: steps === null ? null : steps * temps.length,
      temp: spreadOf(rows, temps),
      hdd: meanOf(rows, hdds),
      cdd: meanOf(rows, cdds),
      demand: dFig,
    }
  })
}

export interface CityGap {
  def: SeriesDef
  /** Steps both the hindcast and the reanalysis hold. */
  both: number
  hindcast: number | null
  archive: number | null
  /** Mean of hindcast less reanalysis at those steps. */
  diff: number | null
  /** The largest difference either way, and when. */
  widest: { t: number; v: number } | null
}

/**
 * Per city: the hindcast and the reanalysis at the steps both hold, their
 * means and the mean and widest difference. Only on one clock: the caller
 * checks both models share their step.
 */
export function cityGaps(hind: SeriesModel, archive: SeriesModel): CityGap[] {
  const at = new Map(archive.rows.map((r) => [r.t, r]))
  const archiveDefs = citySeries(archive, TEMP)
  return citySeries(hind, TEMP).map((def) => {
    const a = archiveDefs.find((d) => d.group === def.group)
    let both = 0
    let sh = 0
    let sa = 0
    let widest: CityGap['widest'] = null
    if (a) {
      for (const r of hind.rows) {
        const h = r[def.field]
        const v = at.get(r.t)?.[a.field]
        if (typeof h !== 'number' || typeof v !== 'number') continue
        both += 1
        sh += h
        sa += v
        const d = h - v
        if (!widest || Math.abs(d) > Math.abs(widest.v)) widest = { t: r.t, v: d }
      }
    }
    return {
      def,
      both,
      hindcast: both ? sh / both : null,
      archive: both ? sa / both : null,
      diff: both ? (sh - sa) / both : null,
      widest,
    }
  })
}
