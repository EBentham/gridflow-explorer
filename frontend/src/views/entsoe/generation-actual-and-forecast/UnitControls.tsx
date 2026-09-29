/**
 * The output-by-unit toolbar: the zone, then the production type, as
 * ENTSO-E classes each unit. The rows split by one column only, so units
 * are read one zone and one type at a time; `?zone=` and `?type=` in the
 * URL.
 */
import type { PageContext } from '../../define'
import { TYPE_PARAM, UNIT_TYPES, typeFrom } from './figures'
import { ZoneControl } from './ZoneControl'

export function UnitControls({ ctx }: { ctx: PageContext }) {
  const type = typeFrom(ctx.param)
  return (
    <>
      <ZoneControl ctx={ctx} />
      <label className="gf-range-custom">
        <span>Type</span>
        <select className="gf-select" value={type.code} onChange={(e) => ctx.setParam(TYPE_PARAM, e.target.value === UNIT_TYPES[0].code ? null : e.target.value)}>
          {UNIT_TYPES.map((f) => (
            <option key={f.code} value={f.code}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
    </>
  )
}
