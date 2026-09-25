/**
 * UK clock-time formatting for chart axes and tooltips.
 *
 * Records carry UTC instants; GB market time is read on the Europe/London
 * clock. This module only *displays* instants in that zone. Settlement-period
 * numbers are not derived here -- gridflow owns those semantics
 * (`gridflow/utils/time.py`); they are shown only where the backend supplies
 * them (forecast rows).
 */

const TZ = 'Europe/London'

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const zoneFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, timeZoneName: 'short' })
const weekdayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short' })
const monthFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: 'short' })

const HALF_HOUR = 30 * 60 * 1000

interface LondonParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

function londonParts(ms: number): LondonParts {
  const out: Record<string, number> = {}
  for (const p of partsFmt.formatToParts(ms)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  return { year: out.year, month: out.month, day: out.day, hour: out.hour, minute: out.minute }
}

/** `BST` or `GMT` for the instant (en-GB renders BST as `BST`, GMT as `GMT`). */
export function zoneAbbrev(ms: number): string {
  const name = zoneFmt.formatToParts(ms).find((p) => p.type === 'timeZoneName')?.value ?? ''
  return name === 'GMT+1' ? 'BST' : name
}

/** London UTC offset in ms at an instant. */
function offsetMs(ms: number): number {
  const p = londonParts(ms)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60000) * 60000
}

/**
 * The UTC instant of London midnight starting the London day that contains
 * `ms`. Europe/London changes clocks at 01:00 UTC, so the offset in force at
 * 00:00 UTC of a date is the offset at that date's local midnight.
 */
export function londonMidnight(ms: number): number {
  const p = londonParts(ms)
  const utcMidnight = Date.UTC(p.year, p.month - 1, p.day)
  return utcMidnight - offsetMs(utcMidnight)
}

/** London midnight of the next London day (handles 23h/25h days). */
function nextLondonMidnight(midnight: number): number {
  return londonMidnight(midnight + 26 * 3600 * 1000)
}

const pad = (n: number) => String(n).padStart(2, '0')

export function clock(ms: number): string {
  const p = londonParts(ms)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** `Tue 15` -- compact day tick. */
export function dayTick(ms: number): string {
  return `${weekdayFmt.format(ms)} ${londonParts(ms).day}`
}

/** `Tue 15 Sep` */
export function dayLabel(ms: number): string {
  return `${weekdayFmt.format(ms)} ${londonParts(ms).day} ${monthFmt.format(ms)}`
}

/** `Tue 15 Sep, 14:30–15:00 BST` -- the half-hour window a record covers. */
export function halfHourWindow(ms: number): string {
  return `${dayLabel(ms)}, ${clock(ms)}–${clock(ms + HALF_HOUR)} ${zoneAbbrev(ms)}`
}

/** Axis caption naming the clock, e.g. `UK time (BST)` or `UK time (GMT/BST)`. */
export function axisClockCaption(startMs: number, endMs: number): string {
  const a = zoneAbbrev(startMs)
  const b = zoneAbbrev(endMs)
  return a === b ? `UK time (${a})` : `UK time (${a}/${b})`
}

export interface TimeTicks {
  ticks: number[]
  format: (ms: number) => string
  /** London midnights inside the domain -- day boundaries for grids. */
  midnights: number[]
}

/**
 * Tick positions on the UK clock. Multi-day windows tick at London
 * midnight (one tick per day, thinned for long ranges); a window of a day
 * or less ticks every three hours of local clock time.
 */
export function ukTimeTicks(startMs: number, endMs: number): TimeTicks {
  const midnights: number[] = []
  for (let m = londonMidnight(startMs); m <= endMs; m = nextLondonMidnight(m)) {
    if (m >= startMs) midnights.push(m)
  }
  const spanDays = (endMs - startMs) / (24 * 3600 * 1000)
  if (spanDays <= 1.5) {
    const ticks: number[] = []
    const first = londonMidnight(startMs)
    for (let t = first; t <= endMs; t += HALF_HOUR) {
      const p = londonParts(t)
      if (t >= startMs && p.minute === 0 && p.hour % 3 === 0) ticks.push(t)
    }
    return { ticks, format: clock, midnights }
  }
  const step = spanDays > 45 ? 7 : spanDays > 16 ? 3 : 1
  return { ticks: midnights.filter((_, i) => i % step === 0), format: dayTick, midnights }
}

export function toMs(iso: string): number {
  return Date.parse(iso)
}

export { HALF_HOUR }
