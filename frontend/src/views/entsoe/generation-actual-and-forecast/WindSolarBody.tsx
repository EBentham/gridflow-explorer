/**
 * The wind and solar forecast's main panel. In the Chart view, the zone's
 * day-ahead forecast of onshore wind, offshore wind (hatched) and solar,
 * stacked, with the zone's total generation forecast as a line under it on
 * the same clock. Every step a type doesn't hold is a gap: the rows have no
 * single step (see NEEDS.md), so each type's missing steps are marked here
 * on its own clock before the template's `SeriesChart` draws them. Select a
 * type in the key to draw it alone, with its highest and lowest labelled.
 * In the Table view, the template's table. Above either, the days held in
 * part and the types the zone holds none of.
 */
import { useMemo } from 'react'
import { dayLabel, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesBody } from '../../_template/SeriesBody'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { seriesId } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, commonStep, focusedDef, markGaps, partialDaySentences, perText } from './figures'
import { WindHatch } from './WindHatch'
import { missingText, windSolarOf } from './windSolar'

export function WindSolarBody({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  const ws = useMemo(() => windSolarOf(ctx), [ctx])
  const domain = useMemo<[number, number] | null>(() => (window ? windowDomain(window.start, window.end) : null), [window])
  if (!model || !window || !domain || !ws) return null

  const zone = ws.zone
  const step = commonStep(ws.held)
  const partial = partialDaySentences(
    ws.types.flatMap((x) => (x.track ? [{ prose: x.type.prose, step: x.track.step, points: x.track.points }] : [])),
    window,
    model.bucketed,
    dayLabel,
  )
  const missing = ws.missing.length > 0 && ws.held.length > 0 ? `No ${missingText(ws)} forecast is held for ${zone.prose} in this window.` : ''
  const notes = (partial.length > 0 || missing) && (
    <div className="gf-notes">
      {missing && <p>{missing}</p>}
      {partial.length > 0 && <p>{partial.join(' ')}</p>}
    </div>
  )

  if (ctx.mode === 'table') {
    return (
      <>
        {notes}
        <SeriesBody ctx={ctx} />
      </>
    )
  }

  // A focused offshore band is drawn and labelled in wind's colour: its hatch can't colour a line or a label.
  const defs = ws.held.map((k) => (k.def.group === 'B18' && ctx.focus && seriesId(k.def) === ctx.focus ? { ...k.def, color: 'var(--fuel-wind)' } : k.def))
  if (!defs.length) return <p className="gf-state">Rows are held for {zone.prose} in this window, but none of them holds a forecast value.</p>
  const focus = focusedDef(ctx, defs)
  const names = ws.types.filter((x) => x.track).map((x) => (x.type.code === 'B18' ? `${x.type.prose} (hatched)` : x.type.prose))
  const stackText = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]
  const rows = markGaps(model.rows, ws.held, domain)
  const upper: ChartPanel = {
    rows,
    series: defs,
    mark: 'stacked',
    unit: defs[0].unit,
    stepMs: step,
    bucketed: model.bucketed,
    height: 260,
    extremes: focus ?? null,
    axisWidth: AXIS_WIDTH,
  }
  const total = ws.total
  const totalModel = ws.totalRead?.series
  const lower: ChartPanel | null =
    total && totalModel
      ? {
          rows: markGaps(totalModel.rows, [total], domain),
          series: [{ ...total.def, label: `Total generation forecast, ${zone.label}`, color: 'var(--chart-actual)' }],
          mark: 'line',
          unit: total.def.unit,
          stepMs: total.step,
          bucketed: totalModel.bucketed,
          height: 150,
          axisWidth: AXIS_WIDTH,
        }
      : null
  const read = ws.totalRead
  const failed = read && (read.state === 'error' || read.state === 'refreshing')

  return (
    <>
      <WindHatch />
      {notes}
      <SeriesChart panels={lower ? [upper, lower] : [upper]} domain={domain} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      {failed && (
        <p className="gf-hint">
          The total generation forecast isn’t drawn under the stack: <ErrorWords error={read.error} />
        </p>
      )}
      {!failed && !lower && <p className="gf-hint">No total generation forecast is held for {zone.prose} in this window, so nothing is drawn under the stack.</p>}
      <p className="gf-hint">
        {defs.length > 1 ? `Stacked, bottom up: ${stackText}, each` : `${stackText.charAt(0).toUpperCase()}${stackText.slice(1)}`} as forecast the day before, {perText(step, model.bucketed)}.{lower ? ` Under it, ${zone.prose}’s total generation forecast, a separate ENTSO-E forecast, on the same clock.` : ''} A step a type isn’t held for is a gap in its band.
      </p>
    </>
  )
}
