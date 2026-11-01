import type { DataRecord } from '../api/types'
import { gw } from './format'
import { toMs } from './time'

/**
 * Display bands for the generation mix. Eleven source series fold into nine
 * bands, stacked bottom to top in this order (baseload up to flexible, with
 * trade last). Coal and oil are ~0 in GB in 2026, so they join OCGT as
 * "peaking". The tooltip still itemises each source.
 *
 * Colour is keyed by band key through the `--fuel-<key>` CSS custom
 * property, so it follows the entity, never its position.
 */
export interface FuelBand {
  key: string
  label: string
  sources: { key: string; label: string }[]
  /** Can go negative (pumping, net exports); stacks below zero. */
  signed: boolean
}

export const FUEL_BANDS: FuelBand[] = [
  { key: 'nuclear', label: 'Nuclear', sources: [{ key: 'nuclear', label: 'Nuclear' }], signed: false },
  { key: 'hydro', label: 'Hydro', sources: [{ key: 'hydro', label: 'Hydro' }], signed: false },
  { key: 'biomass', label: 'Biomass', sources: [{ key: 'biomass', label: 'Biomass' }], signed: false },
  { key: 'wind', label: 'Wind', sources: [{ key: 'wind', label: 'Wind' }], signed: false },
  { key: 'gas', label: 'Gas (CCGT)', sources: [{ key: 'gas', label: 'Gas (CCGT)' }], signed: false },
  {
    key: 'peaking',
    label: 'Peaking',
    sources: [
      { key: 'gas_ocgt', label: 'Gas (OCGT)' },
      { key: 'coal', label: 'Coal' },
      { key: 'oil', label: 'Oil' },
    ],
    signed: false,
  },
  { key: 'other', label: 'Other', sources: [{ key: 'other', label: 'Other' }], signed: false },
  {
    key: 'pumped_storage',
    label: 'Pumped storage',
    sources: [{ key: 'pumped_storage', label: 'Pumped storage' }],
    signed: true,
  },
  { key: 'imports', label: 'Net imports', sources: [{ key: 'imports', label: 'Net imports' }], signed: true },
]

export const fuelVar = (key: string) => `var(--fuel-${key})`

/**
 * Elexon's fuel codes, bottom of the stack first, each with its own name and
 * the band it folds into, as the generation mix folds them (the backend's
 * `FUEL_TO_SERIES`). `INT…` codes are interconnectors, in net imports.
 */
export const ELEXON_FUELS: { code: string; label: string; band: string }[] = [
  { code: 'NUCLEAR', label: 'Nuclear', band: 'nuclear' },
  { code: 'NPSHYD', label: 'Hydro', band: 'hydro' },
  { code: 'BIOMASS', label: 'Biomass', band: 'biomass' },
  { code: 'WIND', label: 'Wind', band: 'wind' },
  { code: 'CCGT', label: 'Gas (CCGT)', band: 'gas' },
  { code: 'OCGT', label: 'Gas (OCGT)', band: 'peaking' },
  { code: 'COAL', label: 'Coal', band: 'peaking' },
  { code: 'OIL', label: 'Oil', band: 'peaking' },
  { code: 'OTHER', label: 'Other', band: 'other' },
  { code: 'PS', label: 'Pumped storage', band: 'pumped_storage' },
]

export const isInterconnectorCode = (code: string) => code.startsWith('INT')

/** The band an Elexon fuel code folds into; null for a code the list doesn't know (each page says what that is). */
export function elexonBand(code: string): string | null {
  return isInterconnectorCode(code) ? 'imports' : (ELEXON_FUELS.find((f) => f.code === code)?.band ?? null)
}

/** A listed Elexon fuel code's own name: `Gas (OCGT)`; null for an interconnector or a code the list doesn't know. */
export const elexonFuelName = (code: string): string | null => ELEXON_FUELS.find((f) => f.code === code)?.label ?? null

export interface MixRow {
  t: number
  /** Band values in GW (display unit), signed; null where the source sent none. */
  [key: string]: number | null
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

/**
 * Pivots API records (MW per source series) into band rows in GW, plus
 * `<key>__pos` / `<key>__neg` parts for signed bands so positive parts stack
 * above zero and negative parts stack below it. A band is null only when
 * every source in it is null: a missing value is never read as zero.
 */
export function toMixRows(records: DataRecord[], timestampKey: string): MixRow[] {
  return records.map((r) => {
    const row: MixRow = { t: toMs(String(r[timestampKey])) }
    for (const band of FUEL_BANDS) {
      const parts = band.sources.map((s) => {
        const p = num(r[s.key])
        row[`src__${s.key}`] = p === null ? null : gw(p)
        return p
      })
      const held = parts.filter((p): p is number => p !== null)
      const value = held.length ? gw(held.reduce((a, b) => a + b, 0)) : null
      row[band.key] = value
      if (band.signed) {
        row[`${band.key}__pos`] = value === null ? null : Math.max(value, 0)
        row[`${band.key}__neg`] = value === null ? null : Math.min(value, 0)
      }
    }
    return row
  })
}

/** Total transmission-connected generation (positive parts only), GW. */
export function totalGeneration(row: MixRow): number {
  return FUEL_BANDS.reduce((sum, b) => sum + Math.max(row[b.key] ?? 0, 0), 0)
}
