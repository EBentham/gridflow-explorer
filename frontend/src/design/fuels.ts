import type { DataRecord } from '../api/types'
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

export interface MixRow {
  t: number
  /** Band values in GW (display unit), signed. */
  [key: string]: number
}

/**
 * Pivots API records (MW per source series) into band rows in GW, plus
 * `<key>__pos` / `<key>__neg` parts for signed bands so positive parts stack
 * above zero and negative parts stack below it.
 */
export function toMixRows(records: DataRecord[], timestampKey: string): MixRow[] {
  return records.map((r) => {
    const row: MixRow = { t: toMs(String(r[timestampKey])) }
    for (const band of FUEL_BANDS) {
      const mw = band.sources.reduce((sum, s) => sum + (Number(r[s.key]) || 0), 0)
      const gw = mw / 1000
      row[band.key] = gw
      for (const s of band.sources) row[`src__${s.key}`] = (Number(r[s.key]) || 0) / 1000
      if (band.signed) {
        row[`${band.key}__pos`] = Math.max(gw, 0)
        row[`${band.key}__neg`] = Math.min(gw, 0)
      }
    }
    return row
  })
}

/** Total transmission-connected generation (positive parts only), GW. */
export function totalGeneration(row: MixRow): number {
  return FUEL_BANDS.reduce((sum, b) => sum + Math.max(row[b.key] ?? 0, 0), 0)
}
