/**
 * What the availability page's panels share: the columns, Elexon's fuel
 * codes folded onto the design's fuel bands, and the figures read from the
 * rows, keyed on the delivery date each row carries (`settlement_date`).
 *
 * Both datasets are forecasts: one figure of usable output per delivery day,
 * in MW, issued two to fourteen days ahead. By fuel (`fou2t14d`) is read
 * from the table that keeps the latest issue held per fuel and day; by unit
 * (`uou2t14d`) is cut by the backend to the newest issue held per unit and
 * day. Every row names its issue (`published_at`), so every figure here
 * carries it.
 *
 * Nothing is filled in. A fuel code or unit with no value on a day adds
 * nothing to its band that day, and a day with no row at all is a gap, never
 * a zero. The fuel codes fold onto bands as the physical notifications page
 * names them (`INT…` codes are interconnectors; OCGT, coal and oil are the
 * peaking band).
 */
import { FUEL_BANDS, fuelVar } from '../../../design/fuels'
import { DAY_MS, datesBetween, dayStart, londonMidnight, ukDate } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { RowsResponse, SeriesRow } from '../../contract'
import type { PageContext } from '../../define'
import type { ChartPanel } from '../../_template/SeriesChart'
import type { SeriesDef, WideRow } from '../../_template/seriesModel'
import { displayUnit } from '../../_template/units'

// ---------------------------------------------------------------- columns and keys

export const FOU = 'fou2t14d'
export const UOU = 'uou2t14d'
/** Forecast usable output, MW, one figure per fuel (or unit) per delivery day. */
export const VALUE = 'output_usable_mw'
export const FUEL = 'fuel_type'
export const UNIT = 'bm_unit_id'
export const NG_UNIT = 'national_grid_bm_unit'
/** When the forecast was issued (vendor time). */
export const ISSUED = 'published_at'
export const DATE = 'settlement_date'

/** The by-fuel forecast, read beside the by-unit one. */
export const FUEL_KEY = 'byfuel'
/** The page's own URL parameter: the one unit to read alone. */
export const UNIT_PARAM = 'unit'

/** Every chart on the page takes this value-axis width, so their clocks line up. */
export const AXIS_WIDTH = 52

export const GW = displayUnit('MW', 'GW')
export const MW = displayUnit('MW', 'MW')

/** The difference between the units' sum and the fuel figure: both forecasts, so the forecast colour. */
export const DIFF_COLOR = 'var(--chart-fan)'

const collator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' })

// ---------------------------------------------------------------- fuel codes and bands

export interface Band {
  key: string
  label: string
  /** In running text: `pumped storage`. */
  prose: string
  color: string
  /** Stack order, bottom first. */
  order: number
}

/** Elexon's fuel codes on the design's fuel bands, as the generation mix and the physical notifications page fold them. */
const BAND_OF: Record<string, string> = {
  NUCLEAR: 'nuclear',
  NPSHYD: 'hydro',
  BIOMASS: 'biomass',
  WIND: 'wind',
  CCGT: 'gas',
  OCGT: 'peaking',
  COAL: 'peaking',
  OIL: 'peaking',
  OTHER: 'other',
  PS: 'pumped_storage',
}

/** Each code's own name, where it says more than its band's. */
const CODE_NAMES: Record<string, string> = {
  CCGT: 'Gas (CCGT)',
  OCGT: 'Gas (OCGT)',
  COAL: 'Coal',
  OIL: 'Oil',
}

/** The chart's neutral ink, for a code the page doesn't know: no fuel colour is claimed for it. */
const NEUTRAL = 'var(--chart-tick)'

const BANDS: Band[] = FUEL_BANDS.map((b, i) => {
  // These figures are each link's usable output as listed, not net imports: the band is named for the links.
  const label = b.key === 'imports' ? 'Interconnectors' : b.label
  return { key: b.key, label, prose: label === 'Gas (CCGT)' ? 'gas (CCGT)' : label.toLowerCase(), color: fuelVar(b.key), order: i }
})

const bandByKey = new Map(BANDS.map((b) => [b.key, b]))

/** A fuel code's band; a code the page doesn't know is a band of its own, named by its code, in neutral ink. */
export function bandOf(code: string | null): Band {
  const key = code === null ? null : code.startsWith('INT') ? 'imports' : BAND_OF[code]
  const band = key ? bandByKey.get(key) : undefined
  if (band) return band
  const name = code ?? 'No fuel listed'
  return { key: `code:${name}`, label: name, prose: name, color: NEUTRAL, order: BANDS.length }
}

export const isInterconnector = (band: Band) => band.key === 'imports'

