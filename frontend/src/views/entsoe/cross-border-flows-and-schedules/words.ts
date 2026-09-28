/**
 * What the panels say of the rows in plain words: each border's step as
 * held, the days on which a border or zone misses some of its steps, and
 * how a zone's two sides share its quarter-hours. Worked out from the rows
 * every time, never written in advance, so they stay true of whatever window
 * is open.
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

interface Sided {
  name: string
  inSide: Line | null
  outSide: Line | null
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
 * `On GB–Netherlands and GB–Belgium the physical flow comes every 15 minutes
 * and the commercial schedule hourly.`: the borders whose two datasets keep
 * different steps, so a time one holds may be a time the other doesn't.
 */
export function stepsApartSentence(items: { name: string; own: Line | null; beside: Line | null }[], own: string, beside: string): string {
  const groups = new Map<string, { a: number; b: number; names: string[] }>()
  for (const x of items) {
    const a = x.own?.step
    const b = x.beside?.step
    if (!a || !b || a === b) continue
    const g = groups.get(`${a}|${b}`) ?? { a, b, names: [] }
    g.names.push(x.name)
    groups.set(`${a}|${b}`, g)
  }
  return [...groups.values()]
    .map((g) => `On ${listText(g.names)} the ${own} comes ${cadenceText(g.a).toLowerCase()} and the ${beside} ${cadenceText(g.b).toLowerCase()}.`)
    .join(' ')
}

/** `Tue 15 Sep, Fri 18 Sep and 2 more days`: at most four days named. */
function daysText(starts: number[]): string {
  const named = starts.slice(0, 4).map(dayLabel)
  return starts.length > 4 ? `${named.join(', ')} and ${plural(starts.length - 4, 'more day', 'more days')}` : listText(named)
}

/**
 * `Some steps are missing: on every border on Mon 21 Sep; on GB–Ireland (SEM)
 * on Tue 15 Sep, Fri 18 Sep and Sun 20 Sep.` Each name with the days it
 * misses steps on, days all share said once. Only days some line holds a
 * value on: a day none holds is the template's "N of M days hold rows".
 */
function missingText(byName: Map<string, Set<number>>, heldDays: Set<number>, every: string): string {
  const names = [...byName.keys()]
  const missing = new Map([...byName.entries()].map(([n, days]) => [n, [...days].filter((d) => heldDays.has(d)).sort((a, b) => a - b)]))
  const shared = names.length > 1 ? (missing.get(names[0]) ?? []).filter((d) => names.every((n) => missing.get(n)?.includes(d))) : []
  const parts: string[] = []
  if (shared.length) parts.push(`on ${every} on ${daysText(shared)}`)
  for (const n of names) {
    const own = (missing.get(n) ?? []).filter((d) => !shared.includes(d))
    if (own.length) parts.push(`on ${n} on ${daysText(own)}`)
  }
  return parts.length ? `Some steps are missing: ${parts.join('; ')}.` : ''
}

/** The borders' days that miss some of their own steps. */
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
  return missingText(byName, heldDays, 'every border')
}

/** The zones' days with quarter-hours held on neither side. */
export function zoneMissingSentence(zones: Sided[], window: DateRange): string {
  const byName = new Map<string, Set<number>>()
  const heldDays = new Set<number>()
  for (const z of zones) {
    const step = z.inSide?.step ?? z.outSide?.step ?? null
    const days = new Set<number>()
    for (const d of sideDays(z.inSide?.points ?? [], z.outSide?.points ?? [], step, window)) {
      if (d.held > 0) heldDays.add(d.start)
      if (d.expected !== null && d.held < d.expected) days.add(d.start)
    }
    byName.set(z.name, days)
  }
  return missingText(byName, heldDays, 'every zone')
}

/**
 * How the zones' two sides share the quarter-hours held: when no quarter-hour
 * names a zone on both sides, the two lines take turns, and a break in one
 * is where the other carries on, not a gap.
 */
export function turnsSentence(zones: Sided[]): string {
  const heldAt = (line: Line | null) => new Set((line?.points ?? []).filter((p) => p.v !== null).map((p) => p.t))
  let both = 0
  let any = 0
  for (const z of zones) {
    const a = heldAt(z.inSide)
    const b = heldAt(z.outSide)
    for (const t of a) if (b.has(t)) both += 1
    any += a.size + b.size
  }
  if (!any) return ''
  return both === 0
    ? 'In this window no quarter-hour names a zone on both sides, so each zone’s two lines take turns: where one breaks, the other carries on.'
    : `In this window ${plural(both, 'quarter-hour names', 'quarter-hours name')} a zone on both sides at once.`
}

/** `hours` or `quarter-hours`: what a line's steps are called. */
export const stepWords = (step: number | null) => (step === null ? 'values' : stepNoun(step))
