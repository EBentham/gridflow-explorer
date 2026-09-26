/**
 * Slot h: every number an annotation or summary states is computed here from
 * the loaded rows. Nothing is invented; when a pattern is absent (no negative
 * prices, an actual that never leaves its band) the text says so plainly.
 */
import { FUEL_BANDS, totalGeneration, type MixRow } from '../../../design/fuels'
import type { PriceRow } from '../../../design/charts'
import { HALF_HOUR, clock, dayLabel, londonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'

// ---------------------------------------------------------------- formatting

const MINUS = '−'
const num = (v: number, digits: number) =>
  Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })
/** A true minus sign, and none on values that round to zero. */
function signed(v: number, digits: number): string {
  const s = num(v, digits)
  return v < 0 && /[1-9]/.test(s) ? `${MINUS}${s}` : s
}

export const gw = (v: number) => `${signed(v, 1)} GW`
export const mw = (v: number) => `${signed(v, 0)} MW`
export const mwh = (v: number) => `${signed(v, 0)} MWh`
export const price = (v: number) => `${signed(v, 2)} £/MWh`
export const pct = (share: number) => `${Math.round(share * 100)}%`
export const plain = (v: number, digits = 0) => signed(v, digits)

function utcDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`)
}
const monthLong = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
const monthShort = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })

function span(r: DateRange, month: (d: Date) => string): string {
  const a = utcDate(r.start)
  const b = utcDate(r.end)
  const da = a.getUTCDate()
  const db = b.getUTCDate()
  if (r.start === r.end) return `${db} ${month(b)} ${b.getUTCFullYear()}`
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${da} ${month(a)} ${a.getUTCFullYear()} to ${db} ${month(b)} ${b.getUTCFullYear()}`
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${da} ${month(a)} to ${db} ${month(b)} ${b.getUTCFullYear()}`
  return `${da} to ${db} ${month(b)} ${b.getUTCFullYear()}`
}

/** `10 to 16 September 2026`, the heading form. */
export const windowTitle = (r: DateRange) => span(r, monthLong)
/** `10 to 16 Sep 2026`, the caption form. */
export const windowShort = (r: DateRange) => span(r, monthShort)
/** `16 September 2026` for one ISO date. */
export const dateLong = (isoDate: string) => span({ start: isoDate, end: isoDate }, monthLong)

/** Instants inside one London day read as a clock time; otherwise day + clock. */
export interface Clocker {
  /** `Sat 13 Sep, 14:00` or `14:00`. */
  short: (t: number) => string
  /** `on Sat 13 Sep at 14:00` or `at 14:00`. */
  onAt: (t: number) => string
  /** A half-hour run `Sat 12 Sep, 09:00 to 16:30` (end = last start + 30 min). */
  run: (a: number, lastStart: number) => string
}

export function clocker(oneDay: boolean): Clocker {
  return {
    short: (t) => (oneDay ? clock(t) : `${dayLabel(t)}, ${clock(t)}`),
    onAt: (t) => (oneDay ? `at ${clock(t)}` : `on ${dayLabel(t)} at ${clock(t)}`),
    run: (a, last) => {
      const b = last + HALF_HOUR
      const sameDay = londonMidnight(a) === londonMidnight(b - 1)
      if (oneDay) return `${clock(a)} to ${clock(b)}`
      return sameDay ? `${dayLabel(a)}, ${clock(a)} to ${clock(b)}` : `${dayLabel(a)} ${clock(a)} to ${dayLabel(b)} ${clock(b)}`
    },
  }
}

const hoursText = (halfHours: number) =>
  halfHours === 1 ? '30 minutes' : halfHours % 2 === 0 ? `${halfHours / 2} ${halfHours === 2 ? 'hour' : 'hours'}` : `${(halfHours / 2).toFixed(1)} hours`
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
/** Small counts as words, as the site writes them ("three consecutive points"). */
export const count = (n: number) => (n < WORDS.length ? WORDS[n] : n.toLocaleString('en-GB'))
const halfHourCount = (n: number) => `${n.toLocaleString('en-GB')} ${n === 1 ? 'half-hour' : 'half-hours'}`

// ---------------------------------------------------------------- primitives

export interface Point {
  t: number
  v: number
}

export interface Extremes {
  min: Point
  max: Point
  mean: number
  n: number
}

export function extremes<T extends { t: number }>(rows: T[], get: (r: T) => number | null | undefined): Extremes | null {
  let min: Point | null = null
  let max: Point | null = null
  let sum = 0
  let n = 0
  for (const r of rows) {
    const v = get(r)
    if (v === null || v === undefined || !Number.isFinite(v)) continue
    if (!min || v < min.v) min = { t: r.t, v }
    if (!max || v > max.v) max = { t: r.t, v }
    sum += v
    n++
  }
  return min && max ? { min, max, mean: sum / n, n } : null
}

export interface Run {
  start: number
  /** Start instant of the last half-hour in the run. */
  last: number
  n: number
}

/** Consecutive half-hours (no gap in the rows) where `test` holds. */
export function runs<T extends { t: number }>(rows: T[], test: (r: T) => boolean): Run[] {
  const out: Run[] = []
  let cur: Run | null = null
  let prevT = -Infinity
  for (const r of rows) {
    const contiguous = r.t - prevT === HALF_HOUR
    if (test(r)) {
      if (cur && contiguous) {
        cur.last = r.t
        cur.n++
      } else {
        cur = { start: r.t, last: r.t, n: 1 }
        out.push(cur)
      }
    } else cur = null
    prevT = r.t
  }
  return out
}

/** The contiguous `size`-half-hour window with the highest mean of `get`. */
export function bestWindow<T extends { t: number }>(rows: T[], get: (r: T) => number | null, size: number): (Run & { mean: number }) | null {
  let best: (Run & { mean: number }) | null = null
  for (let i = 0; i + size <= rows.length; i++) {
    const slice = rows.slice(i, i + size)
    if (slice.at(-1)!.t - slice[0].t !== (size - 1) * HALF_HOUR) continue
    const vals = slice.map(get)
    if (vals.some((v) => v === null)) continue
    const mean = (vals as number[]).reduce((a, b) => a + b, 0) / size
    if (!best || mean > best.mean) best = { start: slice[0].t, last: slice.at(-1)!.t, n: size, mean }
  }
  return best
}

/** Inserts an all-null row after any break longer than a half-hour so lines and areas break. */
export function withGaps<T extends { t: number }>(rows: T[], blank: (t: number) => T): T[] {
  const out: T[] = []
  rows.forEach((r, i) => {
    if (i > 0 && r.t - rows[i - 1].t > HALF_HOUR * 1.5) out.push(blank(rows[i - 1].t + HALF_HOUR))
    out.push(r)
  })
  return out
}

// ---------------------------------------------------------------- generation

export const bandLabel = (key: string) => FUEL_BANDS.find((b) => b.key === key)?.label ?? key
const positive = (r: MixRow, key: string) => Math.max(r[key] ?? 0, 0)
export const shareOf = (r: MixRow, key: string) => {
  const total = totalGeneration(r)
  return total > 0 ? positive(r, key) / total : null
}

/** Top edge of a band inside the positive stack (stack order is FUEL_BANDS order). */
export function stackTop(r: MixRow, key: string): number {
  let sum = 0
  for (const b of FUEL_BANDS) {
    sum += positive(r, b.key)
    if (b.key === key) break
  }
  return sum
}

export interface MixStory {
  sentences: string[]
  fuel: string
  fuelLabel: string
  fuelExt: Extremes | null
  /** Three hours with the highest share of the fuel. */
  window: (Run & { mean: number }) | null
  n: number
}

export function mixStory(rows: MixRow[], oneDay: boolean, focus?: string): MixStory | null {
  const total = extremes(rows, totalGeneration)
  if (!total) return null
  const c = clocker(oneDay)
  const fuel = focus ?? 'wind'
  const label = bandLabel(fuel)
  const fuelExt = extremes(rows, (r) => r[fuel])
  const share = extremes(rows, (r) => shareOf(r, fuel))
  const window = bestWindow(rows, (r) => shareOf(r, fuel), Math.min(6, rows.length))
  const flat = !fuelExt || fuelExt.max.v - fuelExt.min.v < 0.05
  const s: string[] = []
  if (!focus) {
    s.push(
      `Generation averaged ${gw(total.mean)} across ${halfHourCount(total.n)}, from ${gw(total.min.v)} ${c.onAt(total.min.t)} to ${gw(total.max.v)} ${c.onAt(total.max.t)}.`,
    )
    if (share && fuelExt) {
      s.push(`Wind supplied between ${pct(share.min.v)} and ${pct(share.max.v)} of it and peaked at ${gw(fuelExt.max.v)} ${c.onAt(fuelExt.max.t)}.`)
    }
    const gas = extremes(rows, (r) => r.gas)
    if (gas) s.push(`Gas (CCGT) averaged ${gw(gas.mean)}, ${pct(gas.mean / total.mean)} of the window's generation.`)
  } else if (fuelExt) {
    if (flat) s.push(`${label} stayed at ${gw(fuelExt.mean)} across ${halfHourCount(fuelExt.n)}.`)
    else
      s.push(
        `${label} averaged ${gw(fuelExt.mean)} across ${halfHourCount(fuelExt.n)}, from ${gw(fuelExt.min.v)} ${c.onAt(fuelExt.min.t)} to ${gw(fuelExt.max.v)} ${c.onAt(fuelExt.max.t)}.`,
      )
    if (share && share.max.v > 0) s.push(`Its share of generation ran from ${pct(share.min.v)} to ${pct(share.max.v)}, against a window average of ${pct(Math.max(fuelExt.mean, 0) / total.mean)}.`)
    const band = FUEL_BANDS.find((b) => b.key === fuel)
    if (band?.signed && fuelExt.min.v < 0) {
      const below = rows.filter((r) => (r[fuel] ?? 0) < 0).length
      s.push(`It was below zero, ${fuel === 'imports' ? 'exporting' : 'pumping'}, in ${halfHourCount(below)}.`)
    }
  }
  return { sentences: s, fuel, fuelLabel: label, fuelExt: flat ? null : fuelExt, window: window && window.mean > 0 ? window : null, n: total.n }
}

