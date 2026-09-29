/**
 * The output-by-unit main panel. In the Chart view, the largest units of the
 * zone and type in view, by mean output over the window, one line each in
 * MW. Units report per quarter-hour or per hour, so the rows have no single
 * step (NEEDS.md): each unit's missing steps are marked here on its own
 * clock, so that its line breaks across a day it doesn't hold. Select a unit
 * in the key, or any unit in the working panel's table, to draw it alone
 * with its highest and lowest labelled. In the Table view, the template's
 * table of every unit.
 */
import { useMemo } from 'react'
import { plural } from '../../../design/format'
import { windowDomain } from '../../../design/time'
import { SeriesBody } from '../../_template/SeriesBody'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, commonStep, markGaps, perText } from './figures'
import { focusedUnit, unitsOf, UNITS_DRAWN } from './units'

export function UnitsBody({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  const u = useMemo(() => unitsOf(ctx), [ctx])
  const domain = useMemo<[number, number] | null>(() => (window ? windowDomain(window.start, window.end) : null), [window])
  if (!model || !window || !domain || !u) return null
  if (!u.units.length) return <p className="gf-state">Rows are held for this window, but none of them holds an output value.</p>

  const steps = [...new Set(u.units.map((r) => perText(r.track.step, u.bucketed)))]
  const count = `${plural(u.units.length, 'unit', 'units')} classed as ${u.type.label.toLowerCase()} in ${u.zone.prose} ${u.units.length === 1 ? 'holds' : 'hold'} output in this window`
  const note = (
    <div className="gf-notes">
      <p>
        {count}
        {u.units.length > UNITS_DRAWN && ctx.mode === 'chart' ? `; the chart draws the ${UNITS_DRAWN} with the highest mean output, and the working panel lists every one` : ''}.{steps.length > 1 ? ` Units report on different clocks here (${steps.join(', ')}): each line runs on its own.` : ''}
      </p>
    </div>
  )
  if (ctx.mode === 'table') {
    return (
      <>
        {note}
        <SeriesBody ctx={ctx} />
      </>
    )
  }

  const focus = focusedUnit(ctx, u)
  const tracks = focus ? [focus.track] : u.units.filter((r) => r.drawn).map((r) => r.track)
  const series = focus ? [{ ...focus.track.def, color: focus.drawn?.color ?? 'var(--chart-price)' }] : u.drawn
  const rows = markGaps(model.rows, tracks, domain)
  const panel: ChartPanel = {
    rows: focus ? rows.filter((r) => focus.track.def.field in r) : rows,
    series,
    mark: 'line',
    unit: series[0].unit,
    stepMs: commonStep(tracks),
    bucketed: model.bucketed,
    height: 300,
    zero: true,
    extremes: focus ? series[0] : null,
    axisWidth: AXIS_WIDTH,
  }
  return (
    <>
      {note}
      <SeriesChart panels={[panel]} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      <p className="gf-hint">
        {focus ? 'One unit’s output as ENTSO-E publishes it, alone.' : 'Each unit’s output as ENTSO-E publishes it, from zero.'} Units are named by their ENTSO-E code: the rows carry no names.
      </p>
    </>
  )
}
