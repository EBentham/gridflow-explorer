/**
 * The total generation forecast's main panel. In the Chart view, each
 * zone's day-ahead forecast of all its generation as a line on the UK
 * clock. Belgium is forecast per hour and the rest per quarter-hour, so the
 * rows have no single step and the backend marks no missing one (NEEDS.md):
 * each zone's missing steps are marked here on its own clock, so that its
 * line breaks across a day it doesn't hold. Select a zone in the key to draw
 * it alone, its periods named on its own clock and its highest and lowest
 * labelled. In the Table view, the template's table. Above either, the days
 * some zone holds only in part.
 */
import { useMemo } from 'react'
import { dayLabel, windowDomain } from '../../../design/time'
import { SeriesBody } from '../../_template/SeriesBody'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { seriesId } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, commonStep, markGaps, partialDaySentences, perText, type Track } from './figures'
import { zoneForecasts } from './total'

export function TotalBody({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  const zones = useMemo(() => zoneForecasts(ctx), [ctx])
  const domain = useMemo<[number, number] | null>(() => (window ? windowDomain(window.start, window.end) : null), [window])
  if (!model || !window || !domain) return null

  const held = zones.flatMap((z) => (z.gen ? [{ z, gen: z.gen }] : []))
  const tracks: Track[] = held.map((h) => h.gen)
  const partial = partialDaySentences(
    held.map(({ z, gen }) => ({ prose: z.zone.prose, step: gen.step, points: gen.points })),
    window,
    model.bucketed,
    dayLabel,
  )
  const clocks = [...new Set(held.map(({ gen }) => perText(gen.step, model.bucketed)))]
  const clockNote =
    clocks.length > 1
      ? clocks
          .map((c) => {
            const names = held.filter(({ gen }) => perText(gen.step, model.bucketed) === c).map(({ z }) => z.zone.label)
            return `${names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0]} ${c}`
          })
          .join('; ')
      : ''
  const notes = (partial.length > 0 || clockNote) && (
    <div className="gf-notes">
      {clockNote && <p>Forecast {clockNote}: a zone’s line runs on its own clock.</p>}
      {partial.length > 0 && <p>{partial.join(' ')}</p>}
    </div>
  )

  if (ctx.mode === 'table') {
    return (
      <>
        {notes}
        {clocks.length > 1 && <p className="gf-hint">A zone forecast per hour holds a value on each hour’s first quarter-hour and a dash on the three after it. Anywhere else a dash is a step not held locally.</p>}
        <SeriesBody ctx={ctx} />
      </>
    )
  }

  const rows = markGaps(model.rows, tracks, domain)
  const focus = held.find(({ gen }) => seriesId(gen.def) === ctx.focus)
  const panel: ChartPanel | null = focus
    ? {
        // Its own clock only, so each period is named with its own step.
        rows: rows.filter((r) => focus.gen.def.field in r),
        series: [focus.gen.def],
        mark: 'line',
        unit: focus.gen.def.unit,
        stepMs: focus.gen.step,
        bucketed: model.bucketed,
        height: 300,
        extremes: focus.gen.def,
        axisWidth: AXIS_WIDTH,
      }
    : tracks.length
      ? {
          rows,
          series: tracks.map((k) => k.def),
          mark: 'line',
          unit: tracks[0].def.unit,
          // Quarter-hours and hours share this chart: a tooltip names the instant unless they agree.
          stepMs: commonStep(tracks),
          bucketed: model.bucketed,
          height: 300,
          axisWidth: AXIS_WIDTH,
        }
      : null

  return (
    <>
      {notes}
      {panel ? <SeriesChart panels={[panel]} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} /> : <p className="gf-state">Rows are held for this window, but none of them holds a forecast value.</p>}
      <p className="gf-hint">Each zone’s forecast, made the day before, of all the electricity it would generate. The working panel sets one zone’s against its day-ahead load forecast.</p>
    </>
  )
}
