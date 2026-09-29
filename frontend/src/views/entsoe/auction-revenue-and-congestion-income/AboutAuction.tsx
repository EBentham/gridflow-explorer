/**
 * The side panel: the template's About, then what the family's two datasets
 * are in words, and why congestion income isn't held. The cause is said in
 * the page's own words, never printed as the source list holds it.
 */
import { About } from '../../_template/panels'
import type { PageContext } from '../../define'
import { CONGESTION } from './figures'

export function AboutAuction({ ctx }: { ctx: PageContext }) {
  const congestion = ctx.family.datasets.find((d) => d.id === CONGESTION)
  return (
    <>
      <About ctx={ctx} />
      <p className="gf-hint">
        Auction revenue is what ENTSO-E reports as raised each hour by the explicit auctions of capacity on a border. The rows held name GB as the in area and the
        Netherlands or Belgium as the out area, and carry no currency of their own: the amounts are read as euros from the column’s name and gridflow’s research.
      </p>
      {congestion && !congestion.held && (
        <p className="gf-hint">
          Congestion income, the family’s other dataset, isn’t held. gridflow asked ENTSO-E for the congestion income of implicit and flow-based allocation, and every
          answer was empty. GB’s borders are allocated by explicit auction, so gridflow’s research expected nothing for them.
        </p>
      )}
    </>
  )
}
