/**
 * What the template says in plain words: why a dataset isn't held, how
 * thin the local coverage is, and what a truncated response left out. The
 * backend's causes and notes are research text with internal references, so
 * they are read here and never printed as they stand.
 */
import { cadenceText, dayLabel, DAY_MS, fmtDay, HOUR_MS, MINUTE_MS, rangeText, stepNoun, ukDate } from '../../design/time'
import { listText, plural } from '../../design/format'
import type { DatasetCoverage, ManifestDataset, ManifestSource, Truncation } from '../contract'
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

/** One sentence per reason the rows endpoint returned fewer rows than the window holds. */
export function truncationSentences(t: Truncation | null, truncated: boolean): string[] {
  if (!truncated) return []
  if (!t) return ['Not every row held for this window came back; the reason was not given.']
  const out: string[] = []
  for (const r of t.reasons) {
    const col = r.column ? r.column : 'a column'
    const omitted = typeof r.omitted_rows === 'number' && r.omitted_rows > 0 ? ` It leaves out ${plural(r.omitted_rows, 'row', 'rows')}.` : ''
    switch (r.type) {
      case 'default_filter':
        out.push(`Shows ${col} ${r.equals === undefined || r.equals === null ? '(one value)' : String(r.equals)} only, this dataset's default.${omitted}`)
        break
      case 'default_top_n': {
        const what = r.label ?? (r.ranking ? `ranked by ${r.ranking}` : 'by size')
        const others = typeof r.omitted_groups === 'number' ? ` ${plural(r.omitted_groups, 'other', 'others')} are left out.` : ''
        out.push(`Shows the top ${r.limit ?? 'few'} values of ${col}, ${what}.${others}`)
        break
      }
      case 'group_aggregation':
        out.push(`Rows sharing a time and a ${col} value are averaged into one.`)
        break
      case 'downsample': {
        const bucket = r.bucket_ms ?? t.bucket_ms
        out.push(`Drawn as ${bucket ? meansText(bucket) : 'means'}: the window holds more rows than one read returns (${t.row_cap.toLocaleString('en-GB')}).`)
        break
      }
      case 'deep_range':
        out.push('The window is longer than the rows endpoint reads at full detail, so it is drawn as means.')
        break
      default:
        out.push(`Some rows were left out (${r.type}).`)
    }
  }
  if (!t.reasons.length && t.bucket_ms) out.push(`Drawn as ${meansText(t.bucket_ms)}.`)
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
  coverage: DatasetCoverage | null
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

/** The empty window in plain words, with where local rows end. */
export function emptyWindowText(window: DateRange | null, coverage: DatasetCoverage | null): string {
  const w = window ? rangeText(window.start, window.end) : 'this window'
  const first = coverage?.first_day
  const last = coverage?.last_day
  const depth = first && last ? ` It is held locally for ${rangeText(first, last)}.` : ''
  return `Nothing is held locally for ${w}.${depth}`
}

/** A dataset's cadence in words, from the rows' step or, failing that, its researched grain. */
export function cadenceOf(stepMs: number | null, dataset: ManifestDataset): string {
  if (stepMs) return cadenceText(stepMs)
  const grain = (dataset.clock?.grain ?? '').toLowerCase()
  if (grain.startsWith('mixed')) return 'Mixed: some areas report more often than others'
  if (grain.startsWith('irregular')) return 'Irregular: a row whenever a value changes'
  if (grain === 'event') return 'A row per event'
  if (grain === 'snapshot' || grain === 'none' || grain === '') return 'No clock: a table as held'
  return 'Irregular'
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
