import type { DataRecord } from '../../api/types'
import { HALF_HOUR, toMs } from '../../design/time'

export interface PriceRow {
  t: number
  /**
   * The imbalance price, read from the sell column (GB has been single-priced
   * since November 2015). A missing sell price stays a gap rather than
   * borrowing the buy price.
   */
  price: number | null
  sell: number | null
  buy: number | null
  /** Net imbalance volume, MWh: above zero the system was short, below zero long. */
  niv: number | null
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

export function toPriceRows(records: DataRecord[], timestampKey: string): PriceRow[] {
  return records.map((r) => {
    const sell = num(r.system_sell_price)
    const buy = num(r.system_buy_price)
    return { t: toMs(String(r[timestampKey])), sell, buy, price: sell, niv: num(r.net_imbalance_volume) }
  })
}

/** True when some half-hour has different sell and buy prices, so one line would hide one of them. */
export function isDualPriced(rows: PriceRow[]): boolean {
  return rows.some((r) => r.sell !== null && r.buy !== null && r.sell !== r.buy)
}

export interface NegRun {
  start: number
  /** Start of the last negative half-hour in the run. */
  last: number
  n: number
  min: number
}

/** Runs of consecutive half-hours with a system price below zero. A missing half-hour ends a run. */
export function negativeRuns(rows: PriceRow[]): NegRun[] {
  const out: NegRun[] = []
  let cur: NegRun | null = null
  for (const r of rows) {
    const p = r.price
    const contiguous = cur !== null && r.t - cur.last <= HALF_HOUR
    if (p !== null && p < 0) {
      if (cur && contiguous) {
        cur.last = r.t
        cur.n += 1
        cur.min = Math.min(cur.min, p)
      } else {
        cur = { start: r.t, last: r.t, n: 1, min: p }
        out.push(cur)
      }
    } else {
      cur = null
    }
  }
  return out
}
