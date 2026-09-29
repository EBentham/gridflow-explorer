/**
 * The daily forecasts' window, after Chart | Table. The toolbar's windows end
 * on the latest local day, today at the latest, but these forecasts run up to
 * two weeks ahead of it, so this runs the window on to the last delivery day
 * held: the seven days to the latest local day, then every day ahead that a
 * forecast is held for. It sets
 * the template's own custom window (`ctx.range.setCustom`, the same `from`
 * and `to` its date inputs write).
 */
import { Segmented } from '../../../design/frame'
import { fmtDay, shiftDate } from '../../../design/time'
import type { PageContext } from '../../define'

export function HorizonControl({ ctx }: { ctx: PageContext }) {
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
