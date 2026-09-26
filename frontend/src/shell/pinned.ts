import type { GlyphKind } from '../design/glyphs'

export interface PinnedScreen {
  to: string
  label: string
  glyph: GlyphKind
  /** Draws synthetic data: the rail marks it "fixture". */
  fixture?: boolean
}

/**
 * The rail holds pinned favourites only (DESIGN §4); every other screen is
 * reached from the catalogue. The wind forecast stays pinned, tagged as a
 * fixture, until a wind model writes to the forecast store (EFFORT-PLAN OQ-6).
 */
export const PINNED: PinnedScreen[] = [
  { to: '/datasets/generation-mix', label: 'Generation mix', glyph: 'pylon' },
  { to: '/datasets/system-prices', label: 'System prices', glyph: 'meter' },
  { to: '/forecasts/wind', label: 'Wind forecast', glyph: 'turbine', fixture: true },
]
