/**
 * What the panels say of the rows in plain words: each border's step as
 * held, the days on which a border misses some of its steps, and the values
 * the chart can't draw. Worked out from the rows every time, never written
 * in advance, so they stay true of whatever window is open. Adapted from the
 * flows page's `words.ts`.
 */
import { listText, plural } from '../../../design/format'
import { cadenceText, dayLabel, londonMidnight, stepNoun } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { DisplayUnit } from '../../_template/units'
import { daysOf, isPartial, type Point } from './figures'
import type { Line } from './model'

interface Named {
  name: string
  line: Line | null
}

/** `As held, GB–France and GB–Ireland (SEM) come hourly; France–Germany/Luxembourg every 15 minutes.` */
export function cadenceSentence(items: Named[]): string {
  const bySteps = new Map<number, string[]>()
  for (const { name, line } of items) {
    if (!line?.step) continue
    bySteps.set(line.step, [...(bySteps.get(line.step) ?? []), name])
  }
  if (!bySteps.size) return ''
  const parts = [...bySteps.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([step, names], i) => `${listText(names)}${i === 0 ? (names.length > 1 ? ' come ' : ' comes ') : ' '}${cadenceText(step).toLowerCase()}`)
  return `As held, ${parts.join('; ')}.`
}

/** `Tue 15 Sep, Fri 18 Sep and 2 more days`: at most four days named. */
function daysText(starts: number[]): string {
  const named = starts.slice(0, 4).map(dayLabel)
  return starts.length > 4 ? `${named.join(', ')} and ${plural(starts.length - 4, 'more day', 'more days')}` : listText(named)
}

/**
 * `Some hours are missing: on every border on Tue 22 Sep; on GB–Belgium on
 * Sun 2 Aug and Mon 3 Aug.` Each border with the days it misses steps on,
 * days all share said once. Only days some border holds a value on: a day
 * none holds is the template's "N of M days hold rows".
 */
function missingText(byName: Map<string, Set<number>>, heldDays: Set<number>): string {
  const names = [...byName.keys()]
  const missing = new Map([...byName.entries()].map(([n, days]) => [n, [...days].filter((d) => heldDays.has(d)).sort((a, b) => a - b)]))
  const shared = names.length > 1 ? (missing.get(names[0]) ?? []).filter((d) => names.every((n) => missing.get(n)?.includes(d))) : []
  const parts: string[] = []
  if (shared.length) parts.push(`on every border on ${daysText(shared)}`)
  // Borders missing steps on the same days are said together.
  const groups = new Map<string, { names: string[]; days: number[] }>()
  for (const n of names) {
    const own = (missing.get(n) ?? []).filter((d) => !shared.includes(d))
    if (!own.length) continue
    const g = groups.get(own.join()) ?? { names: [], days: own }
    g.names.push(n)
    groups.set(own.join(), g)
  }
  for (const g of groups.values()) parts.push(`on ${listText(g.names)} on ${daysText(g.days)}`)
  return parts.length ? `Some steps are missing: ${parts.join('; ')}.` : ''
}

/**
 * `GB–France holds only 1 value in this window, on Mon 21 Sep, too few to
 * read its step.`: a line whose steps can't be counted, so its missing
 * steps can't be named either. Empty when the step is known or nothing is held.
 */
function unreadSentence(name: string, points: Point[], step: number | null): string {
  if (step !== null) return ''
  const held = points.filter((p) => p.v !== null)
  if (!held.length) return ''
  const days = [...new Set(held.map((p) => londonMidnight(p.t)))].sort((a, b) => a - b)
  return `${name} holds only ${plural(held.length, 'value', 'values')} in this window, on ${daysText(days)}, too few to read its step.`
}

/** The borders' days that miss some of their own steps, and the borders whose steps can't be read. */
export function missingSentence(items: Named[], window: DateRange): string {
  const byName = new Map<string, Set<number>>()
  const heldDays = new Set<number>()
  for (const { name, line } of items) {
    if (!line) continue
    const days = new Set<number>()
    for (const d of daysOf(line.points, line.step, window)) {
      if (d.held > 0) heldDays.add(d.start)
      if (isPartial(d) || (d.held === 0 && d.expected !== null)) days.add(d.start)
    }
    byName.set(name, days)
  }
  const unread = items.map(({ name, line }) => (line ? unreadSentence(name, line.points, line.step) : ''))
  return [missingText(byName, heldDays), ...unread].filter(Boolean).join(' ')
}

/**
 * `Some values have nothing held a step before or after them on their own
 * line in this window, so the chart draws nothing for them: 3 on GB–Belgium.`
 * Empty when every value held is on a line.
 */
export function aloneSentence(items: { name: string; alone: number }[]): string {
  const parts = items.filter((x) => x.alone > 0).map((x) => `${x.alone.toLocaleString('en-GB')} on ${x.name}`)
  return parts.length
    ? `Some values have nothing held a step before or after them on their own line in this window, so the chart draws nothing for them: ${listText(parts)}. The Table view lists them.`
    : ''
}

/** `hours` or `quarter-hours`: what a line's steps are called; `hour` when there is `n` = 1 of them. */
export function stepWords(step: number | null, n?: number): string {
  const many = step === null ? 'values' : stepNoun(step)
  return n === 1 ? many.replace(/s$/, '') : many
}

/**
 * A figure as the unit prints it, except one that isn't zero but would print
 * as zero: `under 1 MW` (`under 1` in a table cell), so a small mean never
 * reads as an exact zero.
 */
export function figureText(unit: Pick<DisplayUnit, 'format' | 'plain'>, v: number, cell = false): string {
  const print = cell ? unit.plain : unit.format
  if (v === 0 || unit.plain(Math.abs(v)) !== unit.plain(0)) return print(v)
  return v > 0 ? `under ${print(1)}` : `between ${print(-1)} and ${cell ? print(0) : 'zero'}`
}

export const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`
