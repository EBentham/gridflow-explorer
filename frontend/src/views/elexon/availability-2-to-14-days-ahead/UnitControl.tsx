/**
 * The by-unit toolbar, after Chart | Table: all units or one (`?unit=`). The id box offers every unit the
 * forecast lists in the window, named with its fuel, and matches a typed id
 * to a listed one without regard to case. The rows are already read for
 * every unit, so choosing one reads nothing more.
 */
import { Segmented } from '../../../design/frame'
import { UnitBox } from '../../_template/UnitBox'
import type { PageContext } from '../../define'
import { UNIT_PARAM, askedUnit, daysOf, keyDay, sortedUnits, unitFuel, unitShown, unitsOf } from './figures'

type Mode = 'all' | 'one'

const MODES: { value: Mode; label: string }[] = [
  { value: 'all', label: 'All units' },
  { value: 'one', label: 'One unit' },
]

export function UnitControl({ ctx }: { ctx: PageContext }) {
  const units = sortedUnits(unitsOf(ctx.response)).filter((u) => u.id !== null)
  const asked = askedUnit(ctx)
  const one = unitShown(ctx)
  const refused = ctx.param(UNIT_PARAM) !== null && asked === null
  const choose = (mode: Mode) => {
    if (mode === 'all') {
      ctx.setParam(UNIT_PARAM, null)
      return
    }
    // The largest unit on the key's day, as the units table lists it first.
    const day = keyDay(ctx, daysOf(ctx.response, ctx.window, 'unit'))
    const first = day ? [...units].sort((a, b) => (b.byDate.get(day.date)?.mw ?? -Infinity) - (a.byDate.get(day.date)?.mw ?? -Infinity))[0] : units[0]
    if (first?.id) {
      ctx.setFocus(undefined)
      ctx.setParam(UNIT_PARAM, first.id)
    }
  }
  return (
    <span className="gf-unit-control">
      <Segmented label="Units" options={MODES} value={asked ? 'one' : 'all'} onChange={choose} />
      <UnitBox key={asked ?? ''} ctx={ctx} param={UNIT_PARAM} current={one?.id ?? asked} units={units.map((u) => ({ id: u.id as string, label: unitFuel(u) }))} label="BM unit" />
      {refused && <span className="gf-toolbar-note">The address asks for a unit id that can’t be one, so every unit is shown.</span>}
      {asked && !one && ctx.response && (
        <span className="gf-toolbar-note">
          No unit <code>{asked}</code> is listed in {ctx.windowText}.
        </span>
      )}
    </span>
  )
}
