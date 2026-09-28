/**
 * National demand's working panel. In the Chart view, transmission demand
 * less national demand per half-hour as bars, on the main chart's clock and
 * value-axis width: the two curves run close enough that the gap between
 * them is easier read on its own. Then each UK day: the half-hours of
 * national demand held, its mean, trough and peak, and the mean gap over the
 * half-hours both measures hold. Select a day to mark it on every chart.
 */
import { plural } from '../../../design/format'
import { dayLabel, stepNoun, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { daySummaries, type SeriesDef } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, COLORS, INDO, ITSDO, TSD_KEY, gapRows, seriesOf, sumsByDay } from './figures'

export function GapPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const national = seriesOf(model, INDO)
  if (!model || !ctx.window || !national || !national.count) {
    return <p className="gf-hint">No national demand is held in this window, so there is no gap to draw or day to summarise.</p>
  }
  const rel = ctx.related[TSD_KEY]
  const tModel = rel?.series ?? null
  const transmission = seriesOf(tModel, ITSDO)
  const gap = tModel && transmission ? gapRows(model, national, tModel, transmission) : null
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const unit = national.unit

  const gapDef: SeriesDef | null =
    gap && gap.count > 0
      ? {
          key: 'gap',
          field: 'gap',
          column: ITSDO,
          group: null,
          label: 'Transmission above national',
          color: COLORS.gap,
          unit,
          from: 'self',
          count: gap.count,
          mean: gap.sum / gap.count,
          min: gap.min,
          max: gap.max,
          signed: (gap.min ?? 0) < 0,
        }
      : null
  const panel: ChartPanel | null = gapDef
    ? {
        rows: gap?.rows ?? [],
        series: [gapDef],
        mark: 'bars',
        unit,
        stepMs: model.stepMs,
        bucketed: model.bucketed,
        settlement: model.settlement,
        height: 150,
        zero: true,
        axisWidth: AXIS_WIDTH,
      }
    : null
  // A gap figure per day, as a mean over the half-hours both measures hold.
  const gapDay = gap && gapDef ? sumsByDay({ ...model, rows: gap.rows }, ctx.window, gapDef) : null
  const days = daySummaries(model, ctx.window, national)
  // Days national demand holds that transmission demand doesn't: no gap to read there.
  const tDays = tModel && transmission ? new Map(daySummaries(tModel, ctx.window, transmission).map((d) => [d.start, d.held])) : null
  const nationalDays = days.filter((d) => d.held > 0)
  const bothDays = tDays ? nationalDays.filter((d) => (tDays.get(d.start) ?? 0) > 0).length : 0
  const fmt = (x: { v: number } | null) => (x ? unit.plain(x.v) : '–')

  return (
    <>
      {ctx.mode === 'chart' && panel && (
        <SeriesChart panels={[panel]} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} syncId="gf-series" />
      )}
      {ctx.mode === 'chart' && !panel && rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          The gap isn't drawn, as transmission demand could not be read: <ErrorWords error={rel.error} />
        </p>
      )}
      {ctx.mode === 'chart' && !panel && !(rel && (rel.state === 'error' || rel.state === 'refreshing')) && (
        <p className="gf-hint">Transmission demand holds no {noun} in common with national demand in this window, so the gap isn't drawn.</p>
      )}
      {tDays && bothDays < nationalDays.length && (
        <p className="gf-hint">
          Transmission demand is held locally for {bothDays} of the {plural(nationalDays.length, 'day', 'days')} holding national demand in this window, so the others have no gap to show.
        </p>
      )}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Mean, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Trough, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Peak, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Mean gap, {unit.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const g = gapDay?.get(d.start)
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={4}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.expected === null || !partial ? d.held : `${d.held} of ${d.expected}`}</td>
                  <td className="is-num">{d.mean === null ? '–' : unit.plain(d.mean)}</td>
                  <td className="is-num">{fmt(d.low)}</td>
                  <td className="is-num">{fmt(d.high)}</td>
                  <td className="is-num">{g && g.sum !== null && g.held > 0 ? unit.plain(g.sum / g.held) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {noun} with a national demand figure; a day held in part is summarised in part. The gap is transmission demand less national demand, averaged over the {noun} both hold, and a dash where they hold none in common.
        {ctx.mode === 'chart' ? ' Select a day to mark it on every chart.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
