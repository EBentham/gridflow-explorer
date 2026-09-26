/**
 * Colours for the forecast screen's Variants, by position, as it had them.
 * The v0.3 screen is wrapped in the new shell but not restyled (EFFORT-PLAN
 * OQ-2); only its colours moved onto the tokens so it reads in both themes.
 */
const PALETTE = [
  'var(--chart-fan)',
  'var(--chart-price-2)',
  'var(--fuel-wind)',
  'var(--fuel-biomass)',
  'var(--fuel-pumped_storage)',
  'var(--fuel-peaking)',
  'var(--fuel-hydro)',
  'var(--fuel-imports)',
]

export function colorFor(index: number): string {
  return PALETTE[index % PALETTE.length]
}
