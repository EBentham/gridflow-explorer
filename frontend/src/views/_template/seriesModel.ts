/**
 * A series response as the page draws it. The rows endpoint sends long
 * format, one row per (time, group value); a chart wants one row per time
 * with a field per series. This module pivots, names and colours the series,
 * converts values to their display unit, and reads the figures panels quote
 * (latest value, daily mean, highest and lowest). Nothing is filled in: a
 * null stays null (a gap), and a series with no row at a time has no field
 * there at all (it is on another clock).
 */
import { SERIES_COLORS } from '../../design/chartTheme'
import { datesBetween, dayStart, HOUR_MS, londonMidnight, stepsInDay } from '../../design/time'
import type { DateRange } from '../../lib/range'
import type { SeriesRowsResponse, ValueColumn } from '../contract'
import type { GroupSpec, ValueSpec } from '../define'
import { displayUnit, type DisplayUnit } from './units'

export interface SeriesDef {
  /** Stable id: the column (no group), the group value (one column), or `column:group`. */
  key: string
  /** The field holding its values in `WideRow`s: a plain name, safe for chart data keys. */
  field: string
  column: string
  /** The group value, `''` for rows whose group is null; null when the rows aren't grouped. */
  group: string | null
  label: string
  /** A CSS custom property. */
  color: string
  unit: DisplayUnit
  /** `self`, or the related dataset's key. */
  from: string
  /** Values held in the window, and their mean, lowest and highest, in display units. */
  count: number
  mean: number | null
  min: number | null
  max: number | null
  /** Some value is below zero: a stack draws it in its own negative stack. */
  signed: boolean
}

/** One time on the window's clock: a field per series (`SeriesDef.field`), null for a gap, absent off that series' clock. */
export interface WideRow {
  t: number
  [field: string]: number | null | undefined
}

export interface SeriesModel {
  from: string
  /** Every series in the response. */
  all: SeriesDef[]
  /** Those drawn: at most `maxSeries`, in stack order (bottom first). */
  drawn: SeriesDef[]
  /** Held in the window but past the draw cap, largest first: named in the key, never merged. */
  undrawn: SeriesDef[]
  /** In the response with no value in the window. */
  empty: SeriesDef[]
  rows: WideRow[]
  /** The step between rows: the downsample bucket when there is one, else the dataset's grain; null when irregular. */
  stepMs: number | null
  /** Rows are time-bucket means (the backend downsampled). */
  bucketed: boolean
  /** The column the series are split by; null when the rows aren't split, or a filter pins the split to one value. */
  group: string | null
  numericColumns: ValueColumn[]
  /** Categories, flags and text: shown in the table, never drawn. */
  textColumns: ValueColumn[]
}

export interface SeriesOptions {
  values?: ValueSpec[]
  groups?: GroupSpec[]
  maxSeries?: number
  /** `self` or a related key; also namespaces the fields so two models can share one chart. */
  from?: string
}

export const DEFAULT_MAX_SERIES = 10

/** A series' id across a page's datasets: `self/wind`, `price/price_gbp_mwh`. Focus and keys use it. */
export const seriesId = (d: Pick<SeriesDef, 'from' | 'key'>) => `${d.from}/${d.key}`

const collator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' })

const groupKey = (v: unknown) => (v === null || v === undefined ? '' : String(v))

