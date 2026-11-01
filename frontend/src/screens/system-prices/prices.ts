import type { DataRecord } from '../../api/types'
import { HALF_HOUR, toMs } from '../../design/time'
import { runsWhere, type Run } from '../../design/series'

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

/** Runs of consecutive half-hours with a system price below zero. A missing half-hour ends a run. */
export const negativeRuns = (rows: PriceRow[]): Run[] => runsWhere(rows, HALF_HOUR, (r) => r.price, (v) => v < 0)
