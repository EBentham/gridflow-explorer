/**
 * The released-capacity switch between entry and exit statements. The rows
 * form one series per point only within a direction, so the page reads one
 * direction at a time: entry by default, exit through `?direction=exit`.
 */
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'

const OPTIONS = [
  { value: 'entry', label: 'Entry' },
  { value: 'exit', label: 'Exit' },
]

export function DirectionControl({ ctx }: { ctx: PageContext }) {
  const exit = ctx.param('direction') === 'exit'
  return <Segmented label="Direction" options={OPTIONS} value={exit ? 'exit' : 'entry'} onChange={(v) => ctx.setParam('direction', v === 'exit' ? 'exit' : null)} />
}
