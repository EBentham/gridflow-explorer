/**
 * The page's own controls: which zone's bids (`?zone=be|fr|de-lu`) and which
 * direction (`?dir=a01|a02`). Belgium and A01 are the defaults, and stay out
 * of the URL. A zone that holds one direction only names it rather than
 * offering a choice that would read an empty window.
 */
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'
import { DIRECTIONS, DIR_PARAM, ZONES, ZONE_PARAM, directionOf, zoneOf } from './zones'

export function BidsControl({ ctx }: { ctx: PageContext }) {
  const zone = zoneOf(ctx.param(ZONE_PARAM))
  const dir = directionOf(zone, ctx.param(DIR_PARAM))
  const held = DIRECTIONS.filter((d) => zone.directions.includes(d.code))
  const setZone = (param: string) => {
    const next = zoneOf(param)
    const keep = directionOf(next, dir.code)
    ctx.setParams({ [ZONE_PARAM]: next === ZONES[0] ? null : next.param, [DIR_PARAM]: keep.code === next.directions[0] ? null : keep.code.toLowerCase() })
  }
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
    </>
  )
}
