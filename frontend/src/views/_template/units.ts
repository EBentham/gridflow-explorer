/**
 * Units as the page prints them (DESIGN §6): GW from MW (display only),
 * `£/MWh` with the sign outside the symbol, `°C`, `gCO₂/kWh`. The manifest's
 * units are research text; only the ones listed here are recognised. Anything
 * else, and null, prints as "unit unconfirmed" until a page's config settles
 * it from the P1 card. Nothing is guessed.
 */
import { autoDigits, currency, fmtN } from '../../design/format'

export interface DisplayUnit {
  /** As printed after a value: `GW`, `£/MWh`, `%`; null when unconfirmed. */
  label: string | null
  /** The unit the rows carry, as the manifest or the config gives it. */
  source: string | null
  /** Multiply a stored value by this to display it (MW to GW is 1/1000). */
  factor: number
  /** False for categories, flags and text: those go to the table, never a chart. */
  numeric: boolean
  /** `23.4 GW`, `−£67.40/MWh`, `12.3` when the unit is unconfirmed. */
  format: (v: number) => string
  /** The number alone, for ticks and table cells: `23.4`, `−67.40`. */
  plain: (v: number) => string
  /** The axis caption: the label, or "as published, unit unconfirmed". */
  caption: string
}

interface UnitRule {
  label: string
  digits: number
  factor?: number
  /** A currency: the symbol leads the number and the sign leads both. */
  money?: string
  /** No space between number and unit (`%`, `°`). */
  tight?: boolean
}

const RULES: Record<string, UnitRule> = {
  GW: { label: 'GW', digits: 1 },
  MWh: { label: 'MWh', digits: 0 },
  GWh: { label: 'GWh', digits: 1 },
  TWh: { label: 'TWh', digits: 2 },
  kWh: { label: 'kWh', digits: 0 },
  'GWh/d': { label: 'GWh/d', digits: 1 },
  'kWh/d': { label: 'kWh/d', digits: 0 },
  'GBP/MWh': { label: '/MWh', digits: 2, money: '£' },
  GBP: { label: '', digits: 0, money: '£' },
  'EUR/MWh': { label: '/MWh', digits: 2, money: '€' },
  EUR: { label: '', digits: 0, money: '€' },
  Hz: { label: 'Hz', digits: 3 },
  degC: { label: '°C', digits: 1 },
  '°C': { label: '°C', digits: 1 },
  K: { label: 'K', digits: 1 },
  '%': { label: '%', digits: 1, tight: true },
  'gCO2/kWh': { label: 'gCO₂/kWh', digits: 0 },
  'm/s': { label: 'm/s', digits: 1 },
  'W/m2': { label: 'W/m²', digits: 0 },
  deg: { label: '°', digits: 0, tight: true },
  hPa: { label: 'hPa', digits: 0 },
  mm: { label: 'mm', digits: 1 },
  cm: { label: 'cm', digits: 1 },
  m: { label: 'm', digits: 2 },
  'kg/m3': { label: 'kg/m³', digits: 3 },
  'kWh/Nm3': { label: 'kWh/Nm³', digits: 2 },
  '% (mol/mol)': { label: '% mol/mol', digits: 2 },
  rank: { label: 'rank', digits: 0 },
}

/** Units of values that are not quantities. */
const NOT_NUMERIC = new Set(['category', 'text', 'json', 'bool', 'calendar'])

const UNCONFIRMED = 'as published, unit unconfirmed'

/**
 * How to print values of `unit`. `display: 'GW'` (the default) turns MW into
 * GW; `'MW'` keeps MW for one unit's scale.
 */
export function displayUnit(unit: string | null | undefined, display: 'GW' | 'MW' = 'GW'): DisplayUnit {
  const source = unit ?? null
  if (source !== null && NOT_NUMERIC.has(source)) {
    return { label: null, source, factor: 1, numeric: false, format: String, plain: String, caption: '' }
  }
  const rule: UnitRule | undefined =
    source === 'MW' ? (display === 'MW' ? { label: 'MW', digits: 0 } : { label: 'GW', digits: 1, factor: 1 / 1000 }) : source === null ? undefined : RULES[source]
  if (!rule) {
    const plain = (v: number) => fmtN(v, autoDigits(v))
    return { label: null, source, factor: 1, numeric: true, format: plain, plain, caption: UNCONFIRMED }
  }
  const plain = (v: number) => fmtN(v, rule.digits)
  const format = rule.money
    ? (v: number) => `${currency(v, rule.money ?? '', rule.digits)}${rule.label}`
    : (v: number) => `${plain(v)}${rule.tight ? '' : ' '}${rule.label}`
  const label = rule.money ? `${rule.money}${rule.label}` : rule.label
  return { label, source, factor: rule.factor ?? 1, numeric: true, format, plain, caption: label }
}

/** Whether one axis can carry both: they print the same, and two unconfirmed units come from the same text. */
export const sameUnit = (a: DisplayUnit, b: DisplayUnit) => a.label === b.label && a.factor === b.factor && (a.label !== null || a.source === b.source)
