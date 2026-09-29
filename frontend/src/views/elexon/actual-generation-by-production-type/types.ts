/**
 * Elexon's production types as this page draws them. Both datasets carry the
 * types as Elexon names them (`Fossil Gas`, `Wind Offshore`), the ENTSO-E
 * production types Elexon republishes, not FUELHH's fuel codes. The page
 * keeps them apart, one series each, in the stack order of the Generation mix
 * screen's bands (DESIGN §3): nuclear, hydro, biomass, wind, solar, gas,
 * peaking, other, pumped storage.
 *
 * Colour follows the entity. A type that plainly is one of the Generation mix
 * fuels takes that fuel's colour; solar takes `--fuel-solar`. Two types share
 * a fuel's band: offshore wind beside onshore, and oil beside hard coal (both
 * of which FUELHH folds into peaking). The second of each keeps the band's
 * colour hatched with the chart surface, as the ENTSO-E and NESO pages mark a
 * second kind of wind: an SVG pattern in the charts (`Hatch.tsx`) and a
 * matching CSS stripe for the key's swatches.
 */
import { seriesId, type SeriesDef, type SeriesModel } from '../../_template/seriesModel'
import type { GroupSpec } from '../../define'

export const VALUE = 'generation_mw'
export const PSR = 'psr_type'

/** Both charts on the page take this value-axis width, so their clocks line up. */
export const AXIS_WIDTH = 44

export const HATCH = {
  wind: 'agpt-hatch-wind',
  peaking: 'agpt-hatch-peaking',
} as const

const stripe = (token: string) => `repeating-linear-gradient(45deg, var(${token}) 0 3.5px, var(--chart-surface) 3.5px 5px)`

export interface ProductionType {
  /** The `psr_type` value as held. */
  value: string
  /** Its name on the page, sentence case. */
  label: string
  /** The name in running text. */
  prose: string
  /** The colour token: lines, labels, the focused band. */
  color: string
  /** Its paint in the charts' SVG: the colour, or a pattern. */
  fill: string
  /** Its CSS background, for swatches: the colour, or a stripe. */
  swatch: string
}

const solid = (value: string, label: string, prose: string, color: string): ProductionType => ({ value, label, prose, color, fill: color, swatch: color })

/** Every type either dataset carries, bottom of the stack first. */
export const TYPES: ProductionType[] = [
  solid('Nuclear', 'Nuclear', 'nuclear', 'var(--fuel-nuclear)'),
  solid('Hydro Run-of-river and poundage', 'Hydro run-of-river and poundage', 'run-of-river hydro', 'var(--fuel-hydro)'),
  solid('Biomass', 'Biomass', 'biomass', 'var(--fuel-biomass)'),
  solid('Wind Onshore', 'Wind onshore', 'onshore wind', 'var(--fuel-wind)'),
  { value: 'Wind Offshore', label: 'Wind offshore', prose: 'offshore wind', color: 'var(--fuel-wind)', fill: `url(#${HATCH.wind})`, swatch: stripe('--fuel-wind') },
  solid('Solar', 'Solar', 'solar', 'var(--fuel-solar)'),
  solid('Fossil Gas', 'Fossil gas', 'gas', 'var(--fuel-gas)'),
  solid('Fossil Hard coal', 'Fossil hard coal', 'hard coal', 'var(--fuel-peaking)'),
  { value: 'Fossil Oil', label: 'Fossil oil', prose: 'oil', color: 'var(--fuel-peaking)', fill: `url(#${HATCH.peaking})`, swatch: stripe('--fuel-peaking') },
  solid('Other', 'Other', '“other”', 'var(--fuel-other)'),
  solid('Hydro Pumped Storage', 'Hydro pumped storage', 'pumped storage', 'var(--fuel-pumped_storage)'),
]

/** The types for the template: names and colour tokens, in stack order. */
export const GROUPS: GroupSpec[] = TYPES.map((t) => ({ value: t.value, label: t.label, color: t.color }))

export const typeOf = (value: string | null) => TYPES.find((t) => t.value === value)

/** A series' paint and swatch: its type's, or its own colour for a type this page doesn't know. */
export const fillOf = (d: SeriesDef) => typeOf(d.group)?.fill ?? d.color
export const swatchOf = (d: SeriesDef) => typeOf(d.group)?.swatch ?? d.color

/** The model's own series that hold a value, in stack order: the known types first, then any other. */
export function heldTypes(model: SeriesModel): SeriesDef[] {
  const rank = (d: SeriesDef) => {
    const i = TYPES.findIndex((t) => t.value === d.group)
    return i >= 0 ? i : TYPES.length
  }
  return model.all.filter((d) => d.from === 'self' && d.count > 0).sort((a, b) => rank(a) - rank(b))
}

/** Types in the rows this page has no name or colour for. */
export const unknownTypes = (model: SeriesModel) => heldTypes(model).filter((d) => !typeOf(d.group))

/** The series the key has selected, if it is one of the page's own. */
export const focusedDef = (model: SeriesModel, focus: string | undefined) => (focus ? model.all.find((d) => seriesId(d) === focus) : undefined)
