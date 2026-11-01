/**
 * What the indicated demand and generation panels share: the dataset and
 * column ids, one colour per measure (a colour follows its measure wherever
 * it is drawn), and the pair read from the rows (`_template/issuePair.ts`):
 * generation is side `a`, demand side `b`.
 *
 * Indicated demand is held negative. Every figure the pair hands a chart or
 * a key for demand is that figure with its sign turned, and its names say
 * so; the held figure is kept beside it for the table.
 */
import { pairOf, type PairSide } from '../../_template/issuePair'
import type { SeriesDef } from '../../_template/seriesModel'
import type { PageContext } from '../../define'

export const INDDEM = 'inddem'
export const INDGEN = 'indgen'
export const DEMAND = 'indicated_demand_mw'
export const GENERATION = 'indicated_generation_mw'

export const COLORS = {
  generation: 'var(--chart-fan)',
  demand: 'var(--chart-price-2)',
  lead: 'var(--chart-fan-soft)',
} as const

const GENERATION_SIDE: PairSide = { dataset: INDGEN, column: GENERATION, label: 'Indicated generation', color: COLORS.generation }
const DEMAND_SIDE: PairSide = { dataset: INDDEM, column: DEMAND, label: 'Indicated demand, sign flipped', color: COLORS.demand, flip: true }

/** The page's pair: generation (`a`) and demand, sign flipped (`b`). */
export const pairFor = (ctx: PageContext) => pairOf(ctx, GENERATION_SIDE, DEMAND_SIDE)

/** A focus id from the key, as `SeriesChart` reads it. */
export const pairId = (d: Pick<SeriesDef, 'key'>) => `pair/${d.key}`
