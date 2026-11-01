/**
 * The working panel for both datasets: the template's issued-pair panel,
 * the page's own figure's range first, as in the main table.
 */
import { PairIssuePanel } from '../../_template/PairIssuePanel'
import { AXIS_WIDTH } from '../../_template/SeriesChart'
import type { PageContext } from '../../define'
import { COLORS, pairFor } from './figures'

export function IssuePanel({ ctx }: { ctx: PageContext }) {
  const pair = pairFor(ctx)
  if (!pair) return <p className="gf-hint">Nothing is held in this window, so there is no issue to read and no day to summarise.</p>
  return (
    <PairIssuePanel
      ctx={ctx}
      pair={pair}
      own={pair.ownIsA ? 'imbalance' : 'margin'}
      heads={{ a: 'Imbalance', b: 'Margin' }}
      order={pair.ownIsA ? ['a', 'b'] : ['b', 'a']}
      where="Boundary N"
      leadColor={COLORS.lead}
      axisWidth={AXIS_WIDTH}
    />
  )
}
