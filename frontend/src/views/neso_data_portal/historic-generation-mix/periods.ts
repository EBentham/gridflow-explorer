/**
 * How this page reads a window, and each period's figures.
 *
 * The window picks the clock:
 * - up to 31 days, every half-hour, drawn by the template's chart;
 * - up to 1,098 days (three years), a point per UK day;
 * - beyond that, a point per calendar month.
 *
 * The backend decides what a long window comes back as: half-hours up to 400
 * days, then the finest means that fit one read (hourly for a few years,
 * 4-hourly for the whole history). A period's figures are plain means of the
 * rows held in it, each column over its own values, so a period holding none
 * is a gap (null), never zero. The fuels' means add up to the period's mean
 * total, as NESO's fuels add up to its `generation`; a share is one fuel's
 * mean over that total.
 */
import { DAY_MS, dayLabel, dayStart, rangeText, shiftDate, stepNoun, ukDate, type TimeTicks } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { SeriesModel, WideRow } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import { CI, FUEL_COLUMNS } from './fuels'

export type Clock = 'native' | 'day' | 'month'
export type PeriodKind = 'day' | 'month' | 'year' | 'window'

/** Up to this many days the page draws each half-hour. */
export const NATIVE_MAX_DAYS = 31
/** Up to this many days the long view draws a point per UK day; beyond it, a point per month. */
export const DAILY_MAX_DAYS = 1098

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const COLUMNS = [...FUEL_COLUMNS, CI]

const utcDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** Days in a window, both ends included. */
export const daysIn = (w: DateRange) => Math.round((utcDay(w.end) - utcDay(w.start)) / DAY_MS) + 1

export function clockOf(w: DateRange | null): Clock {
  if (!w) return 'native'
  const n = daysIn(w)
  return n <= NATIVE_MAX_DAYS ? 'native' : n <= DAILY_MAX_DAYS ? 'day' : 'month'
}

/** What one chart point of a long clock stands for. */
export const pointKindOf = (clock: Clock): PeriodKind => (clock === 'month' ? 'month' : 'day')

/** What one row of the working panel's table stands for: days under the half-hours, months under daily points, years under monthly ones. */
export const rowKindOf = (clock: Clock): PeriodKind => (clock === 'native' ? 'day' : clock === 'day' ? 'month' : 'year')

export interface Period {
  kind: PeriodKind
  /** `2026-09-26`, `2026-09`, `2026`, or the window's two dates. */
  key: string
  /** Its first instant inside the window (a London midnight), and the instant after its last. */
  start: number
  end: number
  /** Its first and last UK dates inside the window. */
  from: string
  to: string
  /** The window holds all of it: a month or year cut by the window's edge is partial. */
  whole: boolean
  /** Rows the backend returned in it (every step of its grid, held or not), and those holding a fuel value. */
  steps: number
  held: number
  /** Each column's mean over its own held values, in display units (GW, gCO₂/kWh); null when it holds none. */
  mean: Record<string, number | null>
  /** The fuels' means added up: the period's mean total, GW. Null unless every fuel holds a value. */
  total: number | null
}

interface Bound {
  kind: PeriodKind
  key: string
  /** First UK date, and the date after the last. */
  from: string
  after: string
  whole: boolean
}

/** The rows' step as a noun: `half-hours`, or `hourly means` when the backend read the window as means. */
export function stepsText(model: SeriesModel): string {
  return model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
}

/** The latest row holding a fuel value. */
export function latestHeld(model: SeriesModel): WideRow | undefined {
  const fields = FUEL_COLUMNS.flatMap((c) => {
    const d = model.all.find((x) => x.column === c)
    return d ? [d.field] : []
  })
  for (let i = model.rows.length - 1; i >= 0; i -= 1) if (fields.some((f) => typeof model.rows[i][f] === 'number')) return model.rows[i]
  return undefined
}

