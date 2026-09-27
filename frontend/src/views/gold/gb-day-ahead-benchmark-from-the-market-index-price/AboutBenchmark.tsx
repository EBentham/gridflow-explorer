/**
 * The side panel: the template's About, then where the benchmark comes
 * from in words, with a link to the market index price page for the same
 * window, which reads the index it is taken from.
 */
import { Link } from 'react-router-dom'
import { About } from '../../_template/panels'
import type { PageContext } from '../../define'
import { MID_ROUTE } from './figures'

export function AboutBenchmark({ ctx }: { ctx: PageContext }) {
  const w = ctx.window
  const to = w ? `${MID_ROUTE}?from=${w.start}&to=${w.end}` : MID_ROUTE
  return (
    <>
      <About ctx={ctx} />
      <p className="gf-hint">
        Gridflow builds this benchmark from Elexon’s market index price, one provider’s (APXMIDP) figure per half-hour. It isn’t a price set in a day-ahead auction. The index it is taken from is on the{' '}
        <Link to={to}>market index price page</Link>
        {w ? `, opened on ${ctx.windowText}` : ''}.
      </p>
    </>
  )
}