/** A code in words: `Gas (OCGT)`, `Interconnector`, or the band's name. */
export function codeName(code: string): string {
  if (code.startsWith('INT')) return 'Interconnector'
  return CODE_NAMES[code] ?? bandOf(code).label
}

const byBand = (a: Band, b: Band) => a.order - b.order || collator.compare(a.label, b.label)

// ---------------------------------------------------------------- rows

export interface Row {
  date: string
  code: string | null
  /** `bm_unit_id`; null where the row names none. */
  unit: string | null
  ng: string | null
  mw: number | null
  issued: number | null
}

const text = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

function parse(r: SeriesRow): Row {
  const v = r[VALUE]
  const issued = text(r[ISSUED])
  const t = issued === null ? NaN : Date.parse(issued)
  return {
    // The delivery date the row carries; rows for a missing day carry none, and their stamp (UTC midnight) is inside that UK day.
    date: text(r[DATE]) ?? ukDate(r.ts),
    code: text(r[FUEL]),
    unit: text(r[UNIT]),
    ng: text(r[NG_UNIT]),
    mw: typeof v === 'number' && Number.isFinite(v) ? v : null,
    issued: Number.isFinite(t) ? t : null,
  }
}

const parsed = new WeakMap<RowsResponse, Row[]>()

export function rowsOf(response: RowsResponse | null | undefined): Row[] {
  if (!response || response.kind !== 'series') return []
  let rows = parsed.get(response)
  if (!rows) {
    rows = response.rows.map(parse)
    parsed.set(response, rows)
  }
  return rows
}

/** Whole UK days from the day an issue was made to the day it forecasts: `2` for an issue of the 21st for the 23rd. */
export function daysAhead(date: string, issued: number): number {
  return Math.round((dayStart(date) - londonMidnight(issued)) / DAY_MS)
}

// ---------------------------------------------------------------- one delivery day

export interface BandSum {
  band: Band
  /** MW over the codes (or units) in the band holding a value that day. */
  mw: number
  /** How many codes (or units) that is. */
  n: number
}

export interface Day {
  date: string
  /** The UK midnight it starts at: the chart's point and the picked day. */
  start: number
  /** Rows holding a value. */
  held: number
  bands: Map<string, BandSum>
  /** Over every code or unit held; null when none is. */
  total: number | null
  /** The same, interconnectors left out. */
  domestic: number | null
  /** Issue times behind the day's figures, oldest first. */
  issued: number[]
  /** By code (by fuel) or by unit key (by unit): MW. */
  items: Map<string, number>
}

function emptyDay(date: string): Day {
  return { date, start: dayStart(date), held: 0, bands: new Map(), total: null, domestic: null, issued: [], items: new Map() }
}

/** A unit's key: its BM unit id, or, for a row naming none, its National Grid id marked as such. */
export const unitKey = (r: Pick<Row, 'unit' | 'ng'>) => r.unit ?? `ng:${r.ng ?? '?'}`

/**
 * Each UK day of the window, its figures summed by band. `by: 'code'` reads
 * the by-fuel forecast (one row per code), `'unit'` the by-unit one (one row
 * per unit, its band from the fuel it lists).
 */
export function daysOf(response: RowsResponse | null | undefined, window: DateRange | null, by: 'code' | 'unit'): Day[] {
  if (!window) return []
  const days = new Map(datesBetween(window.start, window.end).map((d) => [d, emptyDay(d)]))
  const issued = new Map<string, Set<number>>()
  for (const r of rowsOf(response)) {
    const day = days.get(r.date)
    if (!day || r.mw === null) continue
    const band = bandOf(r.code)
    const sum = day.bands.get(band.key) ?? { band, mw: 0, n: 0 }
    sum.mw += r.mw
    sum.n += 1
    day.bands.set(band.key, sum)
    day.held += 1
    day.total = (day.total ?? 0) + r.mw
    if (!isInterconnector(band)) day.domestic = (day.domestic ?? 0) + r.mw
    const item = by === 'code' ? (r.code ?? '?') : unitKey(r)
    day.items.set(item, (day.items.get(item) ?? 0) + r.mw)
    if (r.issued !== null) {
      const s = issued.get(r.date) ?? new Set()
      s.add(r.issued)
      issued.set(r.date, s)
    }
  }
  for (const [date, s] of issued) {
    const day = days.get(date)
    if (day) day.issued = [...s].sort((a, b) => a - b)
  }
  return [...days.values()]
}

/** The bands any day holds, bottom of the stack first. */
export function bandsIn(days: Day[]): Band[] {
  const seen = new Map<string, Band>()
  for (const d of days) for (const s of d.bands.values()) seen.set(s.band.key, s.band)
  return [...seen.values()].sort(byBand)
}

