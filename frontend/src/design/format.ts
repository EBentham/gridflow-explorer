/**
 * Number formatting for every screen: en-GB grouping, a true minus sign
 * (U+2212) for negatives, money with the sign outside the symbol (`−£67`),
 * and the round-number axis scale the charts share.
 */

const MINUS = '−'

function signed(v: number, body: (abs: number) => string): string {
  return `${v < 0 ? MINUS : ''}${body(Math.abs(v))}`
}

const int = (v: number) => Math.round(v).toLocaleString('en-GB')

/** Whole number: `12,345`, `−3`. */
export function fmt0(v: number): string {
  const r = Math.round(v)
  return r === 0 ? '0' : signed(r, int)
}

/** One decimal: `12.3`, `−0.4`. */
export function fmt1(v: number): string {
  const r = Math.round(v * 10) / 10
  return r === 0 ? '0.0' : signed(r, (a) => a.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
}

/** Money with the sign outside the currency symbol: `−£67.40`. */
export function money(v: number, digits = 0): string {
  const f = 10 ** digits
  const r = Math.round(v * f) / f
  return signed(r, (a) => `£${a.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`)
}

/** A share in whole per cent: `38%`. */
export function pct(share: number): string {
  return `${Math.round(share * 100)}%`
}

/** Megawatts to gigawatts, for display only. */
export const gw = (mw: number) => mw / 1000

export interface Scale {
  domain: [number, number]
  ticks: number[]
}

/** Round-number axis: a 1/2/2.5/5 × 10^n step covering [min, max], zero included when crossed. */
export function niceTicks(min: number, max: number, target = 5): Scale {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 1], ticks: [0, 1] }
  if (min === max) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6)
  return { domain: [lo, hi], ticks }
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`
}

/** "a", "a and b", "a, b and c": a plain-English list, no serial comma. */
export function listText(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}
