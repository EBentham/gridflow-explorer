/**
 * The toolbar's zone switch, on the datasets read one zone at a time: the
 * wind and solar forecast (five zones) and the output by unit (three). The
 * choice is `?zone=` in the URL and carries across the two; a zone one of
 * them doesn't hold opens that one on its first zone.
 */
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'
import { UNIT_ZONES, UNITS_ID, WS_ZONES, ZONE_PARAM, zoneFrom } from './figures'

export function ZoneControl({ ctx }: { ctx: PageContext }) {
  const zones = ctx.dataset.id === UNITS_ID ? UNIT_ZONES : WS_ZONES
  const zone = zoneFrom(ctx.param, zones)
  return (
    <div className="gf-range">
      <span className="gf-toolbar-note">Zone</span>
      <Segmented label="Zone" options={zones.map((z) => ({ value: z.param, label: z.label }))} value={zone.param} onChange={(v) => ctx.setParam(ZONE_PARAM, v === zones[0].param ? null : v)} />
    </div>
  )
}