/** The day the key reads: the day picked on a chart or in a table, when it holds figures, else the latest that does. */
export function keyDay(ctx: Pick<PageContext, 'picked'>, days: Day[]): Day | null {
  const held = days.filter((d) => d.held > 0)
  return held.find((d) => d.start === ctx.picked) ?? held.at(-1) ?? null
}

/** The newest issue behind any figure in the window. */
export function newestIssue(days: Day[]): number | null {
  const all = days.flatMap((d) => d.issued)
  return all.length ? Math.max(...all) : null
}

/** The delivery days the newest issue forecasts, among those in the window. */
export function newestIssueDays(days: Day[]): Day[] {
  const newest = newestIssue(days)
  return newest === null ? [] : days.filter((d) => d.issued.includes(newest))
}

// ---------------------------------------------------------------- charts

const stat = (values: number[]) => ({
  count: values.length,
  mean: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
  min: values.length ? Math.min(...values) : null,
  max: values.length ? Math.max(...values) : null,
})

/** A band as a chart series, in GW. Availability never goes below zero, so no band is signed. */
function bandSeries(band: Band, i: number, rows: WideRow[]): SeriesDef {
  const field = `b${i}`
  const values = rows.map((r) => r[field]).filter((v): v is number => typeof v === 'number')
  return { key: band.key, field, column: VALUE, group: band.key, label: band.label, color: band.color, unit: GW, from: 'self', ...stat(values), signed: false }
}

/** The id the key's selection and `SeriesChart`'s focus share for a band. */
export const bandId = (band: Band) => `self/${band.key}`

/** The bands stacked per delivery day, in GW: one point per day at its UK midnight, a day holding nothing a gap in every band. */
export function stackPanel(days: Day[], bands: Band[], height: number): ChartPanel {
  const rows: WideRow[] = days.map((d) => {
    const row: WideRow = { t: d.start }
    bands.forEach((b, i) => {
      const s = d.bands.get(b.key)
      row[`b${i}`] = s ? s.mw * GW.factor : null
    })
    return row
  })
  return { rows, series: bands.map((b, i) => bandSeries(b, i, rows)), mark: 'stacked', unit: GW, stepMs: DAY_MS, height, zero: true, axisWidth: AXIS_WIDTH }
}

/** One line of MW values per delivery day: a unit, say. */
export function linePanel(points: { t: number; v: number | null }[], label: string, color: string, height: number, key = 'line'): ChartPanel {
  const rows: WideRow[] = points.map((p) => ({ t: p.t, [key]: p.v }))
  const values = points.map((p) => p.v).filter((v): v is number => v !== null)
  const def: SeriesDef = { key, field: key, column: VALUE, group: null, label, color, unit: MW, from: 'self', ...stat(values), signed: values.some((v) => v < 0) }
  const flat = def.min === def.max
  return { rows, series: [def], mark: 'line', unit: MW, stepMs: DAY_MS, height, zero: true, extremes: flat ? null : def, axisWidth: AXIS_WIDTH }
}

/** Bars of MW values per delivery day: the units' sum less the fuel figure. */
export function barsPanel(points: { t: number; v: number | null }[], label: string, height: number): ChartPanel {
  const key = 'diff'
  const rows: WideRow[] = points.map((p) => ({ t: p.t, [key]: p.v }))
  const values = points.map((p) => p.v).filter((v): v is number => v !== null)
  const def: SeriesDef = { key, field: key, column: VALUE, group: null, label, color: DIFF_COLOR, unit: MW, from: 'diff', ...stat(values), signed: values.some((v) => v < 0) }
  return { rows, series: [def], mark: 'bars', unit: MW, stepMs: DAY_MS, height, zero: true, axisWidth: AXIS_WIDTH }
}

// ---------------------------------------------------------------- units

export interface UnitInfo {
  key: string
  /** Null for the rows naming no BM unit id. */
  id: string | null
  ng: string | null
  /** The fuel code it lists; null when it lists none, or more than one in the window. */
  code: string | null
  codes: string[]
  band: Band
  /** Its figure per delivery date, MW, and the issue behind it. */
  byDate: Map<string, { mw: number; issued: number | null }>
  min: number | null
  max: number | null
}

const unitCache = new WeakMap<RowsResponse, Map<string, UnitInfo>>()

