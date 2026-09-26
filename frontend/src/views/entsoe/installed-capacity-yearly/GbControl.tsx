/**
 * The unit list's area switch: GB's units by default, every area's through
 * `?area=all`, which the view's `query` reads.
 */
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'

const OPTIONS = [
  { value: 'gb', label: 'GB' },
  { value: 'all', label: 'All areas' },
]

export function GbControl({ ctx }: { ctx: PageContext }) {
  const all = ctx.param('area') === 'all'
  return <Segmented label="Area" options={OPTIONS} value={all ? 'all' : 'gb'} onChange={(v) => ctx.setParam('area', v === 'all' ? 'all' : null)} />
}
