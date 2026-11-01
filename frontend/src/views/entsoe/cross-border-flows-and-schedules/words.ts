/**
 * What the panels say in plain words beyond the line clock's own sentences
 * (`_template/lineClock.ts`): the borders whose two datasets keep different
 * steps, and how a zone's two sides share its quarter-hours. Worked out from
 * the rows every time, so they stay true of whatever window is open.
 */
import { listText, plural } from '../../../design/format'
import { cadenceText } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import { missingText, unreadSentence } from '../../_template/lineClock'
import { sideDays } from './figures'
import type { Line } from './model'

interface Sided {
  phrase: string
  inSide: Line | null
  outSide: Line | null
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

/** The zones' days with quarter-hours held on neither side, and the zones whose steps can't be read. */
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
    byName.set(z.phrase, days)
  }
  const unread = zones.map((z) => unreadSentence(z.phrase, [...(z.inSide?.points ?? []), ...(z.outSide?.points ?? [])], z.inSide?.step ?? z.outSide?.step ?? null))
  return [missingText(byName, heldDays, 'every zone', 'for'), ...unread].filter(Boolean).join(' ')
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

/** `No value drawn here is below zero.`: counted from the values held, on both sides. */
export function belowZeroText(zones: Sided[], where: string): string {
  let below = 0
  for (const z of zones) for (const line of [z.inSide, z.outSide]) for (const p of line?.points ?? []) if (p.v !== null && p.v < 0) below += 1
  return below === 0 ? `No value ${where} is below zero.` : `${plural(below, `value ${where} is`, `values ${where} are`)} below zero, as published.`
}
