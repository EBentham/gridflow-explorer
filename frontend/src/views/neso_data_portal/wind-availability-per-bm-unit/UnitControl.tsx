/**
 * The page's own toolbar control, after Chart | Table: all units, or one
 * unit (`?unit=`). "One unit" opens the largest. The id box offers every
 * unit the window's rows hold, and takes an id typed in, matched to a held
 * one without regard to case; an id the rows don't hold is said in words.
 */
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'
import { UNIT_PARAM, captureFrom, unitAsked, unitMissing, unitShown } from './figures'

const LIST_ID = 'gf-wa-units'

type Mode = 'all' | 'one'

const MODES: { value: Mode; label: string }[] = [
  { value: 'all', label: 'All units' },
  { value: 'one', label: 'One unit' },
]

const collator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' })

/** A pick from the box's list, rather than a key typed: browsers send it as one replacing input. */
function picked(e: ChangeEvent<HTMLInputElement>): boolean {
  const native = e.nativeEvent
  return !(native instanceof InputEvent) || native.inputType === 'insertReplacementText'
}

function UnitBox({ ctx, current }: { ctx: PageContext; current: string | null }) {
  const cap = captureFrom(ctx)
  const ids = cap ? cap.units.map((u) => u.id).sort(collator.compare) : []
  const [draft, setDraft] = useState(current ?? '')
  const show = (value: string) => {
    const v = value.trim()
    if (!v) return
    const held = ids.find((id) => id.toLowerCase() === v.toLowerCase())
    ctx.setFocus(undefined)
    ctx.setParam(UNIT_PARAM, held ?? v)
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    show(draft)
  }
  const change = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setDraft(v)
    if (picked(e) && ids.includes(v) && v !== current) show(v)
  }
  return (
    <form className="gf-wa-unitform" onSubmit={submit}>
      <label className="gf-wa-unitlabel">
        <span className="gf-toolbar-note">Unit id</span>
        <input
          className="gf-input gf-wa-input"
          list={ids.length ? LIST_ID : undefined}
          value={draft}
          placeholder={ids.length ? 'Type or pick one' : 'Type one'}
          spellCheck={false}
          autoComplete="off"
          maxLength={64}
          onChange={change}
        />
      </label>
      {ids.length > 0 && (
        <datalist id={LIST_ID}>
          {ids.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      )}
      <button type="submit" className="gf-filters-clear">
        Show
      </button>
    </form>
  )
}

export function UnitControl({ ctx }: { ctx: PageContext }) {
  const shown = unitShown(ctx)
  const asked = unitAsked(ctx)
  const missing = unitMissing(ctx)
  const cap = captureFrom(ctx)
  const choose = (mode: Mode) => {
    if (mode === 'all') {
      ctx.setParam(UNIT_PARAM, null)
      return
    }
    const next = cap?.units[0]?.id
    if (next) ctx.setParam(UNIT_PARAM, next)
  }
  return (
    <span className="gf-wa-control">
      <Segmented label="Units" options={MODES} value={asked ? 'one' : 'all'} onChange={choose} />
      <UnitBox key={shown?.id ?? asked ?? ''} ctx={ctx} current={shown?.id ?? asked} />
      {missing && (
        <span className="gf-toolbar-note">
          No unit <code>{missing}</code> in {ctx.windowText}.
        </span>
      )}
    </span>
  )
}
