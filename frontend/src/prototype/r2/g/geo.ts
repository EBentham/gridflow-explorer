/**
 * Slot g geometry: the one horizontal scale shared by the chart above ground
 * and the strata below it, plus the interval arithmetic that turns rows and
 * coverage days into rock and voids. Pure functions, no React.
 */
import { useEffect, useRef, useState } from 'react'
import { fetchJson } from '../../../api/client'
import type { Coverage } from '../../../api/types'
import { HALF_HOUR, clock, dayLabel, londonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'

/** Page gutter: the section is full-bleed so the strata run edge to edge, as on the site. */
export function gutOf(width: number): number {
  return width >= 1100 ? 40 : 20
}
/** Plot's left edge: the gutter plus room for y-axis labels. */
export function plOf(width: number): number {
  return gutOf(width) + 58
}
/** Width from the plot's right edge to the page edge: the right column (direct labels above ground, cable terminals below) plus the gutter. */
export function prOf(width: number): number {
  return gutOf(width) + (width >= 1100 ? 300 : 236)
}
/** Cable trunk offset into the right column. */
export const TRUNK = 22

export type Interval = [number, number]

const DAY = 24 * 3600 * 1000

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** London midnight that starts a settlement date (`YYYY-MM-DD`). */
export function dayStart(iso: string): number {
  return londonMidnight(Date.parse(`${iso}T12:00:00Z`))
}

/** The requested window on the UK clock: first day's midnight to the midnight after the last. */
export function windowOf(range: DateRange): Interval {
  return [dayStart(range.start), dayStart(shiftIso(range.end, 1))]
}

export function scaleX(width: number, domain: Interval) {
  const PL = plOf(width)
  const pw = Math.max(1, width - PL - prOf(width))
  const span = Math.max(1, domain[1] - domain[0])
  const x = (t: number) => PL + ((t - domain[0]) / span) * pw
  const t = (px: number) => domain[0] + ((px - PL) / pw) * span
  return { x, t, pw }
}

export function scaleY(domain: [number, number], top: number, bottom: number) {
  const span = domain[1] - domain[0] || 1
  return (v: number) => bottom - ((v - domain[0]) / span) * (bottom - top)
}

/** Each half-hourly row covers [t, t + 30 min). Merge them into present stretches. */
export function presentIntervals(ts: number[]): Interval[] {
  const out: Interval[] = []
  for (const t of [...ts].sort((a, b) => a - b)) {
    const last = out.at(-1)
    if (last && t <= last[1] + 1000) last[1] = Math.max(last[1], t + HALF_HOUR)
    else out.push([t, t + HALF_HOUR])
  }
  return out
}

/** Settlement dates to merged day intervals on the UK clock. */
export function dayIntervals(dates: string[]): Interval[] {
  const out: Interval[] = []
  for (const d of [...dates].sort()) {
    const a = dayStart(d)
    const b = dayStart(shiftIso(d, 1))
    const last = out.at(-1)
    if (last && a <= last[1]) last[1] = b
    else out.push([a, b])
  }
  return out
}

/** The parts of `domain` not covered by `present`. */
export function complement(domain: Interval, present: Interval[]): Interval[] {
  const out: Interval[] = []
  let cursor = domain[0]
  for (const [a, b] of present) {
    if (b <= domain[0] || a >= domain[1]) continue
    if (a > cursor) out.push([cursor, Math.min(a, domain[1])])
    cursor = Math.max(cursor, b)
  }
  if (cursor < domain[1]) out.push([cursor, domain[1]])
  return out.filter(([a, b]) => b - a >= HALF_HOUR / 2)
}

/** Splits sorted rows into contiguous half-hour runs, so no line or area bridges a gap. */
export function runsOf<T extends { t: number }>(rows: T[]): T[][] {
  const out: T[][] = []
  for (const r of rows) {
    const run = out.at(-1)
    const prev = run?.at(-1)
    if (run && prev && r.t - prev.t <= HALF_HOUR * 1.5) run.push(r)
    else out.push([r])
  }
  return out
}

/** The row whose half-hour contains `t`, by bisection on sorted rows. */
export function rowAt<T extends { t: number }>(rows: T[], t: number): T | undefined {
  let lo = 0
  let hi = rows.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const r = rows[mid]
    if (t < r.t) hi = mid - 1
    else if (t >= r.t + HALF_HOUR) lo = mid + 1
    else return r
  }
  return undefined
}

