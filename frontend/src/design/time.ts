/**
 * UK clock-time helpers for chart axes, tooltips, stamps and ranges.
 *
 * Records carry UTC instants; GB market time is read on the Europe/London
 * clock. This module only *displays* instants in that zone and converts UK
 * calendar days to their instants. Settlement-period numbers are not derived
 * here: gridflow owns those semantics (`gridflow/utils/time.py`), so they are
 * shown only where the backend supplies them.
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

// Fixed English abbreviations: newer ICU data spells September "Sept" in en-GB,
// and the design writes `Tue 15 Sep`.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const HALF_HOUR = 30 * 60 * 1000
const DAY = 24 * 3600 * 1000

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

/** `BST` or `GMT` for the instant (some runtimes render them `GMT+1` and `GMT+0`). */
export function zoneAbbrev(ms: number): string {
  const name = zoneFmt.formatToParts(ms).find((p) => p.type === 'timeZoneName')?.value ?? ''
  if (name === 'GMT+1') return 'BST'
  return name === 'GMT+0' ? 'GMT' : name
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

/** London midnight of the next London day (handles 23 h and 25 h days). */
export function nextLondonMidnight(midnight: number): number {
  return londonMidnight(midnight + 26 * 3600 * 1000)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `YYYY-MM-DD` of the UK calendar day containing `ms`. */
export function ukDate(ms: number): string {
  const p = londonParts(ms)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** Today's UK calendar date. */
export function todayUk(): string {
  return ukDate(Date.now())
}

/** The instant a UK calendar day (`YYYY-MM-DD`) starts. */
export function dayStart(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  // Noon UTC always falls inside the London day of the same date.
  return londonMidnight(Date.UTC(y, m - 1, d, 12))
}

/** Shift a `YYYY-MM-DD` date by whole days. */
export function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

/** Every `YYYY-MM-DD` from `start` to `end`, inclusive. */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = []
  for (let d = start; d <= end && out.length < 1000; d = shiftDate(d, 1)) out.push(d)
  return out
}

/** Half-hours in the UK day starting at `midnight`: 48, or 46 and 50 on clock-change days. */
export function halfHoursInDay(midnight: number): number {
  return Math.round((nextLondonMidnight(midnight) - midnight) / HALF_HOUR)
}

export function clock(ms: number): string {
  const p = londonParts(ms)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** `Tue 15`, the compact day tick. */
export function dayTick(ms: number): string {
  return `${weekdayFmt.format(ms)} ${londonParts(ms).day}`
}

/** `Tue 15 Sep` */
export function dayLabel(ms: number): string {
  const p = londonParts(ms)
  return `${weekdayFmt.format(ms)} ${p.day} ${MONTHS[p.month - 1]}`
}

/** `Wed 16 Sep` for a `YYYY-MM-DD` UK date. */
export function fmtDay(isoDate: string): string {
  return dayLabel(dayStart(isoDate))
}

/** `10 Sep – 16 Sep 2026`, or `16 Sep 2026` for a single day. */
export function rangeText(start: string, end: string): string {
  const part = (iso: string) => {
    const [, m, d] = iso.split('-').map(Number)
    return `${d} ${MONTHS[m - 1]}`
  }
  const year = end.slice(0, 4)
  if (start === end) return `${part(end)} ${year}`
  const startYear = start.slice(0, 4) === year ? '' : ` ${start.slice(0, 4)}`
  return `${part(start)}${startYear} – ${part(end)} ${year}`
}

/** `Tue 15 Sep, 14:30–15:00 BST`: the half-hour window a record covers. */
export function halfHourWindow(ms: number): string {
  return `${dayLabel(ms)}, ${clock(ms)}–${clock(ms + HALF_HOUR)} ${zoneAbbrev(ms)}`
}

export const MINUTE_MS = 60 * 1000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = DAY

/** `14:35:15`: seconds are the same on every clock, London's offset being whole hours. */
function clockSeconds(ms: number): string {
  return `${clock(ms)}:${pad(Math.floor(ms / 1000) % 60)}`
}

/** `Tue 15 Sep, 14:37 BST`: one instant on the UK clock (`seconds` for sub-minute readings). */
export function instantLabel(ms: number, { seconds = false }: { seconds?: boolean } = {}): string {
  return `${dayLabel(ms)}, ${seconds ? clockSeconds(ms) : clock(ms)} ${zoneAbbrev(ms)}`
}

/**
 * The period a row covers, named from its step, for tooltips and tables:
 * - under a minute: the instant with seconds (`Tue 15 Sep, 14:35:15 BST`);
 * - under a day: the window (`Tue 15 Sep, 14:30–15:00 BST`), with both days
 *   named when it crosses a midnight;
 * - a day: the UK day (`Tue 15 Sep`); a week: `Week from Tue 15 Sep`;
 * - no step (irregular, events): the instant.
 * A daily row on a DATE clock arrives at UTC midnight, which is inside the
 * same UK day, so the day label is right for both kinds of daily clock.
 */
export function periodLabel(ms: number, stepMs: number | null): string {
  if (stepMs === null || stepMs <= 0) return instantLabel(ms)
  if (stepMs < MINUTE_MS) return instantLabel(ms, { seconds: true })
  if (stepMs >= 7 * DAY) return `Week from ${dayLabel(ms)}`
  if (stepMs >= DAY) return dayLabel(ms)
  const end = ms + stepMs
  const sameDay = ukDate(end) === ukDate(ms) || end === nextLondonMidnight(londonMidnight(ms))
  if (sameDay) return `${dayLabel(ms)}, ${clock(ms)}–${clock(end)} ${zoneAbbrev(ms)}`
  return `${dayLabel(ms)}, ${clock(ms)} to ${dayLabel(end)}, ${clock(end)} ${zoneAbbrev(end)}`
}

/** What one step of a clock is called, plural: `half-hours`, `hours`, `15-second readings`. */
export function stepNoun(stepMs: number | null): string {
  if (stepMs === HALF_HOUR) return 'half-hours'
  if (stepMs === 15 * MINUTE_MS) return 'quarter-hours'
  if (stepMs === HOUR_MS) return 'hours'
  if (stepMs === DAY) return 'days'
  if (stepMs !== null && stepMs < MINUTE_MS) return `${Math.round(stepMs / 1000)}-second readings`
  if (stepMs !== null && stepMs < HOUR_MS) return `${Math.round(stepMs / MINUTE_MS)}-minute readings`
  if (stepMs !== null && stepMs < DAY) return `${Math.round(stepMs / HOUR_MS)}-hour periods`
  return 'readings'
}

/** How often a clock ticks, in words: `Half-hourly`, `Every 15 seconds`, `Daily`. */
export function cadenceText(stepMs: number): string {
  if (stepMs === HALF_HOUR) return 'Half-hourly'
  if (stepMs === HOUR_MS) return 'Hourly'
  if (stepMs === DAY) return 'Daily'
  if (stepMs === 7 * DAY) return 'Weekly'
  if (stepMs < MINUTE_MS) return `Every ${Math.round(stepMs / 1000)} seconds`
  if (stepMs < HOUR_MS) return `Every ${Math.round(stepMs / MINUTE_MS)} minutes`
  if (stepMs < DAY) return `Every ${Math.round(stepMs / HOUR_MS)} hours`
  return `Every ${Math.round(stepMs / DAY)} days`
}

/**
 * Steps a UK day holds on a regular clock (48 half-hours, or 46 and 50 on
 * clock-change days; 1 for a daily clock); null when the step doesn't divide
 * a day, is longer than one, or is unknown.
 */
export function stepsInDay(midnight: number, stepMs: number | null): number | null {
  if (stepMs === null || stepMs <= 0) return null
  if (stepMs === DAY) return 1
  if (stepMs > DAY || HOUR_MS % stepMs !== 0) return null
  return Math.round((nextLondonMidnight(midnight) - midnight) / stepMs)
}

/** Axis caption naming the clock, e.g. `UK time (BST)` or `UK time (GMT/BST)`. */
export function axisClockCaption(startMs: number, endMs: number): string {
  const a = zoneAbbrev(startMs)
  const b = zoneAbbrev(Math.max(startMs, endMs - 1))
  return a === b ? `UK time (${a})` : `UK time (${a}/${b})`
}

/** The instants a range of UK days covers: its first midnight to the midnight after its last day. */
export function windowDomain(start: string, end: string): [number, number] {
  return [dayStart(start), nextLondonMidnight(dayStart(end))]
}

export interface TimeTicks {
  ticks: number[]
  format: (ms: number) => string
  /** London midnights inside the domain: day boundaries for the day rules. */
  midnights: number[]
}

/**
 * Tick positions on the UK clock for the domain `[startMs, endMs)`. Multi-day
 * windows tick at London midnight (one tick per day, thinned for long
 * ranges); a window of a day or so ticks every three hours of local time.
 * The domain's closing instant gets no tick: it starts a day the window
 * doesn't hold.
 */
export function ukTimeTicks(startMs: number, endMs: number): TimeTicks {
  const midnights: number[] = []
  for (let m = londonMidnight(startMs); m < endMs; m = nextLondonMidnight(m)) {
    if (m >= startMs) midnights.push(m)
  }
  const spanDays = (endMs - startMs) / DAY
  if (spanDays <= 1.5) {
    const ticks: number[] = []
    for (let t = londonMidnight(startMs); t < endMs; t += HALF_HOUR) {
      const p = londonParts(t)
      if (t >= startMs && p.minute === 0 && p.hour % 3 === 0) ticks.push(t)
    }
    return { ticks, format: clock, midnights }
  }
  const step = spanDays > 120 ? 14 : spanDays > 45 ? 7 : spanDays > 16 ? 3 : 1
  const ticks = midnights.filter((_, i) => i % step === 0)
  // Past six weeks a rule per day is a wash of lines, so rules follow the ticks.
  if (spanDays > 45) return { ticks, format: monthDayTick, midnights: ticks }
  return { ticks, format: dayTick, midnights }
}

/** `15 Sep`, the tick for windows long enough to cross months. */
function monthDayTick(ms: number): string {
  const p = londonParts(ms)
  return `${p.day} ${MONTHS[p.month - 1]}`
}

export function toMs(iso: string): number {
  return Date.parse(iso)
}
