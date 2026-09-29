/**
 * The working panel: each UK day of the window, its temperature figure (or
 * not held locally), and national demand for the same day read from its
 * half-hours (`indo`, read beside it): the half-hours held, their mean and
 * their peak. The two sit side by side for comparison; the page draws no
 * link between them. Select a day to mark it on the chart.
 */
import { plural } from '../../../design/format'
import { dayLabel, stepNoun } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { daySummaries } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { DEMAND_KEY, INDO, TEMP, seriesOf } from './figures'

export function DaysPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const temp = seriesOf(model, TEMP)
  if (!model || !ctx.window || !temp) {
    return <p className="gf-hint">No temperature is held in this window, so there are no days to list.</p>
  }
  const rel = ctx.related[DEMAND_KEY]
  const dModel = rel?.series ?? null
  const demand = seriesOf(dModel, INDO)
  const dDays = dModel && demand ? new Map(daySummaries(dModel, ctx.window, demand).map((d) => [d.start, d])) : null
  const noun = dModel?.bucketed && dModel.stepMs ? meansText(dModel.stepMs) : stepNoun(dModel?.stepMs ?? null)
  const unit = demand?.unit.label ?? 'unit unconfirmed'
  const days = daySummaries(model, ctx.window, temp)
  const heldCount = days.filter((d) => d.held > 0).length

  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Temperature, {temp.unit.label ?? 'unit unconfirmed'}
              </th>
              <th scope="col" className="is-num">
                {demand ? `National demand, ${noun} held` : 'National demand'}
              </th>
              <th scope="col" className="is-num">
                {demand ? `Mean, ${unit}` : 'Mean'}
              </th>
              <th scope="col" className="is-num">
                {demand ? `Peak, ${unit}` : 'Peak'}
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const dd = dDays?.get(d.start)
              const partial = dd && dd.expected !== null && dd.held < dd.expected
              const on = d.start === ctx.picked
              const demandCells = !dd ? (
                <td colSpan={3}>–</td>
              ) : dd.held === 0 ? (
                <>
                  <td className="is-num">{dd.expected === null ? '0' : `0 of ${dd.expected}`}</td>
                  <td colSpan={2}>not held locally</td>
                </>
              ) : (
                <>
                  <td className="is-num">{partial ? `${dd.held} of ${dd.expected}` : dd.held}</td>
                  <td className="is-num">{dd.mean === null || !demand ? '–' : demand.unit.plain(dd.mean)}</td>
                  <td className="is-num">{dd.high && demand ? demand.unit.plain(dd.high.v) : '–'}</td>
                </>
              )
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">not held locally</td>
                    {demandCells}
                  </tr>
                )
              }
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.mean === null ? '–' : temp.unit.plain(d.mean)}</td>
                  {demandCells}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      {rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          National demand could not be read beside it: <ErrorWords error={rel.error} />
        </p>
      )}
      {rel && rel.state === 'empty' && <p className="gf-hint">No national demand is held in this window, so there is nothing to set beside the temperature.</p>}
      <p className="gf-hint">
        {plural(heldCount, 'day', 'days')} of {days.length} hold a temperature figure; a day not held hasn’t been fetched here and is a gap, never a zero. National demand is Elexon’s first published figure
        for each half-hour; a day’s mean and peak are of the {noun} it holds{dModel?.bucketed ? ', so the peak is the highest mean, not the highest half-hour' : ''}. It is set beside the temperature for
        comparison only.{heldCount === 0 ? '' : ctx.mode === 'chart' ? ' Select a day to mark it on the chart.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