export interface ShareItem {
  key: string
  label: string
  mean: number
  share: number
}

/** Mean GW per band over the window; shares are of the sum of positive means. */
export function windowShares(rows: MixRow[]): { items: ShareItem[]; total: number } {
  const means = FUEL_BANDS.map((b) => {
    const e = extremes(rows, (r) => r[b.key])
    return { key: b.key, label: b.label, mean: e ? e.mean : 0 }
  })
  const total = means.reduce((a, m) => a + Math.max(m.mean, 0), 0)
  return { items: means.map((m) => ({ ...m, share: total > 0 ? Math.max(m.mean, 0) / total : 0 })), total }
}

// ---------------------------------------------------------------- prices

export interface PriceStory {
  sentences: string[]
  price: Extremes | null
  niv: Extremes | null
  negative: Run[]
}

export function priceStory(rows: PriceRow[], oneDay: boolean): PriceStory {
  const c = clocker(oneDay)
  const p = extremes(rows, (r) => r.price)
  const niv = extremes(rows, (r) => r.niv)
  const negative = runs(rows, (r) => r.price !== null && r.price < 0)
  const s: string[] = []
  if (p) {
    s.push(`The system price averaged ${price(p.mean)} across ${halfHourCount(p.n)}, from ${price(p.min.v)} ${c.onAt(p.min.t)} to ${price(p.max.v)} ${c.onAt(p.max.t)}.`)
    const k = negative.reduce((a, r) => a + r.n, 0)
    if (k === 0) s.push('It stayed at or above zero throughout.')
    else {
      const longest = negative.reduce((a, r) => (r.n > a.n ? r : a))
      s.push(
        negative.length === 1
          ? `It was below zero for ${hoursText(k)}, ${c.run(longest.start, longest.last)}.`
          : `It was below zero in ${halfHourCount(k)} across ${count(negative.length)} runs; the longest lasted ${hoursText(longest.n)}, ${c.run(longest.start, longest.last)}.`,
      )
    }
  }
  if (niv) {
    const short = rows.filter((r) => r.niv !== null && r.niv > 0).length
    s.push(`The system was short in ${short} of ${halfHourCount(niv.n)}; net imbalance ran from ${mwh(Math.abs(niv.min.v))} ${niv.min.v < 0 ? 'long' : 'short'} to ${mwh(Math.abs(niv.max.v))} ${niv.max.v < 0 ? 'long' : 'short'}.`)
  }
  return { sentences: s, price: p, niv, negative }
}

