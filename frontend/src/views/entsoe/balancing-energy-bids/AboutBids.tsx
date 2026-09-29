/**
 * The side panel: the template's About, then the codes the rows carry, in
 * words where gridflow gives words for them and as published where it
 * doesn't.
 */
import { About } from '../../_template/panels'
import type { PageContext } from '../../define'
import { pageBook } from './figures'

export function AboutBids({ ctx }: { ctx: PageContext }) {
  const { zone, dir, product, pinned } = pageBook(ctx)
  return (
    <>
      <About ctx={ctx} />
      <dl className="gf-facts">
        <div>
          <dt>Zone</dt>
          <dd>
            <code>{zone.code}</code> {zone.name}
          </dd>
        </div>
        <div>
          <dt>Direction</dt>
          <dd>
            <code>{dir.code}</code>, {dir.reading} in ENTSO-E’s code list, as gridflow reads it in its activated-balancing tables. This table keeps the code as published.
          </dd>
        </div>
        <div>
          <dt>Bids</dt>
          <dd>
            <code>bid_mrid</code> is the bid’s id within its zone. The same id can recur in the other direction or for another product, so the page reads one direction at a time.
          </dd>
        </div>
        <div>
          <dt>Products</dt>
          <dd>
            Each bid carries a product code (<code>standard_market_product</code>), and gridflow gives no words for these codes.{' '}
            {product ? (
              <>
                This read keeps <code>{product}</code> only{pinned ? ', as a window over 7 days reads one product at a time' : ''}.
              </>
            ) : (
              'This read adds every product’s bids together.'
            )}
          </dd>
        </div>
      </dl>
    </>
  )
}
