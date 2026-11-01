/**
 * Gaps stay gaps. The backend returns rows only where data exists, and a
 * numeric time axis would otherwise draw a straight line (or a stacked band)
 * across a missing stretch. `withGaps` inserts marker rows with no values
 * where the clock skips; Recharts breaks every line and stack at them, and
 * `runsWhere` lets a gap end a run.
 */
import { HALF_HOUR } from './time'

export interface GapRow {
  t: number
  gap: true
}

export function isGap(row: object): row is GapRow {
  return (row as Partial<GapRow>).gap === true
}

/**
 * Rows in time order with a marker at each end of every missing stretch
 * longer than `step`: one just after the last row held, one just before the
 * next, so hovering anywhere inside the gap reads "no data".
 */
export function withGaps<T extends { t: number }>(rows: T[], step = HALF_HOUR): (T | GapRow)[] {
  const out: (T | GapRow)[] = []
  rows.forEach((row, i) => {
    const prev = rows[i - 1]
    if (prev && row.t - prev.t > step) {
      out.push({ t: prev.t + step, gap: true })
      if (row.t - prev.t > 2 * step) out.push({ t: row.t - step, gap: true })
    }
    out.push(row)
  })
  return out
}

export interface Run {
  start: number
  /** The last time in the run. */
  last: number
  n: number
  /** The run's lowest value. */
  min: number
}

/**
 * Runs of consecutive steps whose value passes `test`, as their first and
 * last times, on a clock of `step`: a gap longer than a step, or a value that
 * fails, ends a run. `valueOf` gives undefined for an item off the series'
 * clock (passed over) and null for a gap. No runs without a step.
 */
export function runsWhere<T extends { t: number }>(items: T[], step: number | null, valueOf: (item: T) => number | null | undefined, test: (v: number) => boolean): Run[] {
  if (step === null) return []
  const out: Run[] = []
  let run: Run | null = null
  for (const item of items) {
    const v = valueOf(item)
    if (v === undefined) continue
    if (v !== null && test(v)) {
      if (run && item.t - run.last <= step) {
        run.last = item.t
        run.n += 1
        run.min = Math.min(run.min, v)
      } else {
        run = { start: item.t, last: item.t, n: 1, min: v }
        out.push(run)
      }
    } else run = null
  }
  return out
}
