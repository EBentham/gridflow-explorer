/**
 * Gaps stay gaps. The backend returns rows only where data exists, and a
 * numeric time axis would otherwise draw a straight line (or a stacked band)
 * across a missing stretch. `withGaps` inserts marker rows with no values
 * where the clock skips; Recharts breaks every line and stack at them.
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
