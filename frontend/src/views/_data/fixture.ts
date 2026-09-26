/**
 * The dev fixture adapter: a `DataSource` that answers from the synthetic
 * "Template demo" source (`fixtureData.ts`) with exactly the shapes of
 * `/api/sources` and the rows endpoint, including the backend's rules (P3-2
 * PLAN §7): the group asked for, else the first series dim, else the first
 * dim; null rows for missing half-hours (never zeros); the dataset's default
 * filter unless a request names its own or clears it, reported in `filters`
 * and, when it leaves records out, in `truncation`; and time-bucket means
 * past the row cap, with `grain_ms` the bucket's width. Its `origin` is
 * `fixture`, so every panel reading it carries the dashed-ochre Fixture tag.
 *
 * For screenshots of the states a page must handle, `?fixture=` on the page
 * URL makes the rows request fail as the backend would: `error` (a 500 with
 * no envelope), `refreshing` (gridflow holds the store), `toomany` (a 413
 * `result_too_large` with its reason and hint), or `empty` (a window with no
 * rows).
 */
import { ApiError } from '../../api/client'
import { DAY_MS, HALF_HOUR, dayStart, nextLondonMidnight, shiftDate, todayUk } from '../../design/time'
import type {
  DataSource,
  EventsRowsResponse,
  Manifest,
  ManifestDataset,
  ReferenceRowsResponse,
  RowsRequest,
  RowsResponse,
  SeriesRow,
  SeriesRowsResponse,
  Truncation,
  TruncationReason,
} from '../contract'
import { FIXTURE_READ_AT, MARKETS, NOTICES, PLANT_TYPES, UNITS, fixtureSource, isHeld, outputMw, priceGbpMwh } from './fixtureData'

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

/** The filters a request applies: its own, none when it clears them, else the dataset's default. */
function effectiveFilters(ds: ManifestDataset, req: RowsRequest): { filters: Record<string, string>; byDefault: boolean } {
  if (req.filters === null) return { filters: {}, byDefault: false }
  if (req.filters && Object.keys(req.filters).length) {
    for (const k of Object.keys(req.filters)) {
      if (!ds.dims.some((d) => d.column === k)) throw new ApiError('bad_filter', `${k} isn't a column this dataset can be filtered by.`, { status: 422 })
    }
    return { filters: req.filters, byDefault: false }
  }
  const d = ds.default_filter
  return d ? { filters: { [d.column]: String(d.equals) }, byDefault: true } : { filters: {}, byDefault: false }
}

const matches = (row: Record<string, unknown>, filters: Record<string, string>) => Object.entries(filters).every(([k, v]) => String(row[k]) === v)

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

/**
 * Long rows for the window, one per half-hour and dim value, null where the
 * step isn't held. With no held step in the window there are none.
 */
function seriesRows(id: 'demo_output' | 'demo_price', window: { start: string; end: string }): SeriesRow[] {
  const lo = dayStart(window.start)
  const hi = nextLondonMidnight(dayStart(window.end))
  const grid: number[] = []
  for (let t = lo; t < hi; t += HALF_HOUR) grid.push(t)
  if (!grid.some((t) => isHeld(id, t))) return []
  const rows: SeriesRow[] = []
  if (id === 'demo_price') {
    for (const t of grid) for (const m of MARKETS) rows.push({ ts: t, market: m, price_gbp_mwh: isHeld(id, t) ? priceGbpMwh(t, m) : null })
    return rows
  }
  for (const t of grid) for (const p of PLANT_TYPES) rows.push({ ts: t, plant_type: p, output_mw: isHeld(id, t) ? outputMw(p, t) : null })
  return rows
}

