/**
 * The main panel. In the Chart view: NESO's index strip over the two lines,
 * the forecast and the estimated actual per half-hour on one gCO₂/kWh axis,
 * the estimate's highest and lowest labelled (or the selected line's). Gaps
 * stay gaps: a half-hour not held breaks both lines and leaves the strip
 * bare. In the Table view, the template's table of every row, the index
 * included.
 */
import { windowDomain } from '../../../design/time'
import { SeriesBody } from '../../_template/SeriesBody'
import { SeriesChart } from '../../_template/SeriesChart'
import { planPanels } from '../../_template/seriesPanels'
import { meansText } from '../../_template/text'
import type { SeriesRowsResponse } from '../../contract'
import type { PageContext } from '../../define'
import { gradesByTime } from './figures'
import { IndexStrip } from './IndexStrip'

export function IntensityMain({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model || !ctx.window) return null
  if (ctx.mode === 'table') return <SeriesBody ctx={ctx} />
  const plan = planPanels(ctx)
  const domain = windowDomain(ctx.window.start, ctx.window.end)
  const grades = gradesByTime(ctx.response as SeriesRowsResponse | null)
  return (
    <>
      {grades.size > 0 && <IndexStrip model={model} grades={grades} domain={domain} />}
      <SeriesChart panels={plan.panels} domain={domain} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      {grades.size === 0 && model.bucketed && model.stepMs !== null && (
        <p className="gf-hint">No index strip: this window is read as {meansText(model.stepMs)}, and a mean carries no grade.</p>
      )}
      {grades.size === 0 && !model.bucketed && <p className="gf-hint">No index strip: none of the half-hours held in this window carries NESO’s grade.</p>}
    </>
  )
}