/** Every unit the rows list, with its figures by delivery date. */
export function unitsOf(response: RowsResponse | null | undefined): Map<string, UnitInfo> {
  if (!response || response.kind !== 'series') return new Map()
  const hit = unitCache.get(response)
  if (hit) return hit
  const out = new Map<string, UnitInfo>()
  for (const r of rowsOf(response)) {
    if (r.unit === null && r.ng === null) continue
    const key = unitKey(r)
    let u = out.get(key)
    if (!u) {
      u = { key, id: r.unit, ng: r.ng, code: null, codes: [], band: bandOf(null), byDate: new Map(), min: null, max: null }
      out.set(key, u)
    }
    if (r.code !== null && !u.codes.includes(r.code)) u.codes.push(r.code)
    if (u.ng === null && r.ng !== null) u.ng = r.ng
    if (r.mw === null) continue
    u.byDate.set(r.date, { mw: r.mw, issued: r.issued })
    u.min = u.min === null ? r.mw : Math.min(u.min, r.mw)
    u.max = u.max === null ? r.mw : Math.max(u.max, r.mw)
  }
  for (const u of out.values()) {
    u.code = u.codes.length === 1 ? u.codes[0] : null
    u.band = u.codes.length === 1 ? bandOf(u.codes[0]) : u.codes.length ? { ...bandOf(null), label: 'More than one fuel listed', prose: 'more than one fuel listed' } : bandOf(null)
  }
  unitCache.set(response, out)
  return out
}

/** Units in stack order, then by id. */
export function sortedUnits(units: Map<string, UnitInfo>): UnitInfo[] {
  return [...units.values()].sort((a, b) => byBand(a.band, b.band) || collator.compare(a.id ?? a.key, b.id ?? b.key))
}

/** What the rows endpoint takes as a filter value, and what an id in the address may be: letters, digits, spaces and `_ . - / :`. */
const UNIT_ID = /^[A-Za-z0-9 _.\-/:]{1,64}$/

export function validUnit(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  return UNIT_ID.test(v) ? v : null
}

/** The unit the address asks for, matched to a listed id without regard to case; null for all units. */
export function askedUnit(ctx: Pick<PageContext, 'param'>): string | null {
  return validUnit(ctx.param(UNIT_PARAM))
}

/** The unit read alone: the one asked for, when the rows list it. */
export function unitShown(ctx: PageContext): UnitInfo | null {
  const asked = askedUnit(ctx)
  if (!asked) return null
  const units = unitsOf(ctx.response)
  const u = units.get(asked) ?? [...units.values()].find((x) => x.id !== null && x.id.toLowerCase() === asked.toLowerCase())
  return u ?? null
}

/** A unit's name in words: its fuel code in words, or what it lacks. */
export function unitFuel(u: UnitInfo): string {
  if (u.code) return codeName(u.code)
  return u.codes.length > 1 ? 'More than one fuel listed' : 'No fuel listed'
}

// ---------------------------------------------------------------- the units against the fuel figure

export interface Compare {
  band: Band
  /** MW, or null where one side holds nothing for the band that day. */
  units: number | null
  unitCount: number
  fuel: number | null
  diff: number | null
}

/** One day's bands, the units' sum set against Elexon's fuel figure; the difference only where both hold one. */
export function compareDay(unitDay: Day | undefined, fuelDay: Day | undefined): Compare[] {
  const bands = bandsIn([unitDay, fuelDay].filter((d): d is Day => d !== undefined))
  return bands.map((band) => {
    const u = unitDay?.bands.get(band.key)
    const f = fuelDay?.bands.get(band.key)
    return { band, units: u ? u.mw : null, unitCount: u?.n ?? 0, fuel: f ? f.mw : null, diff: u && f ? u.mw - f.mw : null }
  })
}

/** The units' total less the fuel total per day, MW; null where either holds nothing that day. */
export function totalDiffs(unitDays: Day[], fuelDays: Day[]): { t: number; v: number | null }[] {
  const fuel = new Map(fuelDays.map((d) => [d.date, d]))
  return unitDays.map((d) => {
    const f = fuel.get(d.date)
    return { t: d.start, v: d.total !== null && f && f.total !== null ? d.total - f.total : null }
  })
}

// ---------------------------------------------------------------- words

/** `+431` or `−1,070`: a signed difference in MW with a true minus. */
export const signedPlain = (v: number) => `${Math.round(v) > 0 ? '+' : ''}${MW.plain(v)}`
export const signedMw = (v: number) => `${signedPlain(v)} ${MW.label}`

/** `Tue 22 Sep, 01:00 BST` and `Mon 21 Sep, 21:00 BST to Tue 22 Sep, 01:00 BST`. */
export function issuedRange(issued: number[], label: (t: number) => string): string {
  if (!issued.length) return '–'
  const lo = issued[0]
  const hi = issued[issued.length - 1]
  return lo === hi ? label(lo) : `${label(lo)} to ${label(hi)}`
}
