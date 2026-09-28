/**
 * The main panel. In the Chart view, each zone's day-ahead price as a line on
 * the UK clock, with gridflow's GB benchmark on its own axis, in pounds,
 * beneath it. The template's chart would draw a zone that misses a day as a
 * straight line across it, as these rows have no single step and the backend
 * marks no missing step (see NEEDS.md), so this body marks every step a zone
 * doesn't hold with a null (`markGaps`) and hands its own panels to the
 * template's `SeriesChart`. Select a zone in the key to draw it alone: its
 * periods are then named on its own clock, its highest and lowest labelled
 * and its runs below zero banded. In the Table view, the template's table,
 * after a note on Ireland's hourly column. Above either, the days some zone
 * holds only in part, zone by zone.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { dayLabel, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesBody } from '../../_template/SeriesBody'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { seriesId } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, GB_KEY, GB_PRICE, GB_ROUTE, markGaps, partialDaySentences, seriesOf, zoneFigures } from './figures'

export function ZonesBody({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  const zones = useMemo(() => (model && window ? zoneFigures(model, window) : []), [model, window])
  const domain = useMemo<[number, number] | null>(() => (window ? windowDomain(window.start, window.end) : null), [window])
  const rows = useMemo(() => (model && domain ? markGaps(model, zones, domain) : []), [model, zones, domain])
  if (!model || !window || !domain) return null

  const partial = partialDaySentences(zones, window, model.bucketed, dayLabel)
  const held = zones.filter((z) => z.def && z.points.length)
  const hourly = held.filter((z) => z.step !== null && held.some((o) => o.step !== null && o.step < (z.step as number)))
  const notes = partial.length > 0 && (
    <div className="gf-notes">
      <p>{partial.join(' ')}</p>
    </div>
  )

  if (ctx.mode === 'table') {
    return (
      <>
        {notes}
        {hourly.length > 0 && (
          <p className="gf-hint">
            {hourly.map((z) => z.label).join(' and ')} {hourly.length > 1 ? 'are' : 'is'} priced by the hour, so {hourly.length > 1 ? 'their columns hold' : 'its column holds'} a price on each hour’s first quarter-hour and a dash on the three after it. Anywhere else a dash is a step not held locally.
          </p>
        )}
        <SeriesBody ctx={ctx} />
      </>
    )
  }

  const focus = held.find((z) => z.def && seriesId(z.def) === ctx.focus)
  const unit = held[0]?.def?.unit
  let zonePanel: ChartPanel | null = null
  if (focus?.def) {
    const def = focus.def
    zonePanel = {
      // Its own clock only, so each period is named with its own step.
      rows: rows.filter((r) => def.field in r),
      series: [def],
      mark: 'line',
      unit: def.unit,
      stepMs: focus.step,
      bucketed: model.bucketed,
      height: 300,
      extremes: def,
      belowZero: focus.below > 0 ? def : null,
      axisWidth: AXIS_WIDTH,
    }
  } else if (unit) {
    zonePanel = {
      rows,
      series: held.flatMap((z) => (z.def ? [z.def] : [])),
      mark: 'line',
      unit,
      // Quarter-hours and hours share this chart: a tooltip names the instant, not one zone's period.
      stepMs: model.bucketed ? model.stepMs : null,
      bucketed: model.bucketed,
      height: 300,
      axisWidth: AXIS_WIDTH,
    }
  }

  const gb = ctx.related[GB_KEY]
  const gbDef = seriesOf(gb?.series, GB_PRICE)
  const gbPanel: ChartPanel | null =
    gb?.series && gbDef && gbDef.count > 0
      ? {
          rows: gb.series.rows,
          series: [gbDef],
          mark: 'line',
          unit: gbDef.unit,
          stepMs: gb.series.stepMs,
          bucketed: gb.series.bucketed,
          settlement: gb.series.settlement,
          height: 140,
          axisWidth: AXIS_WIDTH,
        }
      : null
  const panels = [zonePanel, gbPanel].filter((p): p is ChartPanel => p !== null)
  const to = `${GB_ROUTE}?from=${window.start}&to=${window.end}`

  return (
    <>
      {notes}
      <SeriesChart panels={panels} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      {gb && (gb.state === 'error' || gb.state === 'refreshing') && (
        <p className="gf-hint">
          GB’s benchmark isn’t drawn under the zones: <ErrorWords error={gb.error} />
        </p>
      )}
      {gb && gb.state !== 'error' && gb.state !== 'refreshing' && !gbPanel && <p className="gf-hint">GB’s benchmark holds no price for this window, so nothing is drawn under the zones.</p>}
      <p className="gf-hint">
        {gbPanel ? 'Under the zones, gridflow’s GB day-ahead benchmark, in pounds and on its own axis. ' : ''}
        It is taken from Elexon’s market index price, a price of short-term trading, not a day-ahead auction, and gridflow holds no exchange rate: read when the prices rise and fall together, not the gap between them. The benchmark has <Link to={to}>its own page</Link>.
      </p>
    </>
  )
}
