/**
 * NESO's eleven fuel columns as this page draws them: stack order bottom
 * first, following DESIGN §3 (nuclear, hydro, biomass, wind, gas, peaking,
 * other, storage, imports), with embedded wind beside wind and solar after
 * them. The eleven add up to NESO's `generation` column, which is how NESO
 * defines it, so the stack's top is its total.
 *
 * Colour follows the entity. Coal takes `--fuel-peaking`, the band the design
 * folds coal into. Embedded wind is wind, so it keeps wind's colour, hatched
 * with the chart surface so it can't be read as part of the
 * transmission-connected band under it: the pattern `WindHatch.tsx` draws in
 * the charts, and a matching stripe for the swatches, which are CSS. Solar
 * has no fuel token in the locked palette (NEEDS.md): it borrows
 * `--chart-tick`, the token furthest from all nine fuel colours, in both
 * themes, that still reads as a line on the chart surface.
 */
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'
import type { DisplayUnit } from '../../_template/units'

export interface Fuel {
  column: string
  label: string
  /** The name in running text: `embedded wind`. */
  prose: string
  /** The fuel's colour token: text, strokes and the focused band's line. */
  color: string
  /** Its paint in the charts' SVG: the colour, or a pattern. */
  fill: string
  /** Its CSS background, for the key's swatch and the mix bar: the colour, or a stripe. */
  swatch: string
}

/** The embedded-wind hatch's id: `WindHatch.tsx` draws the pattern on the page. */
export const WIND_HATCH_ID = 'hgm-wind-emb-hatch'

/** The same hatch in CSS, 45° like the pattern: 1.5px of chart surface every 5px. */
const WIND_STRIPE = 'repeating-linear-gradient(45deg, var(--fuel-wind) 0 3.5px, var(--chart-surface) 3.5px 5px)'

const solid = (column: string, label: string, prose: string, color: string): Fuel => ({ column, label, prose, color, fill: color, swatch: color })

export const FUELS: Fuel[] = [
  solid('nuclear', 'Nuclear', 'nuclear', 'var(--fuel-nuclear)'),
  solid('hydro', 'Hydro', 'hydro', 'var(--fuel-hydro)'),
  solid('biomass', 'Biomass', 'biomass', 'var(--fuel-biomass)'),
  solid('wind', 'Wind, transmission', 'transmission-connected wind', 'var(--fuel-wind)'),
  { column: 'wind_emb', label: 'Wind, embedded', prose: 'embedded wind', color: 'var(--fuel-wind)', fill: `url(#${WIND_HATCH_ID})`, swatch: WIND_STRIPE },
  solid('solar', 'Solar', 'solar', 'var(--chart-tick)'),
  solid('gas', 'Gas', 'gas', 'var(--fuel-gas)'),
  solid('coal', 'Coal', 'coal', 'var(--fuel-peaking)'),
  solid('other', 'Other', '“other”', 'var(--fuel-other)'),
  solid('storage', 'Storage', 'storage', 'var(--fuel-pumped_storage)'),
  solid('imports', 'Imports', 'imports', 'var(--fuel-imports)'),
]

export const FUEL_COLUMNS = FUELS.map((f) => f.column)

/** NESO's carbon intensity for the half-hour, gCO₂/kWh. */
export const CI = 'carbon_intensity'
export const CI_LABEL = 'Carbon intensity'
export const CI_COLOR = 'var(--chart-price)'

/** Both value axes take this width, so the stack and the carbon intensity below it share one clock. */
export const AXIS_WIDTH = 44

/** A column's id in the template's focus and keys (`seriesId`): the rows aren't split, so it is `self/<column>`. */
export const idOf = (column: string) => `self/${column}`

/** A column's series in the template's model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

/** Whether `v` is above zero yet prints as the unit's zero (`0.0 GW`), which would read as none. */
export const printsAsZero = (unit: DisplayUnit, v: number) => v > 0 && unit.format(v) === unit.format(0)

/** `2.6 GW`, or `under 0.1 GW` for a value above zero too small to print at the unit's digits. */
export function amountText(unit: DisplayUnit, v: number): string {
  if (!printsAsZero(unit, v)) return unit.format(v)
  const digits = unit.plain(0).split('.')[1]?.length ?? 0
  return `under ${unit.format(10 ** -digits)}`
}

/** The fuel a focus id names, if it names one. */
export const focusedFuel = (focus: string | undefined): Fuel | undefined => FUELS.find((f) => idOf(f.column) === focus)
