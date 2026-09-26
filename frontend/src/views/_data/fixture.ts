/**
 * The dev fixture adapter: a `DataSource` that answers from the synthetic
 * "Template demo" source (`fixtureData.ts`) with exactly the shapes of
 * `/api/sources` and the rows endpoint, including the backend's rules:
 * null rows for missing half-hours (never zeros), the default filter and
 * what it left out, and time-bucket means past the row cap, all reported in
 * `truncation`. Its `origin` is `fixture`, so every panel reading it carries
 * the dashed-ochre Fixture tag.
 *
 * For screenshots of the states a page must handle, `?fixture=` on the page
 * URL makes the rows request fail as the backend would: `error` (a 500),
 * `refreshing` (gridflow holds the store), `toomany` (a 413 with a hint), or
 * `empty` (a window with no rows).
 */
import { ApiError } from '../../api/client'
import { DAY_MS, HALF_HOUR, dayStart, nextLondonMidnight, shiftDate, todayUk } from '../../design/time'
import type {
  DataSource,
  EventsRowsResponse,
  Manifest,
  ReferenceRowsResponse,
  RowsRequest,
  RowsResponse,
  SeriesRow,
  SeriesRowsResponse,
  Truncation,
} from '../contract'
import { FIXTURE_READ_AT, NOTICES, PLANT_TYPES, UNITS, fixtureSource, isHeld, outputMw, priceGbpMwh } from './fixtureData'

/** Deliberately small, so a 30-day window of three half-hourly series comes back as hourly means. */
const FIXTURE_ROW_CAP = 3000
const BUCKETS_MS = [3600e3, 2 * 3600e3, 4 * 3600e3, 6 * 3600e3, 12 * 3600e3, DAY_MS]
const LATENCY_MS = 90
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function scenario(): string | null {
  return typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('fixture')
}

function later<T>(make: () => T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      try {
        resolve(make())
      } catch (err) {
        reject(err)
      }
    }, LATENCY_MS)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

function manifest(): Manifest {
  return { generated_at: FIXTURE_READ_AT, today_uk: todayUk(), sources: [fixtureSource()] }
}

function dataset(id: string) {
  return fixtureSource().families[0].datasets.find((d) => d.id === id)
}

function resolveWindow(req: RowsRequest, latest: string) {
  const end = req.end ?? latest
  const start = req.start ?? shiftDate(end, -6)
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end) || start > end) {
    throw new ApiError('bad_range', `The window ${start} to ${end} isn't a pair of dates in order.`, { status: 422 })
  }
  return { start, end, tz: 'Europe/London' as const }
}

const daysIn = (start: string, end: string) => Math.round((dayStart(end) - dayStart(start)) / DAY_MS) + 1

/** Mean of each value per group per UTC-aligned bucket; a bucket with no value stays null. */
function downsample(rows: SeriesRow[], group: string | null, column: string, bucketMs: number, floor: number): SeriesRow[] {
  const buckets = new Map<string, { ts: number; g: string | null; sum: number; n: number }>()
  for (const r of rows) {
    const ts = Math.max(Math.floor(r.ts / bucketMs) * bucketMs, floor)
    const g = group === null ? null : String(r[group])
    const k = `${g}|${ts}`
    const b = buckets.get(k) ?? { ts, g, sum: 0, n: 0 }
    const v = r[column]
    if (typeof v === 'number') {
      b.sum += v
      b.n += 1
    }
    buckets.set(k, b)
  }
  return [...buckets.values()]
    .sort((a, b) => a.ts - b.ts || String(a.g).localeCompare(String(b.g)))
    .map((b) => ({ ts: b.ts, ...(group === null ? {} : { [group]: b.g }), [column]: b.n ? Math.round((b.sum / b.n) * 100) / 100 : null }))
}

function seriesRows(id: 'demo_output' | 'demo_price', window: { start: string; end: string }): { rows: SeriesRow[]; group: string | null; column: string } {
  const lo = dayStart(window.start)
  const hi = nextLondonMidnight(dayStart(window.end))
  const grid: number[] = []
  for (let t = lo; t < hi; t += HALF_HOUR) grid.push(t)
  // Groups with no held row in the window are left out; the rest carry every step, null where not held.
  if (!grid.some((t) => isHeld(id, t))) return { rows: [], group: id === 'demo_output' ? 'plant_type' : null, column: id === 'demo_output' ? 'output_mw' : 'price_gbp_mwh' }
  if (id === 'demo_price') {
    return { rows: grid.map((t) => ({ ts: t, price_gbp_mwh: isHeld(id, t) ? priceGbpMwh(t) : null })), group: null, column: 'price_gbp_mwh' }
  }
  const rows: SeriesRow[] = []
  for (const t of grid) for (const p of PLANT_TYPES) rows.push({ ts: t, plant_type: p, output_mw: isHeld(id, t) ? outputMw(p, t) : null })
  return { rows, group: 'plant_type', column: 'output_mw' }
}

