/**
 * The working panel for both datasets: the template's issued-pair panel,
 * generation's range first, then demand's with its sign flipped.
 */
import { boundaryName, boundaryOf } from '../../_template/boundaries'
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
      own={pair.ownIsA ? 'generation' : 'demand'}
      heads={{ a: 'Generation', b: 'Demand flipped' }}
      order={['a', 'b']}
      where={boundaryName(boundaryOf(ctx)).replace(/^b/, 'B')}
      note="Demand is the held figure with its sign flipped, so its highest is the half-hour of most demand"
      leadColor={COLORS.lead}
      axisWidth={AXIS_WIDTH}
    />
  )
}
