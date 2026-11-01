/**
 * Issue times, for forecast and day-ahead datasets whose rows carry the
 * instant each figure was issued: how far ahead a figure was issued, as a
 * chart unit, the issue a row names, and the issues behind a window's
 * figures. The lead's words are `leadText` (design/time).
 */
import { HOUR_MS, clock, instantLabel, leadText, londonMidnight, zoneAbbrev } from '../../design/time'
import type { RowsResponse } from '../contract'
import type { DisplayUnit } from './units'

/** The column Elexon's day-ahead datasets stamp each figure's issue in. */
export const ISSUED = 'published_at'

/**
 * Hours before its half-hour a figure was issued. Not a unit the template
 * knows, so it is set out here; the tooltip gives the lead exactly.
 */
export const LEAD_UNIT: DisplayUnit = {
  label: 'h',
  source: 'h',
  factor: 1,
  numeric: true,
  format: (v) => `issued ${leadText(v * HOUR_MS)}${v >= 0 ? ' ahead' : ''}`,
  plain: (v) => (Math.abs(v) < 0.05 ? '0' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`),
  caption: 'Hours issued ahead',
}

/** An issue time as held (an ISO string), as an instant; null when there is none. */
export function issuedAt(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

/** A figure's period and the instant it was issued. */
export interface Issue {
  t: number
  at: number
}

/** The issues behind a series response's figures in `column`, from each row's own issue time. */
export function rowIssues(response: RowsResponse | null | undefined, column: string): Issue[] {
  if (!response || response.kind !== 'series') return []
  const out: Issue[] = []
  for (const r of response.rows) {
    if (typeof r[column] !== 'number') continue
    const at = issuedAt(r[ISSUED])
    if (at !== null) out.push({ t: r.ts, at })
  }
  return out
}

/** The issues behind rows that carry `l`, the hours each figure was issued ahead of its period. */
export function issuesIn(rows: { t: number; l?: number | null }[]): Issue[] {
  const out: Issue[] = []
  for (const r of rows) if (typeof r.l === 'number') out.push({ t: r.t, at: Math.round(r.t - r.l * HOUR_MS) })
  return out
}

export interface IssueStats {
  /** Periods with a value and an issue time. */
  count: number
  /** How long before its period each was issued: the shortest, the median and the longest. */
  shortest: number
  median: number
  longest: number
  /** The newest issue time held. */
  newest: number
}

/** How far ahead of its period each figure was issued. Null with no issue held. */
export function issueStats(issues: Issue[]): IssueStats | null {
  if (!issues.length) return null
  const leads = issues.map((x) => x.t - x.at).sort((a, b) => a - b)
  const mid = leads.length >> 1
  const median = leads.length % 2 ? leads[mid] : (leads[mid - 1] + leads[mid]) / 2
  const newest = issues.reduce((n, x) => Math.max(n, x.at), -Infinity)
  return { count: leads.length, shortest: leads[0], median, longest: leads[leads.length - 1], newest }
}

/** The issues behind some figures, newest first, with how many periods each gives. */
export function issueTally(issues: Issue[]): { at: number; n: number }[] {
  const byAt = new Map<number, number>()
  for (const x of issues) byAt.set(x.at, (byAt.get(x.at) ?? 0) + 1)
  return [...byAt.entries()].map(([at, n]) => ({ at, n })).sort((a, b) => b.at - a.at)
}

/** `01:17 BST that day (45)`: an issue named against the UK day (its midnight) it gives figures for. */
export function issueWords(dayStart: number, at: number, n: number, many: boolean): string {
  const issuedOn = londonMidnight(at)
  const time = `${clock(at)} ${zoneAbbrev(at)}`
  const when = issuedOn === dayStart ? `${time} that day` : issuedOn === londonMidnight(dayStart - 1) ? `${time} the day before` : instantLabel(at)
  return many ? `${when} (${n})` : when
}