function seriesResponse(id: 'demo_output' | 'demo_price', req: RowsRequest): SeriesRowsResponse {
  const ds = dataset(id)
  if (!ds?.coverage) throw new ApiError('unknown_dataset', `No dataset ${id}.`, { status: 404 })
  const window = resolveWindow(req, ds.coverage.latest_local_day ?? '')
  if (req.group && !ds.dims.some((d) => d.column === req.group)) {
    throw new ApiError('bad_group', `${req.group} isn't a column this dataset can be split by.`, { status: 422 })
  }
  const native = scenario() === 'empty' ? { rows: [], group: null, column: '' } : seriesRows(id, window)
  let rows = native.rows
  let truncation: Truncation | null = null
  if (rows.length > FIXTURE_ROW_CAP) {
    for (const bucket of BUCKETS_MS) {
      rows = downsample(native.rows, native.group, native.column, bucket, dayStart(window.start))
      if (rows.length <= FIXTURE_ROW_CAP) {
        truncation = {
          row_cap: FIXTURE_ROW_CAP,
          reasons: [{ type: 'downsample', bucket_ms: bucket, aggregation: 'mean' }],
          rows_before_defaults: native.rows.length,
          rows_after_filters: native.rows.length,
          returned_rows: rows.length,
          bucket_ms: bucket,
          aggregation: 'mean',
        }
        break
      }
    }
  }
  return {
    dataset: id,
    source: 'demo',
    kind: 'series',
    relation: ds.relation ?? '',
    window,
    grain_ms: HALF_HOUR,
    columns: ds.values,
    group: rows.length ? native.group : ds.dims[0]?.column ?? null,
    filters: {},
    rows,
    row_count: rows.length,
    truncated: truncation !== null,
    truncation,
    coverage: { first_day: ds.coverage.first_day, last_day: ds.coverage.last_day, latest_local_day: ds.coverage.latest_local_day, days_in_window: daysIn(window.start, window.end) },
    notes: [],
  }
}

function eventsResponse(req: RowsRequest): EventsRowsResponse {
  const ds = dataset('demo_notices')
  if (!ds?.coverage) throw new ApiError('unknown_dataset', 'No dataset demo_notices.', { status: 404 })
  const window = resolveWindow(req, ds.coverage.latest_local_day ?? '')
  const lo = dayStart(window.start)
  const hi = nextLondonMidnight(dayStart(window.end))
  const inWindow = scenario() === 'empty' ? [] : NOTICES.filter((n) => n.ts >= lo && n.ts < hi)
  // Omitted: the default filter (GB only). Null: cleared. Otherwise the caller's equality filters.
  const filters: Record<string, string> = req.filters === undefined ? { area: 'GB' } : (req.filters ?? {})
  const rows = inWindow.filter((n) => Object.entries(filters).every(([k, v]) => String(n[k]) === v))
  const omitted = inWindow.length - rows.length
  const byDefault = req.filters === undefined && omitted > 0
  return {
    dataset: 'demo_notices',
    source: 'demo',
    kind: 'events',
    relation: ds.relation ?? '',
    window,
    grain_ms: null,
    columns: ds.values,
    group: null,
    filters,
    rows,
    row_count: rows.length,
    truncated: byDefault,
    truncation: byDefault
      ? {
          row_cap: FIXTURE_ROW_CAP,
          reasons: [{ type: 'default_filter', column: 'area', equals: 'GB', omitted_rows: omitted }],
          rows_before_defaults: inWindow.length,
          rows_after_filters: rows.length,
          returned_rows: rows.length,
          bucket_ms: null,
          aggregation: null,
        }
      : null,
    coverage: { first_day: ds.coverage.first_day, last_day: ds.coverage.last_day, latest_local_day: ds.coverage.latest_local_day, days_in_window: daysIn(window.start, window.end) },
    notes: [],
  }
}

function referenceResponse(req: RowsRequest): ReferenceRowsResponse {
  const ds = dataset('demo_units')
  if (!ds) throw new ApiError('unknown_dataset', 'No dataset demo_units.', { status: 404 })
  if (req.start || req.end) throw new ApiError('bad_range', 'A reference table has no window.', { status: 422 })
  const filters = req.filters ?? {}
  const rows = scenario() === 'empty' ? [] : UNITS.filter((u) => Object.entries(filters).every(([k, v]) => String(u[k]) === v))
  return {
    dataset: 'demo_units',
    source: 'demo',
    kind: 'reference',
    relation: ds.relation ?? '',
    window: null,
    grain_ms: null,
    columns: ds.values,
    group: null,
    filters,
    rows,
    row_count: rows.length,
    truncated: false,
    truncation: null,
    coverage: { first_day: null, last_day: null, latest_local_day: null, days_in_window: null },
    notes: [],
  }
}

function rows(req: RowsRequest): RowsResponse {
  const s = scenario()
  if (s === 'error') throw new ApiError('fixture_error', 'the fixture was asked to fail (?fixture=error).', { status: 500 })
  if (s === 'refreshing') throw new ApiError('refresh_in_progress', 'A dataset refresh is in progress. Try again shortly.', { status: 503 })
  if (s === 'toomany') {
    throw new ApiError('too_many_rows', 'This window holds more rows than one read returns.', { status: 413, hint: 'Choose a shorter window, or filter to fewer groups.' })
  }
  if (req.source !== 'demo') throw new ApiError('unknown_dataset', `The fixture has no source ${req.source}.`, { status: 404 })
  const ds = dataset(req.dataset)
  if (!ds) throw new ApiError('unknown_dataset', `The fixture has no dataset ${req.dataset}.`, { status: 404 })
  if (!ds.held) throw new ApiError('not_held', `${ds.id} isn't held locally.`, { status: 404, notHeldCause: ds.not_held_cause })
  if (req.dataset === 'demo_output' || req.dataset === 'demo_price') return seriesResponse(req.dataset, req)
  if (req.dataset === 'demo_notices') return eventsResponse(req)
  return referenceResponse(req)
}

export const fixtureAdapter: DataSource = {
  origin: 'fixture',
  manifest: (signal) => later(manifest, signal),
  rows: (req, signal) => later(() => rows(req), signal),
}
