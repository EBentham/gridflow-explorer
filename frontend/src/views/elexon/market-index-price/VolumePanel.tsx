/**
 * The pilot's working panel. In the Chart view, the volume traded per
 * half-hour as bars on the price chart's clock: the same window, the same
 * value-axis width and one tooltip cursor across both charts, so a spike in
 * price reads against the trading behind it. Then each UK day: the
 * half-hours held, the price's mean, lowest and highest, and the volume
 * summed over the half-hours held. Select a day to mark it on both charts.
 */
import { plural } from '../../../design/format'
import { dayLabel, stepNoun, windowDomain } from '../../../design/time'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { daySummaries } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, PRICE, VOLUME, seriesOf, volumeByDay } from './figures'

export function VolumePanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const price = seriesOf(model, PRICE)
  const volume = seriesOf(model, VOLUME)
  if (!model || !ctx.window || !price || !volume || (!price.count && !volume.count)) {
    return <p className="gf-hint">Nothing is held in this window, so there is no volume to draw or day to summarise.</p>
  }
  const panel: ChartPanel = {
    rows: model.rows,
    series: [volume],
    mark: 'bars',
    unit: volume.unit,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    height: 150,
    zero: true,
    axisWidth: AXIS_WIDTH,
  }
  const days = daySummaries(model, ctx.window, price)
  // A sum of bucket means isn't the volume traded: a window read as means gets no daily total.
  const summed = !model.bucketed
  const sums = volumeByDay(model, ctx.window, volume)
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const fmt = (x: { v: number } | null) => (x ? price.unit.plain(x.v) : '–')

  return (
    <>
      {ctx.mode === 'chart' && volume.count > 0 && (
        <SeriesChart panels={[panel]} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      )}
      {ctx.mode === 'chart' && volume.count === 0 && <p className="gf-hint">No volume is held in this window.</p>}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Mean, {price.unit.label}
              </th>
              <th scope="col" className="is-num">
                Lowest
              </th>
              <th scope="col" className="is-num">
                Highest
              </th>
              {summed && (
                <th scope="col" className="is-num">
                  Volume, {volume.unit.label}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const v = sums.get(d.start)
              if (d.held === 0 && !v?.held) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={summed ? 4 : 3}>not held locally</td>
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
                  <td className="is-num">{d.mean === null ? '–' : price.unit.plain(d.mean)}</td>
                  <td className="is-num">{fmt(d.low)}</td>
                  <td className="is-num">{fmt(d.high)}</td>
                  {summed && <td className="is-num">{v?.sum === null || v === undefined ? '–' : volume.unit.plain(v.sum)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {noun} with a price.{' '}
        {summed ? `Volume sums the ${noun} held, so a day held in part sums in part.` : 'The window is read as means, so volume per day is not summed.'} The mean price is not weighted by volume.
        {ctx.mode === 'chart' ? ' Select a day to mark it on both charts.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
