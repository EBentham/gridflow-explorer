/**
 * What the wind-site panels share: the column ids, the 12 sites with their
 * names and regions (as gridflow's Open-Meteo connector lists them), one
 * colour per region, the keys of the related datasets, and the figures read
 * from the rows. Nothing is filled in: an hour missing any site has no mean
 * of the sites, and an hour missing any of its half-hours of output has no
 * output figure, never a zero.
 */
import { datesBetween, dayStart, londonMidnight, stepsInDay } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { GroupSpec } from '../../define'
import { seriesId, type SeriesDef, type SeriesModel, type WideRow } from '../../_template/seriesModel'

export const SPEED = 'wind_speed_100m_mps'
export const OUTPUT = 'generation_mw'

/** The key of the related GB wind output (Elexon's generation by fuel type, wind only). */
export const OUTPUT_KEY = 'output'
/** The key of the related reanalysis, read beside the forecast model's hindcast. */
export const REANALYSIS_KEY = 'reanalysis'

export const OUTPUT_COLOR = 'var(--fuel-wind)'

export interface Region {
  key: string
  label: string
  color: string
}

/** The regions gridflow's connector groups the sites into. A site's colour is its region's. */
export const REGIONS: Region[] = [
  { key: 'north_sea', label: 'Offshore, southern North Sea', color: 'var(--chart-price)' },
  { key: 'irish_sea', label: 'Offshore, Irish Sea', color: 'var(--chart-price-2)' },
  { key: 'moray_forth', label: 'Offshore, Moray Firth and Firth of Forth', color: 'var(--fuel-pumped_storage)' },
  { key: 'scotland', label: 'Onshore, Scotland', color: 'var(--fuel-imports)' },
  { key: 'wales', label: 'Onshore, Wales', color: 'var(--fuel-peaking)' },
]

export interface Site {
  value: string
  label: string
  region: string
}

export const SITES: Site[] = [
  { value: 'dogger_bank', label: 'Dogger Bank', region: 'north_sea' },
  { value: 'hornsea', label: 'Hornsea', region: 'north_sea' },
  { value: 'east_anglia', label: 'East Anglia', region: 'north_sea' },
  { value: 'triton_knoll', label: 'Triton Knoll', region: 'north_sea' },
  { value: 'walney', label: 'Walney', region: 'irish_sea' },
  { value: 'gwynt_y_mor', label: 'Gwynt y Môr', region: 'irish_sea' },
  { value: 'beatrice', label: 'Beatrice', region: 'moray_forth' },
  { value: 'seagreen', label: 'Seagreen', region: 'moray_forth' },
  { value: 'highland_central', label: 'Central Highlands', region: 'scotland' },
  { value: 'borders_crystalrig', label: 'Crystal Rig, Borders', region: 'scotland' },
  { value: 'whitelee', label: 'Whitelee', region: 'scotland' },
  { value: 'pen_y_cymoedd', label: 'Pen y Cymoedd', region: 'wales' },
]

const regionOf = (key: string) => REGIONS.find((r) => r.key === key)

/** The sites as the template's `groups`: in region order, each in its region's colour. */
export const SITE_GROUPS: GroupSpec[] = SITES.map((s) => ({ value: s.value, label: s.label, color: regionOf(s.region)?.color }))

/** A site's region, when the site is one gridflow lists. */
export const siteRegion = (value: string | null): Region | undefined => regionOf(SITES.find((s) => s.value === value)?.region ?? '')

/** The 100 m speed series of each site that holds a value in the window. */
export function heldSites(model: SeriesModel | null | undefined): SeriesDef[] {
  return model ? model.all.filter((d) => d.column === SPEED && d.count > 0) : []
}

/** The site the key has picked, when it is one of the page's own series. */
export function focusedSite(ctx: { focus: string | undefined }, model: SeriesModel | null | undefined): SeriesDef | undefined {
  return heldSites(model).find((d) => seriesId(d) === ctx.focus)
}

export interface Point {
  t: number
  v: number
}

/**
 * The hourly speed the panels read: the picked site's, or the plain mean of
 * the sites held in the window, only at times where every one of them holds
 * a value. Each site counts the same.
 */
