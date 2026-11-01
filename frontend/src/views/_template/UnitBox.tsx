/**
 * The BM unit id box, for a page's own toolbar control: every unit offered
 * in a list (named, when the page can name them), and any other id typed
 * in. A typed id is matched to a listed one without regard to case, a pick
 * from the list shows at once, and only an id the rows endpoint can filter
 * by is written to the page's parameter, so a slip of the keyboard never
 * reaches it as a broken request.
 */
import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import type { PageContext } from '../define'
import { validUnitId } from './codes'

export interface UnitOption {
  id: string
  /** Shown beside the id in the list: its fuel, say. */
  label?: string
}

/** A pick from the box's list, rather than a key typed: browsers send it as one replacing input. */
function picked(e: ChangeEvent<HTMLInputElement>): boolean {
  const native = e.nativeEvent
  return !(native instanceof InputEvent) || native.inputType === 'insertReplacementText'
}

/** Remount it with `key={current}` so the box shows the unit the page shows. */
export function UnitBox({ ctx, param, current, units, label = 'Unit id' }: { ctx: PageContext; param: string; current: string | null; units: UnitOption[]; label?: string }) {
  const listId = useId()
  const [draft, setDraft] = useState(current ?? '')
  const [bad, setBad] = useState(false)
  const show = (value: string) => {
    const id = validUnitId(value)
    if (!id) {
      setBad(true)
      return
    }
    setBad(false)
    const lower = id.toLowerCase()
    ctx.setFocus(undefined)
    ctx.setParam(param, units.find((u) => u.id === id)?.id ?? units.find((u) => u.id.toLowerCase() === lower)?.id ?? id)
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
    <form className="gf-unit-form" onSubmit={submit}>
      <label className="gf-unit-label">
        <span className="gf-toolbar-note">{label}</span>
        <input
          className="gf-input gf-unit-input"
          list={units.length ? listId : undefined}
          value={draft}
          placeholder={units.length ? 'Type or pick one' : 'Type one'}
          spellCheck={false}
          autoComplete="off"
          maxLength={64}
          onChange={change}
        />
      </label>
      {units.length > 0 && (
        <datalist id={listId}>
          {units.map((u) => (
            <option key={u.id} value={u.id} label={u.label} />
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