/** `1,488`, or `1,237 of 1,248` when the period holds fewer steps than its grid. */
export function heldText(p: Pick<Period, 'held' | 'steps'>): string {
  return p.held === p.steps ? p.held.toLocaleString('en-GB') : `${p.held.toLocaleString('en-GB')} of ${p.steps.toLocaleString('en-GB')}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Each period of `kind` the window touches, cut to the window. */
function bounds(w: DateRange, kind: Exclude<PeriodKind, 'window'>): Bound[] {
  const last = shiftDate(w.end, 1)
  const out: Bound[] = []
  if (kind === 'day') {
    for (let d = w.start; d <= w.end; d = shiftDate(d, 1)) out.push({ kind, key: d, from: d, after: shiftDate(d, 1), whole: true })
    return out
  }
  let [y, m] = w.start.split('-').map(Number)
  if (kind === 'year') m = 1
  for (;;) {
    const first = kind === 'year' ? `${y}-01-01` : `${y}-${pad(m)}-01`
    if (first > w.end) break
    const [ny, nm] = kind === 'year' || m === 12 ? [y + 1, 1] : [y, m + 1]
    const next = `${ny}-${pad(nm)}-01`
    const from = first < w.start ? w.start : first
    const after = next > last ? last : next
    out.push({ kind, key: kind === 'year' ? String(y) : first.slice(0, 7), from, after, whole: from === first && after === next })
    y = ny
    m = nm
  }
  return out
}

/**
 * Each bound's figures from the rows. Rows are sorted by time and assigned by
 * their start on the UK clock: a 4-hour mean that runs past midnight counts
 * in the day it starts in.
 */
function aggregate(model: SeriesModel, list: Bound[]): Period[] {
  const fields = COLUMNS.flatMap((c) => {
    const d = model.all.find((x) => x.column === c)
    return d ? [[c, d.field] as const] : []
  })
  const fuelFields = fields.filter(([c]) => c !== CI).map(([, f]) => f)
  const spans = list.map((b) => ({ start: dayStart(b.from), end: dayStart(b.after) }))
  const acc = list.map(() => ({ steps: 0, held: 0, sums: new Map<string, { sum: number; n: number }>() }))
  let i = 0
  for (const row of model.rows) {
    while (i < spans.length && row.t >= spans[i].end) i += 1
    if (i >= spans.length) break
    if (row.t < spans[i].start) continue
    const a = acc[i]
    a.steps += 1
    if (fuelFields.some((f) => typeof row[f] === 'number')) a.held += 1
    for (const [column, field] of fields) {
      const v = row[field]
      if (typeof v !== 'number') continue
      const s = a.sums.get(column) ?? { sum: 0, n: 0 }
      s.sum += v
      s.n += 1
      a.sums.set(column, s)
    }
  }
  return list.map((b, k) => {
    const mean: Record<string, number | null> = {}
    for (const c of COLUMNS) {
      const s = acc[k].sums.get(c)
      mean[c] = s && s.n ? s.sum / s.n : null
    }
    const fuelMeans = FUEL_COLUMNS.map((c) => mean[c])
    const total = fuelMeans.every((v): v is number => v !== null) ? fuelMeans.reduce((x, y) => x + y, 0) : null
    return {
      kind: b.kind,
      key: b.key,
      start: spans[k].start,
      end: spans[k].end,
      from: b.from,
      to: shiftDate(b.after, -1),
      whole: b.whole,
      steps: acc[k].steps,
      held: acc[k].held,
      mean,
      total,
    }
  })
}

/** Every period of `kind` in the window, held or not, with each column's mean over the rows held in it. */
export function periodsOf(model: SeriesModel, w: DateRange, kind: Exclude<PeriodKind, 'window'>): Period[] {
  return aggregate(model, bounds(w, kind))
}

/** The whole window as one period. */
export function windowPeriod(model: SeriesModel, w: DateRange): Period {
  return aggregate(model, [{ kind: 'window', key: `${w.start}/${w.end}`, from: w.start, after: shiftDate(w.end, 1), whole: true }])[0]
}

/** A fuel's share of the period's mean total, 0 to 1; null when either is missing. */
export function shareOf(p: Pick<Period, 'mean' | 'total'>, column: string): number | null {
  const v = p.mean[column]
  return v === null || p.total === null || p.total <= 0 ? null : v / p.total
}

/** `Sat 26 Sep 2026` (or without its year), `September 2026` (or `Sep 2026`), `2026`, or the window's dates. */
export function periodText(p: Pick<Period, 'kind' | 'key' | 'start' | 'from' | 'to'>, { short = false, year = true }: { short?: boolean; year?: boolean } = {}): string {
  if (p.kind === 'window') return rangeText(p.from, p.to)
  if (p.kind === 'year') return p.key
  if (p.kind === 'month') {
    const [y, m] = p.key.split('-').map(Number)
    return `${short ? MONTHS[m - 1] : MONTH_NAMES[m - 1]} ${y}`
  }
  return year ? `${dayLabel(p.start)} ${p.key.slice(0, 4)}` : dayLabel(p.start)
}

/**
 * A period's name. A month or year the window cuts is named by the days it
 * holds, so it can't be read as the whole of it: `27–30 Sep 2025` (short) or
 * `27–30 September 2025`, and `1 Jan – 26 Sep 2026`.
 */
export function periodName(p: Period, opts: { short?: boolean; year?: boolean } = {}): string {
  if (p.whole || p.kind === 'day' || p.kind === 'window') return periodText(p, opts)
  if (p.kind === 'year' || p.from.slice(0, 7) !== p.to.slice(0, 7)) return rangeText(p.from, p.to)
  const [y, m, first] = p.from.split('-').map(Number)
  const last = Number(p.to.slice(8))
  const days = first === last ? String(first) : `${first}–${last}`
  return `${days} ${opts.short ? MONTHS[m - 1] : MONTH_NAMES[m - 1]} ${y}`
}

/** Leading runs of zeros this long or longer are named; a night's solar never is. */
const ZERO_RUN_DAYS = 28

export interface ZeroRun {
  column: string
  /** The UK date of the fuel's first value above zero in the window; null when it reads zero throughout. */
  until: string | null
}

/**
 * Fuels that read exactly zero in every row held from the window's start for
 * four weeks or more, or through the whole window: zeros as NESO's file
 * carries them, not gaps. A fuel with no value held at all is a gap, which
 * the coverage names, so it isn't listed here. Rows are sorted by time.
 */
export function zeroRuns(model: SeriesModel): ZeroRun[] {
  const out: ZeroRun[] = []
  for (const column of FUEL_COLUMNS) {
    const field = model.all.find((x) => x.column === column)?.field
    if (!field) continue
    let firstHeld: number | null = null
    let firstAbove: number | null = null
    for (const row of model.rows) {
      const v = row[field]
      if (typeof v !== 'number') continue
      firstHeld ??= row.t
      if (v !== 0) {
        firstAbove = row.t
        break
      }
    }
    if (firstHeld === null) continue
    if (firstAbove === null) out.push({ column, until: null })
    else if (firstAbove - firstHeld >= ZERO_RUN_DAYS * DAY_MS) out.push({ column, until: ukDate(firstAbove) })
  }
  return out
}

/** The period holding the instant `t`. */
export function periodAt(periods: Period[], t: number): Period | undefined {
  return periods.find((p) => t >= p.start && t < p.end)
}

/**
 * Ticks for a long window: the first of each month for a daily clock
 * (thinned to every second month, then to quarters, as the months grow), and
 * 1 January for a monthly one. Rules follow the ticks, as the template's do
 * past six weeks. January, and the first tick, name their year.
 */
export function longTicks(domain: [number, number], clock: Clock): TimeTicks {
  const firstDay = ukDate(domain[0])
  let [y, m] = firstDay.split('-').map(Number)
  if (firstDay.slice(8) !== '01') [y, m] = m === 12 ? [y + 1, 1] : [y, m + 1]
  const months: { t: number; y: number; m: number }[] = []
  for (;;) {
    const t = dayStart(`${y}-${pad(m)}-01`)
    if (t >= domain[1]) break
    months.push({ t, y, m })
    ;[y, m] = m === 12 ? [y + 1, 1] : [y, m + 1]
  }
  let kept = months
  if (clock === 'month') kept = months.filter((x) => x.m === 1)
  else if (months.length > 28) kept = months.filter((x) => (x.m - 1) % 3 === 0)
  else if (months.length > 14) kept = months.filter((x) => x.m % 2 === 1)
  const labels = new Map(kept.map((x, i) => [x.t, clock === 'month' ? String(x.y) : x.m === 1 || i === 0 ? `${MONTHS[x.m - 1]} ${x.y}` : MONTHS[x.m - 1]]))
  const ticks = kept.map((x) => x.t)
  return { ticks, format: (ms: number) => labels.get(ms) ?? '', midnights: ticks }
}
