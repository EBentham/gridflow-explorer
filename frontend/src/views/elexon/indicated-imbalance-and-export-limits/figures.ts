/**
 * What the indicated imbalance and indicated margin panels share: the
 * dataset and column ids, one colour per measure (a colour follows its
 * measure wherever it is drawn), and the pair read from the rows
 * (`_template/issuePair.ts`): imbalance is side `a`, margin side `b`.
 */
import { leadText } from '../../../design/time'
import { pairOf, type Pair, type PairRow, type PairSide } from '../../_template/issuePair'
import type { PageContext } from '../../define'

export const IMBALNGC = 'imbalngc'
export const MELNGC = 'melngc'
export const IMBALANCE = 'indicated_imbalance'
export const MARGIN = 'indicated_margin'

export const COLORS = {
  imbalance: 'var(--chart-price-2)',
  margin: 'var(--chart-fan)',
  lead: 'var(--chart-fan-soft)',
} as const

export const LABELS = {
  imbalance: 'Indicated imbalance',
  margin: 'Indicated margin',
} as const

/** The one boundary the rows hold, in words. */
export const BOUNDARY_WORDS = 'boundary N, the whole system'

const IMBALANCE_SIDE: PairSide = { dataset: IMBALNGC, column: IMBALANCE, label: LABELS.imbalance, color: COLORS.imbalance }
const MARGIN_SIDE: PairSide = { dataset: MELNGC, column: MARGIN, label: LABELS.margin, color: COLORS.margin }

/** The page's pair: imbalance (`a`) and margin (`b`). */
export const pairFor = (ctx: PageContext) => pairOf(ctx, IMBALANCE_SIDE, MARGIN_SIDE)

/** Whether the two datasets' issue times differ anywhere, and by how much at most, in words. */
export function mismatchWords(pair: Pair): string {
  if (pair.otherState !== 'paired' || pair.bothHeld === 0) return ''
  if (pair.issueMismatch === 0) return 'Both figures at each half-hour come from the same issue.'
  const n = `${pair.issueMismatch.toLocaleString('en-GB')} of the ${pair.bothHeld.toLocaleString('en-GB')} half-hours both hold`
  return `The two figures’ issue times differ at ${n}, by ${leadText(pair.widestMismatch)} at most; the table gives each one’s.`
}

/** Half-hours held with the imbalance below zero and above it (zero counts as neither). */
export function signCounts(rows: PairRow[]): { below: number; above: number; held: number } {
  let below = 0
  let above = 0
  let held = 0
  for (const r of rows) {
    if (typeof r.a !== 'number') continue
    held += 1
    if (r.a < 0) below += 1
    else if (r.a > 0) above += 1
  }
  return { below, above, held }
}
