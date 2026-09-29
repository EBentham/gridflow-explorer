/**
 * The page's own controls: which zone's bids (`?zone=be|fr|de-lu`), which
 * direction (`?dir=a01|a02`) and, for Belgium, which product
 * (`?product=a05|a07`). Belgium, A01 and every product are the defaults, and
 * stay out of the URL. A zone that holds one direction only names it rather
 * than offering a choice that would read an empty window.
 *
 * A long window of every product can't be read: one bid id can carry both
 * products, so its means would mix two series, and the rows endpoint
 * refuses. The main panel's error says to choose a shorter window; the
 * product control adds that picking one product reads it too.
 */
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'
import { DIRECTIONS, DIR_PARAM, PRODUCT_PARAM, ZONES, ZONE_PARAM, directionOf, productOf, zoneOf } from './zones'

const ALL = 'all'

export function BidsControl({ ctx }: { ctx: PageContext }) {
  const zone = zoneOf(ctx.param(ZONE_PARAM))
  const dir = directionOf(zone, ctx.param(DIR_PARAM))
  const product = productOf(zone, ctx.param(PRODUCT_PARAM))
  const held = DIRECTIONS.filter((d) => zone.directions.includes(d.code))
  const setZone = (param: string) => {
    const next = zoneOf(param)
    const keep = directionOf(next, dir.code)
    ctx.setParams({
      [ZONE_PARAM]: next === ZONES[0] ? null : next.param,
      [DIR_PARAM]: keep.code === next.directions[0] ? null : keep.code.toLowerCase(),
      [PRODUCT_PARAM]: product && next.products.includes(product) ? product.toLowerCase() : null,
    })
  }
  const mixed = ctx.state === 'error' && ctx.error?.status === 413 && ctx.error.reason === 'mixed_identity' && product === null
  return (
    <>
      <div className="gf-range">
        <span className="gf-toolbar-note">Zone</span>
        <Segmented label="Zone" options={ZONES.map((z) => ({ value: z.param, label: z.short }))} value={zone.param} onChange={setZone} />
      </div>
      <div className="gf-range">
        <span className="gf-toolbar-note">Direction</span>
        {held.length > 1 ? (
          <Segmented
            label="Direction"
            options={held.map((d) => ({ value: d.code, label: d.label }))}
            value={dir.code}
            onChange={(code) => ctx.setParam(DIR_PARAM, code === held[0].code ? null : code.toLowerCase())}
          />
        ) : (
          <span className="gf-toolbar-note">{dir.label} only</span>
        )}
      </div>
      {zone.products.length > 1 && (
        <div className="gf-range">
          <span className="gf-toolbar-note">Product</span>
          <Segmented
            label="Product"
            options={[{ value: ALL, label: 'All' }, ...zone.products.map((p) => ({ value: p, label: p }))]}
            value={product ?? ALL}
            onChange={(v) => ctx.setParam(PRODUCT_PARAM, v === ALL ? null : v.toLowerCase())}
          />
          {mixed && <span className="gf-toolbar-note">Too long to read with every product: pick one.</span>}
        </div>
      )}
    </>
  )
}
