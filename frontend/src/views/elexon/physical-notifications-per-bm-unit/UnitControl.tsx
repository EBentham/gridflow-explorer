/**
 * The page's own toolbar control, after Chart | Table: the top units (the
 * backend's default read) or one unit (`?unit=`). "One unit" opens the unit
 * selected in the key, else the top-ranked one. The id box offers every unit
 * Elexon's availability forecast lists for the window, named with its fuel,
 * and takes any other id typed in: a typed id is matched to a listed one
 * without regard to case, and only an id the rows endpoint can filter by is
 * sent, so a slip of the keyboard never reaches it as a broken request.
 */
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'
import { TOP_N, UNIT_PARAM, fuelLookup, listedId, listedUnits, topIds, unitShown, validUnit } from './figures'

const LIST_ID = 'gf-pn-units'

type Mode = 'top' | 'one'

const MODES: { value: Mode; label: string }[] = [
  { value: 'top', label: `Top ${TOP_N}` },
  { value: 'one', label: 'One unit' },
]

/** A pick from the box's list, rather than a key typed: browsers send it as one replacing input. */
function picked(e: ChangeEvent<HTMLInputElement>): boolean {
  const native = e.nativeEvent
  return !(native instanceof InputEvent) || native.inputType === 'insertReplacementText'
}

function UnitBox({ ctx, current }: { ctx: PageContext; current: string | null }) {
  const lookup = fuelLookup(ctx)
  const units = listedUnits(lookup)
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
    ctx.setParam(UNIT_PARAM, listedId(lookup, id))
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    show(draft)
  }
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setDraft(v)
    setBad(false)
    if (picked(e) && lookup.codes.has(v) && v !== current) show(v)
  }
  return (
    <form className="gf-pn-unitform" onSubmit={submit}>
      <label className="gf-pn-unitlabel">
        <span className="gf-toolbar-note">Unit id</span>
        <input
          className="gf-input gf-pn-input"
          list={units.length ? LIST_ID : undefined}
          value={draft}
          placeholder={units.length ? 'Type or pick one' : 'Type one'}
          spellCheck={false}
          autoComplete="off"
          onChange={change}
        />
      </label>
      {units.length > 0 && (
        <datalist id={LIST_ID}>
          {units.map((u) => (
            <option key={u.id} value={u.id} label={u.fuel.label} />
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
  const current = unitShown(ctx)
  const asked = ctx.param(UNIT_PARAM)
  const refused = asked !== null && validUnit(asked) === null
  const lookup = fuelLookup(ctx)
  const choose = (mode: Mode) => {
    if (mode === 'top') {
      ctx.setParam(UNIT_PARAM, null)
      return
    }
    const next = [ctx.focus, ...topIds(ctx.response), ...lookup.codes.keys()].find((id): id is string => typeof id === 'string' && validUnit(id) !== null)
    if (next) {
      ctx.setFocus(undefined)
      ctx.setParam(UNIT_PARAM, next)
    }
  }
  return (
    <span className="gf-pn-control">
      <Segmented label="Units" options={MODES} value={current ? 'one' : 'top'} onChange={choose} />
      <UnitBox key={current ?? ''} ctx={ctx} current={current} />
      {refused && <span className="gf-toolbar-note">The address asks for a unit id that can’t be one, so the top units are shown.</span>}
      {current && ctx.state === 'empty' && (
        <span className="gf-toolbar-note">
          No rows for <code>{current}</code> in {ctx.windowText}. Check the id, or pick one from the list.
        </span>
      )}
    </span>
  )
}
