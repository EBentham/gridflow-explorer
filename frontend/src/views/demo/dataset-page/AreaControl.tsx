/**
 * FIXTURE demo: a page's own toolbar control. The notices default to GB
 * only (the dataset's default filter); this switch clears that default
 * through `?area=all`, which the view's `query` reads.
 */
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'

const OPTIONS = [
  { value: 'default', label: 'GB only' },
  { value: 'all', label: 'All areas' },
]

export function AreaControl({ ctx }: { ctx: PageContext }) {
  const all = ctx.param('area') === 'all'
  return <Segmented label="Area" options={OPTIONS} value={all ? 'all' : 'default'} onChange={(v) => ctx.setParam('area', v === 'all' ? 'all' : null)} />
}
