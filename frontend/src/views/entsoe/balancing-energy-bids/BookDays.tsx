/**
 * The working panel. In the Chart view, the bids offered at each
 * quarter-hour as bars on the main chart's clock (the same window, value-axis
 * width and tooltip cursor), so a change in the MW offered reads against the
 * number of bids behind it. Then each UK day: the steps held, the different
 * bids, the most in one step, and the total's mean, lowest and highest. A
 * window read as means has no MW to give, and its main chart already counts
 * the bids, so it gets the days alone. Select a day to mark it.
 */
import { plural } from '../../../design/format'
import { dayLabel, windowDomain } from '../../../design/time'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, dayFigures, n, pageBook } from './figures'
import { stepsText } from './words'

export function BookDays({ ctx }: { ctx: PageContext }) {
  const { zone, dir, book } = pageBook(ctx)
  const response = ctx.response
  if (!book || !book.held || !ctx.window || response?.kind !== 'series') {
    return <p className="gf-hint">No bid is held in this window for {zone.name}, {dir.label}, so there are no bids to count or days to summarise.</p>
  }
  const days = dayFigures(response, book, ctx.window)
  const summed = !book.bucketed
  const unit = book.total.unit
  const fmt = (x: { v: number } | null) => (x ? unit.plain(x.v) : '–')
  const panel: ChartPanel = {
    rows: book.isolated ? book.heldRows : book.rows,
    series: [book.bids],
    mark: 'bars',
    unit: book.bids.unit,
    stepMs: book.stepMs,
    height: 150,
    zero: true,
    axisWidth: AXIS_WIDTH,
  }
  const noun = stepsText(book)
  return (
    <>
      {ctx.mode === 'chart' && summed && (
        <SeriesChart panels={[panel]} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} syncId="gf-series" />
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
                Bids
              </th>
              <th scope="col" className="is-num">
                Most in a step
              </th>
              {summed && (
                <>
                  <th scope="col" className="is-num">
                    Mean, {unit.label}
                  </th>
                  <th scope="col" className="is-num">
                    Lowest
                  </th>
                  <th scope="col" className="is-num">
                    Highest
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={summed ? 5 : 2}>no bid held locally</td>
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
                  <td className="is-num">{d.expected === null || !partial ? n(d.held) : `${n(d.held)} of ${n(d.expected)}`}</td>
                  <td className="is-num">{n(d.bids)}</td>
                  <td className="is-num">{d.mostBids === null ? '–' : n(d.mostBids)}</td>
                  {summed && (
                    <>
                      <td className="is-num">{d.mean === null ? '–' : unit.plain(d.mean)}</td>
                      <td className="is-num">{fmt(d.low)}</td>
                      <td className="is-num">{fmt(d.high)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {noun} some bid holds; bids counts the different bids offered in the day.{' '}
        {summed ? 'Mean, lowest and highest are of the MW offered in those steps, so a day held in part reads in part.' : `The window is read as ${noun}, so no MW is given per day, and a step counts in the UK day it starts in.`}
        {zone.cutOff ? ` ${zone.name}’s days are not complete: its download may have been cut off.` : ''}
        {ctx.mode === 'chart' ? (summed ? ' Select a day to mark it on both charts.' : ' Select a day to mark it on the chart.') : ' Select a day to mark it.'}
      </p>
    </>
  )
}