const isMidnight = (t: number) => londonMidnight(t) === t

function dayMonth(ms: number): string {
  return dayLabel(ms).split(' ').slice(1).join(' ')
}

/** Plain words for a void, e.g. `no rows, 7 to 9 Sep` or `no rows from 20:00`. */
export function voidWords(v: Interval, domain: Interval): string {
  const [a, b] = v
  if (isMidnight(a) && isMidnight(b)) {
    const days = Math.round((b - a) / DAY)
    if (days <= 1) return `no rows on ${dayLabel(a)}`
    const first = dayMonth(a).split(' ')
    const last = dayMonth(b - HALF_HOUR).split(' ')
    return first[1] === last[1] ? `no rows, ${first[0]} to ${last[0]} ${last[1]}` : `no rows, ${dayMonth(a)} to ${dayMonth(b - HALF_HOUR)}`
  }
  const sameDay = londonMidnight(a) === londonMidnight(b - 1)
  if (b >= domain[1] && a > domain[0]) return sameDay ? `no rows from ${clock(a)}` : `no rows from ${dayMonth(a)} ${clock(a)}`
  if (a <= domain[0]) return sameDay ? `no rows before ${clock(b)}` : `no rows before ${dayMonth(b)} ${clock(b)}`
  return sameDay ? `no rows, ${clock(a)} to ${clock(b)}` : `no rows, ${dayMonth(a)} ${clock(a)} to ${dayMonth(b)} ${clock(b)}`
}

/** Deterministic wavy boundary, sampled every 12px. */
export function wave(width: number, base: number, seed: number, amp = 3) {
  const pts: [number, number][] = []
  for (let x = -12; x <= width + 12; x += 12) {
    const y = base + amp * Math.sin(x / 167 + seed) + amp * 0.45 * Math.sin(x / 53 + seed * 2.3)
    pts.push([x, Math.round(y * 10) / 10])
  }
  const yAt = (x: number) => base + amp * Math.sin(x / 167 + seed) + amp * 0.45 * Math.sin(x / 53 + seed * 2.3)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
  return { pts, d, yAt }
}

/** Width of the element, tracked with a ResizeObserver. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver((entries) => setWidth(Math.round(entries[0].contentRect.width)))
    ro.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export interface CoverageState {
  coverage: Coverage | null
  failed: boolean
}

/** Read-only coverage for the window; skips while the range is unknown and reports failure. */
export function useCoverageG(datasetId: string, range: DateRange | null): CoverageState {
  const [state, setState] = useState<CoverageState>({ coverage: null, failed: false })
  const start = range?.start
  const end = range?.end
  useEffect(() => {
    if (!start || !end) return undefined
    const ctrl = new AbortController()
    setState({ coverage: null, failed: false })
    fetchJson<Coverage>(`/api/datasets/${datasetId}/coverage?start=${start}&end=${end}`, ctrl.signal)
      .then((c) => setState({ coverage: c, failed: false }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setState({ coverage: null, failed: true })
      })
    return () => ctrl.abort()
  }, [datasetId, start, end])
  return state
}

/** Clamp label positions so none overlap: `gap` px apart inside [lo, hi]. */
export function spread(targets: number[], gap: number, lo: number, hi: number): number[] {
  const order = targets.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  const ys = order.map((o) => Math.max(lo, Math.min(hi, o.y)))
  for (let k = 1; k < ys.length; k++) ys[k] = Math.max(ys[k], ys[k - 1] + gap)
  if (ys.length && ys[ys.length - 1] > hi) {
    ys[ys.length - 1] = hi
    for (let k = ys.length - 2; k >= 0; k--) ys[k] = Math.min(ys[k], ys[k + 1] - gap)
  }
  const out = new Array<number>(targets.length)
  order.forEach((o, k) => (out[o.i] = ys[k]))
  return out
}
