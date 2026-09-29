/**
 * The by-unit toolbar, after Chart | Table: the window of delivery days,
 * then all units or one (`?unit=`). The id box offers every unit the
 * forecast lists in the window, named with its fuel, and matches a typed id
 * to a listed one without regard to case. The rows are already read for
 * every unit, so choosing one reads nothing more.
 */
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'
import { HorizonControl } from './HorizonControl'
import { UNIT_PARAM, askedUnit, daysOf, keyDay, sortedUnits, unitFuel, unitShown, unitsOf, validUnit, type UnitInfo } from './figures'

const LIST_ID = 'gf-av-units'

type Mode = 'all' | 'one'

const MODES: { value: Mode; label: string }[] = [
  { value: 'all', label: 'All units' },
  { value: 'one', label: 'One unit' },
]

/** The listed id a typed one names, without regard to case; the id as typed when none matches. */
function listedId(units: UnitInfo[], typed: string): string {
  const lower = typed.toLowerCase()
  return units.find((u) => u.id !== null && u.id.toLowerCase() === lower)?.id ?? typed
}

/** A pick from the box's list rather than a key typed: browsers send it as one replacing input. */
function picked(e: ChangeEvent<HTMLInputElement>): boolean {
  const native = e.nativeEvent
  return !(native instanceof InputEvent) || native.inputType === 'insertReplacementText'
}

function UnitBox({ ctx, current, units }: { ctx: PageContext; current: string | null; units: UnitInfo[] }) {
  const [draft, setDraft] = useState(current ?? '')
  const [bad, setBad] = useState(false)
  const show = (value: string) => {
    const id = validUnit(value)
    if (!id) {
      setBad(true)
      return
    }
    setBad(false)
    ctx.setFocus(undefined)
    ctx.setParam(UNIT_PARAM, listedId(units, id))
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    show(draft)
  }
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setDraft(v)
    setBad(false)
    if (picked(e) && units.some((u) => u.id === v) && v !== current) show(v)
  }
  return (
    <form className="gf-av-unitform" onSubmit={submit}>
      <label className="gf-av-unitlabel">
        <span className="gf-toolbar-note">BM unit</span>
        <input className="gf-input gf-av-input" list={units.length ? LIST_ID : undefined} value={draft} placeholder="Type or pick one" spellCheck={false} autoComplete="off" onChange={change} />
      </label>
      {units.length > 0 && (
        <datalist id={LIST_ID}>
          {units.map((u) => (
            <option key={u.key} value={u.id as string} label={unitFuel(u)} />
          ))}
        </datalist>
      )}
      <button type="submit" className="gf-filters-clear">
        Show
      </button>
      {bad && <span className="gf-toolbar-note">A unit id holds only letters, digits, spaces and _ . - / :</span>}
    </form>
  )
}

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
    <span className="gf-av-control">
      <HorizonControl ctx={ctx} />
      <Segmented label="Units" options={MODES} value={asked ? 'one' : 'all'} onChange={choose} />
      <UnitBox key={asked ?? ''} ctx={ctx} current={one?.id ?? asked} units={units} />
      {refused && <span className="gf-toolbar-note">The address asks for a unit id that can’t be one, so every unit is shown.</span>}
      {asked && !one && ctx.response && (
        <span className="gf-toolbar-note">
          No unit <code>{asked}</code> is listed in {ctx.windowText}.
        </span>
      )}
    </span>
  )
}