function seriesResponse(id: 'demo_output' | 'demo_price', req: RowsRequest): SeriesRowsResponse {
  const ds = dataset(id)
  if (!ds?.coverage) throw new ApiError('unknown_dataset', `No dataset ${id}.`, { status: 404 })
  const window = resolveWindow(req, ds.coverage.latest_local_day ?? '')
  if (req.group && !ds.dims.some((d) => d.column === req.group)) {
    throw new ApiError('bad_group', `${req.group} isn't a column this dataset can be split by.`, { status: 422 })
  }
  const group = req.group ?? ds.dims.find((d) => d.role === 'series')?.column ?? ds.dims[0]?.column ?? null
  const { filters, byDefault } = effectiveFilters(ds, req)
  const column = ds.values[0].column
  const all = scenario() === 'empty' ? [] : seriesRows(id, window)
  const selected = all.filter((r) => matches(r, filters))
  // Records are held rows; the null rows standing for missing steps aren't records.
  const records = (rows: SeriesRow[]) => rows.filter((r) => r[column] !== null).length
  const beforeDefaults = records(byDefault ? all : selected)
  const afterFilters = records(selected)
  const reasons: TruncationReason[] = []
  if (byDefault && beforeDefaults > afterFilters) reasons.push({ type: 'default_filter', omitted_rows: beforeDefaults - afterFilters })
  let rows = selected
  let bucketMs: number | null = null
  if (rows.length > FIXTURE_ROW_CAP) {
    for (const bucket of BUCKETS_MS) {
      rows = downsample(selected, group, column, bucket, dayStart(window.start))
      if (rows.length <= FIXTURE_ROW_CAP) {
        bucketMs = bucket
        reasons.push({ type: 'downsample', bucket_ms: bucket })
        break
      }
    }
  }
  const truncation: Truncation | null = reasons.length
    ? {
        row_cap: FIXTURE_ROW_CAP,
        reasons,
        rows_before_defaults: beforeDefaults,
        rows_after_filters: afterFilters,
        returned_rows: rows.length,
        bucket_ms: bucketMs,
        aggregation: bucketMs === null ? null : 'mean',
      }
    : null
  return {
    dataset: id,
    source: 'demo',
    kind: 'series',
    relation: ds.relation ?? '',
    window,
    grain_ms: bucketMs ?? HALF_HOUR,
    columns: ds.values,
    group,
    filters,
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
  const { filters, byDefault } = effectiveFilters(ds, req)
  const rows = inWindow.filter((n) => matches(n, filters))
  const omitted = inWindow.length - rows.length
  const cut = byDefault && omitted > 0
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
    truncated: cut,
    truncation: cut
      ? {
          row_cap: FIXTURE_ROW_CAP,
          reasons: [{ type: 'default_filter', omitted_rows: omitted }],
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
  const { filters } = effectiveFilters(ds, req)
  const rows = scenario() === 'empty' ? [] : UNITS.filter((u) => matches(u, filters))
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
  // A genuine 500 has no envelope; the client names it `unknown_error`.
  if (s === 'error') throw new ApiError('unknown_error', 'the fixture was asked to fail (?fixture=error).', { status: 500 })
  if (s === 'refreshing') throw new ApiError('refresh_in_progress', 'A dataset refresh is in progress. Try again shortly.', { status: 503 })
  if (s === 'toomany') {
    throw new ApiError('result_too_large', 'Result exceeds the safe row limit.', { status: 413, reason: 'row_cap', hint: 'Narrow the date window or filter a dimension.' })
  }
  if (req.source !== 'demo') throw new ApiError('unknown_dataset', `The fixture has no source ${req.source}.`, { status: 404 })
  const ds = dataset(req.dataset)
  if (!ds) throw new ApiError('unknown_dataset', `The fixture has no dataset ${req.dataset}.`, { status: 404 })
  if (!ds.held) throw new ApiError('unknown_dataset', 'Dataset is not held.', { status: 404, notHeldCause: ds.not_held_cause })
  if (req.dataset === 'demo_output' || req.dataset === 'demo_price') return seriesResponse(req.dataset, req)
  if (req.dataset === 'demo_notices') return eventsResponse(req)
  return referenceResponse(req)
}

export const fixtureAdapter: DataSource = {
  origin: 'fixture',
  manifest: (signal) => later(manifest, signal),
  rows: (req, signal) => later(() => rows(req), signal),
}
