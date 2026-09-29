/**
 * Which in area the borders are read for: GB's borders by default, or the
 * continental pairs this dataset holds with France or the Netherlands as the
 * in area. The rows split by one column only, so a border (an in and an out
 * area) is read one in area at a time; `?in=fr` or `?in=nl` in the URL. A
 * dataset held for GB only gets no control.
 */
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'
import { IN_AREAS, IN_PARAM } from './areas'

export function InAreaControl({ ctx }: { ctx: PageContext }) {
  const areas = IN_AREAS[ctx.view.id] ?? []
  if (areas.length < 2) return null
  const value = areas.find((a) => a.param === ctx.param(IN_PARAM))?.param ?? 'gb'
  return (
    <div className="gf-range">
      <span className="gf-toolbar-note">In area</span>
      <Segmented label="In area" options={areas.map((a) => ({ value: a.param, label: a.label }))} value={value} onChange={(v) => ctx.setParam(IN_PARAM, v === 'gb' ? null : v)} />
    </div>
  )
}