// ---------------------------------------------------------------- wind fan

export interface FanPoint {
  t: number
  sp: number
  actual: number | null
  q05: number
  q10: number
  q50: number
  q90: number
  q95: number
}

export interface Excursion extends Run {
  side: 'above' | 'below'
  /** Largest distance outside the band, MW, and when. */
  worst: Point
}

export interface WindStory {
  sentences: string[]
  median: Extremes | null
  excursions: Excursion[]
  lastActual: Point | null
  settled: number
}

export function windStory(rows: FanPoint[]): WindStory {
  const c = clocker(true)
  const median = extremes(rows, (r) => r.q50)
  const settledRows = rows.filter((r) => r.actual !== null)
  const lastRow = settledRows.at(-1)
  const lastActual = lastRow ? { t: lastRow.t, v: lastRow.actual! } : null
  const excursions: Excursion[] = (['above', 'below'] as const).flatMap((side) =>
    runs(rows, (r) => r.actual !== null && (side === 'above' ? r.actual > r.q90 : r.actual < r.q10)).map((run) => {
      let worst: Point = { t: run.start, v: 0 }
      for (const r of rows) {
        if (r.t < run.start || r.t > run.last || r.actual === null) continue
        const d = side === 'above' ? r.actual - r.q90 : r.q10 - r.actual
        if (d > worst.v) worst = { t: r.t, v: d }
      }
      return { ...run, side, worst }
    }),
  )
  excursions.sort((a, b) => a.start - b.start)
  const s: string[] = []
  if (median) s.push(`The median forecast runs from ${mw(median.min.v)} ${c.onAt(median.min.t)} to ${mw(median.max.v)} ${c.onAt(median.max.t)}.`)
  const settled = settledRows.length
  if (lastActual) {
    const outside = excursions.reduce((a, e) => a + e.n, 0)
    const through = clock(lastActual.t + HALF_HOUR)
    if (outside === 0) s.push(`The settled actual, published to ${through}, stayed inside the 80% band for all ${settled} settled half-hours.`)
    else {
      const parts = excursions.map((e) => `${e.side} it ${c.run(e.start, e.last)}`)
      s.push(
        `The settled actual, published to ${through}, sat inside the 80% band for ${settled - outside} of ${settled} half-hours and ran ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}.`,
      )
    }
  }
  const pending = rows.length - settled
  if (pending > 0) s.push(`The last ${pending} settlement periods have no actual yet.`)
  return { sentences: s, median, excursions, lastActual, settled }
}
