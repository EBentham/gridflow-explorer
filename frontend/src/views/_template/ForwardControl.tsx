/**
 * The forward window, after Chart | Table, for a forecast whose rows run past
 * the latest local day (today at the latest): the week to that day, the
 * toolbar's default, or on to the last day held, so the newest issue's days
 * ahead can be seen without typing dates. It sets the toolbar's own custom
 * window (`ctx.range.setCustom`, the same `from` and `to` its date inputs
 * write), and shows only when there are days ahead to open.
 */
import { Segmented } from '../../design/frame'
import { fmtDay, shiftDate } from '../../design/time'
import type { PageContext } from '../define'

export function ForwardControl({ ctx }: { ctx: PageContext }) {
  const range = ctx.range
  const latest = ctx.dataset.coverage?.latest_local_day
  const last = ctx.dataset.coverage?.last_day
  if (!range || !latest || !last || last <= latest) return null
  const ahead = { start: shiftDate(latest, -6), end: last }
  const w = ctx.window
  const on = w && w.start === ahead.start && w.end === ahead.end ? 'ahead' : range.preset === 7 ? 'today' : ''
  return (
    <Segmented
      label="Delivery days"
      options={[
        { value: 'today', label: `Week to ${fmtDay(latest)}` },
        { value: 'ahead', label: `On to ${fmtDay(last)}` },
      ]}
      value={on}
      onChange={(v) => (v === 'ahead' ? range.setCustom(ahead) : range.setPreset(7))}
    />
  )
}
