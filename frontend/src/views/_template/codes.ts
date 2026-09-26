/**
 * Ways to read coded values in words, for `ColumnSpec.text`: ENTSO-E's
 * production types (the transparency platform's published PsrType list),
 * the name inside a JSON text, and a snake_case id as words. Each returns
 * null for a value it doesn't know, and the table shows that value as held.
 */
import type { Scalar } from '../contract'

/** ENTSO-E production types (PsrType), in the platform's own names, sentence case. */
export const ENTSOE_PRODUCTION_TYPES: Readonly<Record<string, string>> = {
  B01: 'Biomass',
  B02: 'Fossil brown coal/lignite',
  B03: 'Fossil coal-derived gas',
  B04: 'Fossil gas',
  B05: 'Fossil hard coal',
  B06: 'Fossil oil',
  B07: 'Fossil oil shale',
  B08: 'Fossil peat',
  B09: 'Geothermal',
  B10: 'Hydro pumped storage',
  B11: 'Hydro run-of-river and poundage',
  B12: 'Hydro water reservoir',
  B13: 'Marine',
  B14: 'Nuclear',
  B15: 'Other renewable',
  B16: 'Solar',
  B17: 'Waste',
  B18: 'Wind offshore',
  B19: 'Wind onshore',
  B20: 'Other',
  B25: 'Energy storage',
}

/** `Fossil gas (B04)`: an ENTSO-E production type in words, with its code. */
export function productionType(v: Scalar): string | null {
  const name = typeof v === 'string' ? ENTSOE_PRODUCTION_TYPES[v] : undefined
  return name ? `${name} (${v})` : null
}

/** `France` from `{"code": "FR", "name": "France"}`: the `name` inside a JSON text. */
export function jsonName(v: Scalar): string | null {
  if (typeof v !== 'string' || !v.startsWith('{')) return null
  try {
    const parsed: unknown = JSON.parse(v)
    const name = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>).name : undefined
    return typeof name === 'string' && name.trim() ? name : null
  } catch (err) {
    if (err instanceof SyntaxError) return null
    throw err
  }
}

/** `Gas combined cycle` from `gas_combined_cycle`: a snake_case id as words. */
export function idWords(v: Scalar): string | null {
  if (typeof v !== 'string' || !v) return null
  const words = v.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