export function speedPoints(model: SeriesModel, site?: SeriesDef): Point[] {
  const defs = site ? [site] : heldSites(model)
  if (!defs.length) return []
  const out: Point[] = []
  for (const r of model.rows) {
    let sum = 0
    let n = 0
    for (const d of defs) {
      const v = r[d.field]
      if (typeof v !== 'number') break
      sum += v
      n += 1
    }
    if (n === defs.length) out.push({ t: r.t, v: sum / n })
  }
  return out
}

/** Every time on the model's clock with the speed as a field (`speed`), null where it has none. */
export function speedRows(model: SeriesModel, points: Point[], field: string): WideRow[] {
  const at = new Map(points.map((p) => [p.t, p.v]))
  return model.rows.map((r) => ({ t: r.t, [field]: at.get(r.t) ?? null }))
}

export interface Stats {
  count: number
  mean: number | null
  low: Point | null
  high: Point | null
}

export function statsOf(points: Point[]): Stats {
  let low: Point | null = null
  let high: Point | null = null
  let sum = 0
  for (const p of points) {
    sum += p.v
    if (!low || p.v < low.v) low = p
    if (!high || p.v > high.v) high = p
  }
  return { count: points.length, mean: points.length ? sum / points.length : null, low, high }
}

/**
 * GB wind output for each step of the weather clock: the mean of the output
 * readings inside [t, t + step), only when every one of them is held. Null
 * when the output's own step doesn't divide the weather's.
 */
export function outputPerStep(output: SeriesModel, def: SeriesDef, weatherStep: number | null): Map<number, number> | null {
  const outStep = output.stepMs
  if (weatherStep === null || outStep === null || outStep > weatherStep || weatherStep % outStep !== 0) return null
  const per = weatherStep / outStep
  const sums = new Map<number, { sum: number; n: number }>()
  for (const r of output.rows) {
    const v = r[def.field]
    if (typeof v !== 'number') continue
    const start = r.t - (((r.t % weatherStep) + weatherStep) % weatherStep)
    const s = sums.get(start) ?? { sum: 0, n: 0 }
    s.sum += v
    s.n += 1
    sums.set(start, s)
  }
  const out = new Map<number, number>()
  for (const [t, s] of sums) if (s.n === per) out.set(t, s.sum / per)
  return out
}

export interface DayRow {
  day: string
  start: number
  /** Steps of the weather clock the day holds; null when the step doesn't divide a day. */
  expected: number | null
  speed: Stats
}

/** Every UK day of the window, held or not, with the speed's figures over its held steps. */
export function speedByDay(model: SeriesModel, window: DateRange, points: Point[]): DayRow[] {
  const byDay = new Map<number, Point[]>()
  for (const p of points) {
    const d = londonMidnight(p.t)
    const list = byDay.get(d)
    if (list) list.push(p)
    else byDay.set(d, [p])
  }
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    return { day, start, expected: model.bucketed ? null : stepsInDay(start, model.stepMs), speed: statsOf(byDay.get(start) ?? []) }
  })
}

/** Each UK day's mean of the values held, and how many were held. */
export function meanByDay(model: SeriesModel, def: SeriesDef): Map<number, { mean: number; held: number }> {
  const acc = new Map<number, { sum: number; held: number }>()
  for (const r of model.rows) {
    const v = r[def.field]
    if (typeof v !== 'number') continue
    const d = londonMidnight(r.t)
    const s = acc.get(d) ?? { sum: 0, held: 0 }
    s.sum += v
    s.held += 1
    acc.set(d, s)
  }
  return new Map([...acc].map(([d, s]) => [d, { mean: s.sum / s.held, held: s.held }]))
}

/** A series made on the page (a mean of the sites), in a site's unit, for `SeriesChart`. */
export function madeSeries(base: SeriesDef, key: string, label: string, color: string, points: Point[]): SeriesDef {
  const s = statsOf(points)
  return {
    ...base,
    key,
    field: key,
    group: null,
    label,
    color,
    from: key,
    count: s.count,
    mean: s.mean,
    min: s.low?.v ?? null,
    max: s.high?.v ?? null,
    signed: (s.low?.v ?? 0) < 0,
  }
}
