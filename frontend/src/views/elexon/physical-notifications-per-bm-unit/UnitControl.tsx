/**
 * The page's own toolbar control, after Chart | Table: the top units (the
 * backend's default read) or one unit (`?unit=`). "One unit" opens the unit
 * selected in the key, else the top-ranked one. The id box offers every unit
 * Elexon's availability forecast lists for the window, named with its fuel,
 * and takes any other id typed in: a typed id is matched to a listed one
 * without regard to case, and only an id the rows endpoint can filter by is
 * sent, so a slip of the keyboard never reaches it as a broken request.
 */
import { Segmented } from '../../../design/frame'
import { validUnitId } from '../../_template/codes'
import { UnitBox } from '../../_template/UnitBox'
import type { PageContext } from '../../define'
import { TOP_N, UNIT_PARAM, fuelLookup, listedUnits, topIds, unitShown } from './figures'

type Mode = 'top' | 'one'

const MODES: { value: Mode; label: string }[] = [
  { value: 'top', label: `Top ${TOP_N}` },
  { value: 'one', label: 'One unit' },
]

export function UnitControl({ ctx }: { ctx: PageContext }) {
  const current = unitShown(ctx)
  const asked = ctx.param(UNIT_PARAM)
  const refused = asked !== null && validUnitId(asked) === null
  const lookup = fuelLookup(ctx)
  const choose = (mode: Mode) => {
    if (mode === 'top') {
      ctx.setParam(UNIT_PARAM, null)
      return
    }
    const next = [ctx.focus, ...topIds(ctx.response), ...lookup.codes.keys()].find((id): id is string => typeof id === 'string' && validUnitId(id) !== null)
    if (next) {
      ctx.setFocus(undefined)
      ctx.setParam(UNIT_PARAM, next)
    }
  }
  return (
    <span className="gf-unit-control">
      <Segmented label="Units" options={MODES} value={current ? 'one' : 'top'} onChange={choose} />
      <UnitBox key={current ?? ''} ctx={ctx} param={UNIT_PARAM} current={current} units={listedUnits(lookup).map((u) => ({ id: u.id, label: u.fuel.label }))} />
      {refused && <span className="gf-toolbar-note">The address asks for a unit id that can’t be one, so the top units are shown.</span>}
      {current && ctx.state === 'empty' && (
        <span className="gf-toolbar-note">
          No rows for <code>{current}</code> in {ctx.windowText}. Check the id, or pick one from the list.
        </span>
      )}
    </span>
  )
}
