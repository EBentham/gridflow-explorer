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

/** What the rows endpoint takes as a filter value: letters, digits, spaces and `_ . - / :`, 1 to 64 of them. */
const UNIT_ID = /^[A-Za-z0-9 _.\-/:]{1,64}$/

/** A BM unit id the rows endpoint can filter by, trimmed; null for anything else. */
export function validUnitId(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  return UNIT_ID.test(v) ? v : null
}

/** The ENTSO-E area codes (EIC) the pages read. */
export const EIC = {
  GB: '10YGB----------A',
  FR: '10YFR-RTE------C',
  NL: '10YNL----------L',
  BE: '10YBE----------2',
  DE_LU: '10Y1001A1001A82H',
  IE_SEM: '10Y1001A1001A59C',
} as const

/** Their names, as gridflow's own ENTSO-E area list gives them (`connectors/entsoe/area_codes.py`). */
export const ENTSOE_AREAS: Readonly<Record<string, string>> = {
  [EIC.GB]: 'Great Britain',
  [EIC.DE_LU]: 'Germany / Luxembourg',
  [EIC.FR]: 'France',
  [EIC.NL]: 'Netherlands',
  [EIC.BE]: 'Belgium',
  [EIC.IE_SEM]: 'Ireland (SEM)',
}

/** `France` from `10YFR-RTE------C`; null for a code gridflow doesn't name. */
export function entsoeArea(v: Scalar): string | null {
  return typeof v === 'string' ? (ENTSOE_AREAS[v] ?? null) : null
}

/** `Gas combined cycle` from `gas_combined_cycle`: a snake_case id as words. */
export function idWords(v: Scalar): string | null {
  if (typeof v !== 'string' || !v) return null
  const words = v.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}
