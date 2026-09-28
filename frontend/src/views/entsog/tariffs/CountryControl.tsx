/**
 * The tariff tables' country switch: UK by default, every country through
 * `?country=all`, which the view's `query` reads.
 */
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'

const OPTIONS = [
  { value: 'uk', label: 'UK' },
  { value: 'all', label: 'All countries' },
]

export function CountryControl({ ctx }: { ctx: PageContext }) {
  const all = ctx.param('country') === 'all'
  return <Segmented label="Country" options={OPTIONS} value={all ? 'all' : 'uk'} onChange={(v) => ctx.setParam('country', v === 'all' ? 'all' : null)} />
}
