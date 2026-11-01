/**
 * The page's own toolbar control, after Chart | Table: all units, or one
 * unit (`?unit=`). "One unit" opens the largest. The id box offers every
 * unit the window's rows hold, and takes an id typed in, matched to a held
 * one without regard to case; an id the rows don't hold is said in words.
 */
import { Segmented } from '../../../design/frame'
import { collator } from '../../_template/seriesModel'
import { UnitBox } from '../../_template/UnitBox'
import type { PageContext } from '../../define'
import { UNIT_PARAM, captureFrom, unitAsked, unitMissing, unitShown } from './figures'

type Mode = 'all' | 'one'

const MODES: { value: Mode; label: string }[] = [
  { value: 'all', label: 'All units' },
  { value: 'one', label: 'One unit' },
]

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
    <span className="gf-unit-control">
      <Segmented label="Units" options={MODES} value={asked ? 'one' : 'all'} onChange={choose} />
      <UnitBox key={shown?.id ?? asked ?? ''} ctx={ctx} param={UNIT_PARAM} current={shown?.id ?? asked} units={(cap?.units.map((u) => u.id) ?? []).sort(collator.compare).map((id) => ({ id }))} />
      {missing && (
        <span className="gf-toolbar-note">
          No unit <code>{missing}</code> in {ctx.windowText}.
        </span>
      )}
    </span>
  )
}
