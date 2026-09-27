/**
 * What the panels say of the rows in plain words: each border's step as
 * held, and the days on which a border misses some of its steps. Worked out
 * from the rows every time, never written in advance, so they stay true of
 * whatever window is open.
 */
import { listText, plural } from '../../../design/format'
import { cadenceText, dayLabel, stepNoun } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import { daysOf, isPartial, sideDays } from './figures'
import type { Line } from './model'

interface Named {
  name: string
  line: Line | null
}

/** `As held, GB–France and GB–Ireland (SEM) come hourly; GB–Netherlands and GB–Belgium every 15 minutes.` */
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

/**
 * `Steps missing: Mon 21 Sep on every border; Sun 20 Sep on GB–Ireland (SEM).`
 * Only days some line holds a value on: a day none holds is the template's
 * "N of M days hold rows".
 */
export function missingSentence(items: Named[], window: DateRange, every = 'every border'): string {
  const byDay = new Map<number, string[]>()
  const heldDays = new Set<number>()
  const counted = items.filter((x) => x.line)
  for (const { name, line } of counted) {
    if (!line) continue
    for (const d of daysOf(line.points, line.step, window)) {
      if (d.held > 0) heldDays.add(d.start)
      if (isPartial(d) || (d.held === 0 && d.expected !== null)) byDay.set(d.start, [...(byDay.get(d.start) ?? []), name])
    }
  }
  const days = [...byDay.entries()].filter(([start]) => heldDays.has(start)).sort((a, b) => a[0] - b[0])
  if (!days.length) return ''
  const shown = days.slice(0, 3).map(([start, names]) => `${dayLabel(start)} on ${names.length === counted.length && counted.length > 1 ? every : listText(names)}`)
  const more = days.length > 3 ? `, and ${plural(days.length - 3, 'more day', 'more days')}` : ''
  return `Steps missing: ${shown.join('; ')}${more}.`
}

/**
 * The zones' days with quarter-hours held on neither side, as for borders:
 * `Steps missing: Thu 17 Sep on every zone.` Days no zone holds are left to
 * the template.
 */
export function zoneMissingSentence(zones: { name: string; inSide: Line | null; outSide: Line | null }[], window: DateRange): string {
  const byDay = new Map<number, string[]>()
  const heldDays = new Set<number>()
  for (const z of zones) {
    const step = z.inSide?.step ?? z.outSide?.step ?? null
    for (const d of sideDays(z.inSide?.points ?? [], z.outSide?.points ?? [], step, window)) {
      if (d.held > 0) heldDays.add(d.start)
      if (d.expected !== null && d.held < d.expected) byDay.set(d.start, [...(byDay.get(d.start) ?? []), z.name])
    }
  }
  const days = [...byDay.entries()].filter(([start]) => heldDays.has(start)).sort((a, b) => a[0] - b[0])
  if (!days.length) return ''
  const shown = days.slice(0, 3).map(([start, names]) => `${dayLabel(start)} on ${names.length === zones.length && zones.length > 1 ? 'every zone' : listText(names)}`)
  const more = days.length > 3 ? `, and ${plural(days.length - 3, 'more day', 'more days')}` : ''
  return `Steps missing: ${shown.join('; ')}${more}.`
}

/** `hours` or `quarter-hours`: what a line's steps are called. */
export const stepWords = (step: number | null) => (step === null ? 'values' : stepNoun(step))
