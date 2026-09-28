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
  return currency(v, '£', digits)
}

/** Any currency, sign outside the symbol: `−€67.40`. */
export function currency(v: number, symbol: string, digits = 0): string {
  const f = 10 ** digits
  const r = Math.round(v * f) / f
  return r === 0 ? `${symbol}${(0).toFixed(digits)}` : signed(r, (a) => `${symbol}${a.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`)
}

/** Any number of decimals, en-GB grouping, a true minus: `fmtN(-0.5, 2)` is `−0.50`. */
export function fmtN(v: number, digits: number): string {
  const f = 10 ** digits
  const r = Math.round(v * f) / f
  if (r === 0) return (0).toFixed(digits)
  return signed(r, (a) => a.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits }))
}

/** Decimals an axis step needs to print distinct ticks: 0 for 5, 1 for 2.5 or 0.5, 2 for 0.25. */
export function stepDigits(step: number): number {
  if (!Number.isFinite(step) || step <= 0) return 0
  for (let d = 0; d < 6; d += 1) {
    if (Math.abs(Math.round(step * 10 ** d) - step * 10 ** d) < 1e-6) return d
  }
  return 6
}

/**
 * Decimals for a value with no settled precision: fewer as it grows (1234 → 0,
 * 12.3 → 1, 1.23 → 2), and below 1 three significant figures (0.123 → 3,
 * 0.00914 → 5, 0.0000161 → 7), so a small value never prints as zero.
 */
export function autoDigits(v: number): number {
  const a = Math.abs(v)
  if (a >= 100 || a === 0) return 0
  if (a >= 10) return 1
  if (a >= 1) return 2
  return Math.min(12, 2 - Math.floor(Math.log10(a)))
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
