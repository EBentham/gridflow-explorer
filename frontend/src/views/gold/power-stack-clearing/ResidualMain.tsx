/**
 * The residual demand view's main panel. Chart: three lines on one GW axis
 * and the UK clock, each a column as held: demand, the residual demand left
 * after wind and solar, and the clearing demand left for the priced stack
 * after the rest is netted off too; runs of clearing demand below zero are
 * banded. What comes off between them is drawn, on the same clock, in the
 * working panel. Table: the template's table of every column.
 */
import { SeriesBody } from '../../_template/SeriesBody'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import type { SeriesDef } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { windowDomain } from '../../../design/time'
import { AXIS_WIDTH, DEMAND, LINE_COLUMNS } from './figures'

export function ResidualMain({ ctx }: { ctx: PageContext }) {
  if (ctx.mode === 'table') return <SeriesBody ctx={ctx} />
  const model = ctx.series
  if (!model || !ctx.window) return null
  const lines = LINE_COLUMNS.map((c) => model.all.find((d) => d.column === c)).filter((d): d is SeriesDef => d !== undefined && d.count > 0)
  if (!lines.length) return <p className="gf-state">Rows are held for this window, but none of them holds a demand figure to draw. The table lists them.</p>
  const clearing = lines.find((d) => d.column === DEMAND) ?? null
  const panel: ChartPanel = {
    rows: model.rows,
    series: lines,
    mark: 'line',
    unit: lines[0].unit,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    height: 320,
    zero: true,
    belowZero: clearing,
    axisWidth: AXIS_WIDTH,
  }
  return <SeriesChart panels={[panel]} domain={windowDomain(ctx.window.start, ctx.window.end)} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
}
