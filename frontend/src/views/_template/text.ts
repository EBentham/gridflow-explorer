/**
 * What the template says in plain words: why a dataset isn't held, how
 * thin the local coverage is, and what a truncated response left out. The
 * backend's causes and notes are research text with internal references, so
 * they are read here and never printed as they stand.
 */
import { cadenceText, dayLabel, DAY_MS, fmtDay, HOUR_MS, MINUTE_MS, rangeText, stepNoun, ukDate } from '../../design/time'
import { listText, plural } from '../../design/format'
import type { DatasetCoverage, EqualsFilter, ManifestDataset, ManifestSource, RowsResponse } from '../contract'
import type { DateRange } from '../../lib/range'

/** `Elexon BMRS`, `ENTSO-E`: a source's name for source lines. */
export const sourceName = (s: Pick<ManifestSource, 'name'>) => s.name.replace(' Transparency', '')

/** Why a dataset isn't held locally, from the cause's prefix (the tail is research detail). */
export function notHeldText(cause: string | null): string {
  const kind = (cause ?? '').split(':')[0].trim()
  switch (kind) {
    case 'never-fetched':
      return "gridflow hasn't fetched it"
    case 'fetched-empty':
      return 'gridflow asked the source for it, and the answer was empty'
    case 'missing-in-catalogue':
      return "its table isn't in the local store"
    case 'current-only':
      return 'the source only serves the present moment, so no history is kept'
    case 'no-transformer':
      return "gridflow fetches it but doesn't turn it into a table yet"
    case 'folded-into':
      return 'its rows are kept inside another dataset'
    default:
      return "it isn't held locally"
  }
}

/** Means over a bucket, as a noun: `hourly means`, `4-hour means`, `daily means`. */
export function meansText(bucketMs: number): string {
  if (bucketMs === HOUR_MS) return 'hourly means'
  if (bucketMs === DAY_MS) return 'daily means'
  const [unit, ms] = bucketMs % DAY_MS === 0 ? ['day', DAY_MS] : bucketMs % HOUR_MS === 0 ? ['hour', HOUR_MS] : bucketMs % MINUTE_MS === 0 ? ['minute', MINUTE_MS] : ['second', 1000]
  return `${Math.round(bucketMs / Number(ms))}-${unit} means`
}

/** The one filter a default applied: the dataset's `default_filter`, or failing that the response's only filter. */
function defaultFilterOf(response: Pick<RowsResponse, 'filters'>, dataset: Pick<ManifestDataset, 'default_filter'> | null): EqualsFilter | null {
  if (dataset?.default_filter) return dataset.default_filter
  const applied = Object.entries(response.filters ?? {})
  if (applied.length !== 1) return null
  const [column, equals] = applied[0]
  return equals === null ? null : { column, equals }
}

/**
 * One sentence per reason a response came back cut down or changed, in
 * plain words; nothing when it didn't. The backend's reasons name no column
 * for a default filter, so its column and value come from the dataset's
 * `default_filter` (or the response's only filter).
 */
export function truncationSentences(
  response: Pick<RowsResponse, 'truncated' | 'truncation' | 'filters' | 'group'>,
  dataset: Pick<ManifestDataset, 'default_filter'> | null,
): string[] {
  const t = response.truncation
  if (!response.truncated) return []
  const unexplained = 'Not every row held for this window came back, and the reason was not given.'
  if (!t) return [unexplained]
  const out: string[] = []
  const deep = t.reasons.some((r) => r.type === 'deep_range')
  const downsampled = t.reasons.some((r) => r.type === 'downsample')
  for (const r of t.reasons) {
    switch (r.type) {
      case 'default_filter': {
        const f = defaultFilterOf(response, dataset)
        const omitted = typeof r.omitted_rows === 'number' && r.omitted_rows > 0 ? ` It leaves out ${plural(r.omitted_rows, 'row', 'rows')}.` : ''
        out.push(f ? `Shows ${f.column} ${String(f.equals)} only, this dataset's default.${omitted}` : `Shows only the rows this dataset keeps by default.${omitted}`)
        break
      }
      case 'default_top_n': {
        const kept = r.label ? `the ${r.label}` : Array.isArray(r.selected_ids) ? `the largest ${plural(r.selected_ids.length, 'value', 'values')} of ${response.group ?? 'its split'}` : 'the largest groups only'
        const rows = typeof r.omitted_rows === 'number' && r.omitted_rows > 0 ? ` (${plural(r.omitted_rows, 'row', 'rows')})` : ''
        const others = typeof r.omitted_groups === 'number' && r.omitted_groups > 0 ? ` ${plural(r.omitted_groups, 'other is', 'others are')} left out${rows}.` : ''
        const nulls = r.excluded_null_unit_rows
        const noUnit = typeof nulls === 'number' && nulls > 0 ? ` ${plural(nulls, 'row names', 'rows name')} no unit and ${nulls === 1 ? "isn't" : "aren't"} shown.` : ''
        out.push(`Shows ${kept}, this dataset's default.${others}${noUnit}`)
        break
      }
      case 'exact_duplicate_rows':
        if (typeof r.removed_rows === 'number' && r.removed_rows > 0) out.push(`Leaves out ${plural(r.removed_rows, 'row that exactly repeats', 'rows that exactly repeat')} another.`)
        break
      case 'downsample': {
        const bucket = r.bucket_ms ?? t.bucket_ms
        const why = deep ? 'as the window is too long to read at full detail' : `as the window holds more rows than one read returns (${t.row_cap.toLocaleString('en-GB')})`
        out.push(`Shown as ${bucket ? meansText(bucket) : 'means'}, ${why}.`)
        break
      }
      case 'deep_range':
        // Said with the downsample it comes with.
        if (!downsampled) out.push('The window is too long to read at full detail, so it is shown as means.')
        break
      case 'ancillary_null': {
        const cols = Array.isArray(r.columns) ? r.columns.filter((c): c is string => typeof c === 'string') : []
        out.push(cols.length ? `Text in ${listText(cols)} that varies within a period is left blank in the means.` : 'Text that varies within a period is left blank in the means.')
        break
      }
      default:
        out.push('Some rows were left out.')
    }
  }
  // A truncated response always says something, whatever its reasons held.
  if (!out.length) out.push(t.bucket_ms ? `Shown as ${meansText(t.bucket_ms)}.` : unexplained)
  return out
}

