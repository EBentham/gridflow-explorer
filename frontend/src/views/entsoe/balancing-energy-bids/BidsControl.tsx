/**
 * The page's own controls: which zone's bids (`?zone=be|fr|de-lu`), which
 * direction (`?dir=a01|a02`) and, for Belgium, which product
 * (`?product=a05|a07`). Belgium, A01 and every product are the defaults, and
 * stay out of the URL. A zone that holds one direction only names it rather
 * than offering a choice that would read an empty window.
 *
 * A window over 7 days of every product can't be read: one bid id can
 * carry both products, so its means would mix two series, and the rows
 * endpoint refuses. Over 7 days the read keeps one product (A05 unless
 * another is picked, `zones.ts`), and the control offers no "All". Any
 * other refusal of that kind still gets the note to pick one.
 */
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'
import { DIRECTIONS, DIR_PARAM, PRODUCT_PARAM, ZONES, ZONE_PARAM, directionOf, oneProductOnly, productFor, productOf, windowDays, zoneOf } from './zones'

const ALL = 'all'

export function BidsControl({ ctx }: { ctx: PageContext }) {
  const zone = zoneOf(ctx.param(ZONE_PARAM))
  const dir = directionOf(zone, ctx.param(DIR_PARAM))
  const days = windowDays(ctx.param)
  const long = oneProductOnly(zone, days)
  const picked = productOf(zone, ctx.param(PRODUCT_PARAM))
  const product = productFor(zone, ctx.param(PRODUCT_PARAM), days)
  const held = DIRECTIONS.filter((d) => zone.directions.includes(d.code))
  const setZone = (param: string) => {
    const next = zoneOf(param)
    const keep = directionOf(next, dir.code)
    ctx.setParams({
      [ZONE_PARAM]: next === ZONES[0] ? null : next.param,
      [DIR_PARAM]: keep.code === next.directions[0] ? null : keep.code.toLowerCase(),
      [PRODUCT_PARAM]: picked && next.products.includes(picked) ? picked.toLowerCase() : null,
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
            options={[...(long ? [] : [{ value: ALL, label: 'All' }]), ...zone.products.map((p) => ({ value: p, label: p }))]}
            value={product ?? ALL}
            onChange={(v) => ctx.setParam(PRODUCT_PARAM, v === ALL ? null : v.toLowerCase())}
          />
          {long && <span className="gf-toolbar-note">A window over 7 days reads one product at a time.</span>}
          {mixed && !long && <span className="gf-toolbar-note">Too long to read with every product: pick one.</span>}
        </div>
      )}
    </>
  )
}
