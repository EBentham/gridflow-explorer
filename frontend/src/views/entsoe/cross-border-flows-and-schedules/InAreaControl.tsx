/**
 * Which in area the borders are read for: GB's four borders by default, or
 * the continental pairs gridflow holds with France or the Netherlands as the
 * in area. The rows split by one column only, so a border (an in and an out
 * area) is read one in area at a time; `?in=fr` or `?in=nl` in the URL.
 */
import { Segmented } from '../../../design/frame'
import type { PageContext } from '../../define'
import { IN_AREAS, IN_PARAM } from './areas'

const OPTIONS = IN_AREAS.map((a) => ({ value: a.param, label: a.label }))

export function InAreaControl({ ctx }: { ctx: PageContext }) {
  const value = IN_AREAS.find((a) => a.param === ctx.param(IN_PARAM))?.param ?? 'gb'
  return (
    <span className="gf-range">
      <span className="gf-toolbar-note">In area</span>
      <Segmented label="In area" options={OPTIONS} value={value} onChange={(v) => ctx.setParam(IN_PARAM, v === 'gb' ? null : v)} />
    </span>
  )
}
