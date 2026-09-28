import { FUEL_BANDS, totalGeneration, type MixRow } from '../../design/fuels'

export interface MixMean {
  key: string
  label: string
  gw: number
}

/** Mean GW per fuel band over the half-hours held (a band's missing values are left out, not read as zero). */
export function meanMix(rows: MixRow[]): MixMean[] {
  return FUEL_BANDS.map((b) => {
    const held = rows.map((r) => r[b.key]).filter((v): v is number => v !== null && v !== undefined)
    return { key: b.key, label: b.label, gw: held.length ? held.reduce((s, v) => s + v, 0) / held.length : 0 }
  })
}

/** A fuel's share of total generation (positive parts) across the rows. */
export function share(rows: MixRow[], key: string): number {
  const total = rows.reduce((s, r) => s + totalGeneration(r), 0)
  return total > 0 ? rows.reduce((s, r) => s + Math.max(r[key] ?? 0, 0), 0) / total : 0
}

export function meanTotal(rows: MixRow[]): number {
  return rows.length ? rows.reduce((s, r) => s + totalGeneration(r), 0) / rows.length : 0
}
