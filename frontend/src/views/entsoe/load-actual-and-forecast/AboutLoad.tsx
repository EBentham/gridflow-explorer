/**
 * The side panel: the template's About, then where GB is. These four zones
 * are GB's continental neighbours; GB's own demand is on Elexon's demand
 * outturn page, linked for the same window.
 */
import { Link } from 'react-router-dom'
import { About } from '../../_template/panels'
import type { PageContext } from '../../define'
import { GB_DEMAND_ROUTE } from './figures'

export function AboutLoad({ ctx }: { ctx: PageContext }) {
  const w = ctx.window
  const to = w ? `${GB_DEMAND_ROUTE}?from=${w.start}&to=${w.end}` : GB_DEMAND_ROUTE
  return (
    <>
      <About ctx={ctx} />
      <p className="gf-hint">
        GB isn’t among these zones: ENTSO-E hasn’t published GB’s load since Brexit. GB’s own demand, half-hour by half-hour, is on the <Link to={to}>demand outturn page</Link>
        {w ? `, opened on ${ctx.windowText}` : ''}.
      </p>
    </>
  )
}