/** Pivot a series response into drawable series. */
export function buildSeriesModel(response: SeriesRowsResponse, opts: SeriesOptions = {}): SeriesModel {
  const from = opts.from ?? 'self'
  const prefix = `${from.replace(/[^a-z0-9]/gi, '').toLowerCase() || 's'}_`
  const specs = new Map((opts.values ?? []).map((v) => [v.column, v]))
  const unitOf = (c: ValueColumn) => displayUnit(specs.get(c.column)?.unit ?? c.unit, specs.get(c.column)?.display)

  const numericColumns = response.columns.filter((c) => unitOf(c).numeric && response.rows.every((r) => r[c.column] === null || r[c.column] === undefined || typeof r[c.column] === 'number'))
  const textColumns = response.columns.filter((c) => !numericColumns.includes(c))
  const drawnColumns = opts.values
    ? opts.values.map((v) => numericColumns.find((c) => c.column === v.column)).filter((c): c is ValueColumn => c !== undefined)
    : numericColumns

  // A split that a filter pins to one value (live `mid`'s default, `data_provider_id` APXMIDP)
  // tells nothing apart: the columns are the series, named and coloured by `values`.
  const oneValue = response.group !== null && (response.filters ?? {})[response.group] !== undefined
  const group = oneValue ? null : response.group
  const present = group === null ? [] : [...new Set(response.rows.map((r) => groupKey(r[group])))]
  const pinned = (opts.groups ?? []).map((g) => g.value).filter((v) => present.includes(v))
  const groupOrder = [...pinned, ...present.filter((v) => !pinned.includes(v)).sort(collator.compare)]
  const multi = drawnColumns.length > 1

  const all: SeriesDef[] = []
  drawnColumns.forEach((col, ci) => {
    const spec = specs.get(col.column)
    const unit = unitOf(col)
    const valueLabel = spec?.label ?? col.column
    const base = { column: col.column, unit, from, count: 0, mean: null, min: null, max: null, signed: false }
    if (group === null) {
      all.push({ ...base, key: col.column, field: `${prefix}${all.length}`, group: null, label: valueLabel, color: spec?.color ?? SERIES_COLORS[ci % SERIES_COLORS.length] })
      return
    }
    groupOrder.forEach((g, gi) => {
      const gs = opts.groups?.find((x) => x.value === g)
      const groupLabel = gs?.label ?? (g === '' ? 'None' : g)
      const colorIndex = multi ? ci * groupOrder.length + gi : gi
      all.push({
        ...base,
        key: multi ? `${col.column}:${g}` : g,
        field: `${prefix}${all.length}`,
        group: g,
        label: multi ? `${groupLabel}, ${valueLabel}` : groupLabel,
        color: gs?.color ?? SERIES_COLORS[colorIndex % SERIES_COLORS.length],
      })
    })
  })

  const byT = new Map<number, WideRow>()
  const byGroup = new Map<string | null, SeriesDef[]>()
  for (const d of all) byGroup.set(d.group, [...(byGroup.get(d.group) ?? []), d])
  for (const r of response.rows) {
    const defs = byGroup.get(group === null ? null : groupKey(r[group]))
    if (!defs) continue
    let row = byT.get(r.ts)
    if (!row) {
      row = { t: r.ts }
      byT.set(r.ts, row)
    }
    for (const d of defs) {
      const v = r[d.column]
      row[d.field] = typeof v === 'number' && Number.isFinite(v) ? v * d.unit.factor : null
    }
  }
  const rows = [...byT.values()].sort((a, b) => a.t - b.t)

  for (const d of all) {
    let sum = 0
    for (const row of rows) {
      const v = row[d.field]
      if (typeof v !== 'number') continue
      d.count += 1
      sum += v
      d.min = d.min === null ? v : Math.min(d.min, v)
      d.max = d.max === null ? v : Math.max(d.max, v)
    }
    d.mean = d.count ? sum / d.count : null
    d.signed = (d.min ?? 0) < 0
  }

  const cap = opts.maxSeries ?? DEFAULT_MAX_SERIES
  const held = all.filter((d) => d.count > 0)
  const bySize = [...held].sort((a, b) => Math.abs(b.mean ?? 0) - Math.abs(a.mean ?? 0))
  const kept = new Set(bySize.slice(0, cap))
  const bucket = response.truncation?.bucket_ms ?? null

  return {
    from,
    all,
    drawn: held.filter((d) => kept.has(d)),
    undrawn: bySize.filter((d) => !kept.has(d)),
    empty: all.filter((d) => d.count === 0),
    rows,
    stepMs: bucket ?? response.grain_ms,
    bucketed: bucket !== null,
    group,
    numericColumns,
    textColumns,
  }
}

/** The last held value of a series, or null. */
export function latestValue(model: SeriesModel, def: SeriesDef): { t: number; v: number } | null {
  for (let i = model.rows.length - 1; i >= 0; i -= 1) {
    const v = model.rows[i][def.field]
    if (typeof v === 'number') return { t: model.rows[i].t, v }
  }
  return null
}

export interface Extremes {
  low: { t: number; v: number }
  high: { t: number; v: number }
}

/** The lowest and highest held values of a series over the rows given (the window by default). */
export function extremesOf(rows: WideRow[], def: SeriesDef): Extremes | null {
  let low: { t: number; v: number } | null = null
  let high: { t: number; v: number } | null = null
  for (const row of rows) {
    const v = row[def.field]
    if (typeof v !== 'number') continue
    if (!low || v < low.v) low = { t: row.t, v }
    if (!high || v > high.v) high = { t: row.t, v }
  }
  return low && high ? { low, high } : null
}

export interface DaySummary {
  /** `YYYY-MM-DD` on the UK clock. */
  day: string
  /** London midnight starting the day. */
  start: number
  /** Steps the day holds on a regular clock (48 half-hours; 46 or 50 on clock-change days); null otherwise. */
  expected: number | null
  /** Steps with a value. */
  held: number
  mean: number | null
  low: { t: number; v: number } | null
  high: { t: number; v: number } | null
}

/**
 * Every UK day in the window, held or not, with one series' figures (or, with
 * no series, whether any series holds a value at each step), so a missing day
 * is listed as missing rather than dropped.
 */
export function daySummaries(model: SeriesModel, window: DateRange, def?: SeriesDef): DaySummary[] {
  const byDay = new Map<number, WideRow[]>()
  for (const row of model.rows) {
    const d = londonMidnight(row.t)
    const list = byDay.get(d)
    if (list) list.push(row)
    else byDay.set(d, [row])
  }
  const defs = def ? [def] : model.all
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    const rows = byDay.get(start) ?? []
    let held = 0
    let sum = 0
    let low: DaySummary['low'] = null
    let high: DaySummary['high'] = null
    for (const row of rows) {
      const values = defs.map((d) => row[d.field]).filter((v): v is number => typeof v === 'number')
      if (!values.length) continue
      held += 1
      if (def) {
        const v = values[0]
        sum += v
        if (!low || v < low.v) low = { t: row.t, v }
        if (!high || v > high.v) high = { t: row.t, v }
      }
    }
    return {
      day,
      start,
      // Buckets are UTC-aligned: those of an hour or less fall on UK hours, longer ones straddle UK days.
      expected: model.bucketed && model.stepMs !== null && model.stepMs > HOUR_MS ? null : stepsInDay(start, model.stepMs),
      held,
      mean: def && held ? sum / held : null,
      low,
      high,
    }
  })
}
