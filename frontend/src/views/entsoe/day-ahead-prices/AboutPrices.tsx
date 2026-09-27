/**
 * The side panel: the template's About, then why there is no GB zone, and
 * what the GB line under the zones is and isn't, with a link to the GB
 * benchmark's own page for the same window.
 */
import { Link } from 'react-router-dom'
import { About } from '../../_template/panels'
import type { PageContext } from '../../define'
import { GB_ROUTE } from './figures'

export function AboutPrices({ ctx }: { ctx: PageContext }) {
  const w = ctx.window
  const to = w ? `${GB_ROUTE}?from=${w.start}&to=${w.end}` : GB_ROUTE
  return (
    <>
      <About ctx={ctx} />
      <p className="gf-hint">
        No GB zone: gridflow asks ENTSO-E for GB’s day-ahead price with these five, and ENTSO-E has published none for GB since Brexit.
      </p>
      <p className="gf-hint">
        The line under the zones is gridflow’s GB day-ahead benchmark, in pounds. It is taken from Elexon’s market index price, a price of short-term trading, not a day-ahead auction. gridflow holds no exchange rate, so this page works out no spread between GB and the zones. The benchmark has{' '}
        <Link to={to}>its own page</Link>
        {w ? `, opened on ${ctx.windowText}` : ''}.
      </p>
    </>
  )
}