export interface HeldDay {
  day: string
  start: number
  expected: number | null
  held: number
}

/**
 * How thin the coverage of this window is, in plain words: where the local
 * depth stops ("Held locally for 8–22 Sep 2026 only"), days without rows,
 * and days held only in part ("Tue 22 Sep holds 2 of 48 half-hours").
 */
export function coverageSentences({
  coverage,
  window,
  days,
  stepMs,
  maxPartial = 3,
}: {
  coverage: Pick<DatasetCoverage, 'first_day' | 'last_day'> | null
  window: DateRange
  days: HeldDay[]
  stepMs: number | null
  maxPartial?: number
}): string[] {
  const out: string[] = []
  const first = coverage?.first_day
  const last = coverage?.last_day
  if (first && last && (window.start < first || window.end > last)) {
    out.push(`Held locally for ${rangeText(first, last)} only.`)
  }
  const heldDays = days.filter((d) => d.held > 0).length
  if (days.length && heldDays < days.length) {
    out.push(`${heldDays} of ${plural(days.length, 'day', 'days')} in this window hold rows.`)
  }
  const partial = days.filter((d) => d.held > 0 && d.expected !== null && d.held < d.expected)
  if (partial.length) {
    const shown = partial.slice(0, maxPartial).map((d) => `${dayLabel(d.start)} holds ${d.held} of ${d.expected} ${stepNoun(stepMs)}`)
    const more = partial.length > maxPartial ? `, and ${plural(partial.length - maxPartial, 'more day is', 'more days are')} partial` : ''
    out.push(`${listText(shown)}${more}.`)
  }
  return out
}

/** `run from 8 Sep to 22 Sep 2026`, or `are all on 22 Sep 2026`: where a dataset's local rows are. */
function depthRun(first: string, last: string): string {
  return first === last ? `are all on ${rangeText(first, last)}` : `run from ${rangeText(first, last).replace(' – ', ' to ')}`
}

/** The empty window in plain words, with where the local rows run: a hole inside them, or a window beyond them. */
export function emptyWindowText(window: DateRange | null, coverage: DatasetCoverage | null): string {
  const w = window ? rangeText(window.start, window.end) : 'this window'
  const first = coverage?.first_day
  const last = coverage?.last_day
  if (!first || !last) return `Nothing is held locally for ${w}.`
  if (window && window.start >= first && window.end <= last) return `Its local rows ${depthRun(first, last)}, with none in ${w}.`
  return `Nothing is held locally for ${w}. Its local rows ${depthRun(first, last)}.`
}

/** The researched grain's tokens that name a fixed step (the rows endpoint reads the same ones). */
const GRAIN_MS = new Map<string, number>([
  ['15s', 15_000],
  ['5min', 5 * MINUTE_MS],
  ['15min', 15 * MINUTE_MS],
  ['30min', 30 * MINUTE_MS],
  ['60min', HOUR_MS],
  ['1h', HOUR_MS],
  ['24h', DAY_MS],
  ['1d', DAY_MS],
  ['7d', 7 * DAY_MS],
])

/**
 * A dataset's own cadence in words: from the rows' step when they come at
 * it, else from its researched grain. Pass a null step for rows that are
 * means over buckets, whose step isn't the dataset's.
 */
export function cadenceOf(stepMs: number | null, dataset: ManifestDataset): string {
  if (stepMs) return cadenceText(stepMs)
  const grain = (dataset.clock?.grain ?? '').trim().toLowerCase()
  const token = grain.split(/[\s(]/)[0]
  const step = GRAIN_MS.get(token)
  if (step) return `${cadenceText(step)}${grain.includes('sparse') ? ', with gaps' : ''}`
  if (token === '1y') return 'Yearly'
  if (grain.startsWith('mixed')) return 'Mixed: some areas report more often than others'
  if (grain.startsWith('irregular')) return 'Irregular: a row whenever a value changes'
  if (grain === 'event') return 'A row per event'
  if (grain === 'snapshot' || grain === 'none' || grain === '') return 'No clock: a table as held'
  return 'Not a fixed step'
}

/** `8 Sep – 22 Sep 2026, 14 days`: a dataset's local depth. */
export function depthText(coverage: DatasetCoverage | null): string | null {
  if (!coverage?.first_day || !coverage.last_day) return null
  const days = coverage.day_count === null ? '' : `, ${plural(coverage.day_count, 'day', 'days')} with rows`
  return `${rangeText(coverage.first_day, coverage.last_day)}${days}`
}

/** `Mon 21 Sep 2026`: the UK day of an ISO instant. */
export function isoDayText(iso: string | null | undefined): string | null {
  if (!iso) return null
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  const date = ukDate(ms)
  return `${fmtDay(date)} ${date.slice(0, 4)}`
}
