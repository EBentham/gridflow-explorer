/**
 * The net positions' two sides per UK day, on the template's line clock
 * (`_template/lineClock.ts`).
 */
import { londonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import { daysOf, type Point } from '../../_template/lineClock'

export interface SideTally {
  day: string
  start: number
  /** Times with a value on either side. */
  held: number
  expected: number | null
  /** Times held with the zone named as the in area, and as the out area. */
  inSide: number
  outSide: number
  /** Times held on both sides at once. */
  both: number
  inMean: number | null
  outMean: number | null
}

/**
 * A zone's net position per UK day, its two sides counted apart and never
 * netted: a value named on the in side and one named on the out side are
 * both positive, and which of them is the export isn't confirmed.
 */
export function sideDays(inSide: Point[], outSide: Point[], step: number | null, window: DateRange): SideTally[] {
  const ins = daysOf(inSide, step, window)
  const outs = daysOf(outSide, step, window)
  const heldAt = (points: Point[]) => new Set(points.filter((p) => p.v !== null).map((p) => p.t))
  const inTimes = heldAt(inSide)
  const outTimes = heldAt(outSide)
  const times = new Map<number, { held: number; both: number }>()
  for (const t of new Set([...inTimes, ...outTimes])) {
    const d = londonMidnight(t)
    const s = times.get(d) ?? { held: 0, both: 0 }
    s.held += 1
    if (inTimes.has(t) && outTimes.has(t)) s.both += 1
    times.set(d, s)
  }
  return ins.map((a, i) => {
    const b = outs[i]
    const s = times.get(a.start) ?? { held: 0, both: 0 }
    return { day: a.day, start: a.start, held: s.held, expected: a.expected, inSide: a.held, outSide: b.held, both: s.both, inMean: a.mean, outMean: b.mean }
  })
}
