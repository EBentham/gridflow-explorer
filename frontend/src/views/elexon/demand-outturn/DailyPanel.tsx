/**
 * The daily figure's working panel. Its unit is unconfirmed, so beside each
 * day's figure the panel sets national demand for the same UK day, read from
 * its half-hours (`indo`, whose unit is MW): the half-hours held, and, on a
 * day holding all of them, their energy in MWh (each half-hour's MW times
 * half an hour, summed), with the difference. The reader can compare the two;
 * the page does not name the daily figure's unit on the strength of it.
 */
import { plural } from '../../../design/format'
import { HALF_HOUR, dayLabel } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { daySummaries } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { INDO, INDOD, NATIONAL_KEY, seriesOf, sumsByDay } from './figures'

const MWH = (v: number) => Math.round(v).toLocaleString('en-GB')

/** A difference to half an MWh (the half-hour sums end in .5), with a true minus sign and no negative zero. */
function diffText(v: number): string {
  const r = Math.round(v * 10) / 10
  if (r === 0) return '0'
  return `${r < 0 ? '−' : ''}${Math.abs(r).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
}

export function DailyPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const daily = seriesOf(model, INDOD)
  if (!model || !ctx.window || !daily || !daily.count) {
    return <p className="gf-hint">No daily figure is held in this window, so there are no days to compare.</p>
  }
  const rel = ctx.related[NATIONAL_KEY]
  const nModel = rel?.series ?? null
  const national = seriesOf(nModel, INDO)
  // Energy only from half-hourly rows as held: bucket means would not sum to a day's energy.
  const halfHourly = Boolean(nModel && !nModel.bucketed && nModel.stepMs === HALF_HOUR)
  const sums = nModel && national && halfHourly ? sumsByDay(nModel, ctx.window, national) : null
  const expected = nModel && national && halfHourly ? new Map(daySummaries(nModel, ctx.window, national).map((d) => [d.start, d.expected])) : null
  const dailyAt = new Map(daySummaries(model, ctx.window, daily).map((d) => [d.start, d]))
  const days = [...dailyAt.values()]

  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Daily figure
              </th>
              <th scope="col" className="is-num">
                Half-hours of national demand
              </th>
              <th scope="col" className="is-num">
                National demand over the day, MWh
              </th>
              <th scope="col" className="is-num">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const on = d.start === ctx.picked
              const v = d.mean
              const s = sums?.get(d.start)
              const exp = expected?.get(d.start) ?? null
              // MW back from the model's GW, times half an hour, on complete days only.
              const energy = s && s.sum !== null && exp !== null && s.held === exp && national ? (s.sum / national.unit.factor) * 0.5 : null
              return (
                <tr key={d.day} className={on ? 'is-on' : d.held === 0 ? 'is-missing' : undefined}>
                  <th scope="row">
                    {d.held === 0 ? (
                      dayLabel(d.start)
                    ) : (
                      <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                        {dayLabel(d.start)}
                      </button>
                    )}
                  </th>
                  <td className="is-num">{v === null ? 'not held' : daily.unit.plain(v)}</td>
                  <td className="is-num">{s ? (exp !== null && s.held < exp ? `${s.held} of ${exp}` : s.held) : '–'}</td>
                  <td className="is-num">{energy === null ? '–' : MWH(energy)}</td>
                  <td className="is-num">{energy === null || v === null ? '–' : diffText(v - energy)}</td>
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
      {nModel && !halfHourly && <p className="gf-hint">National demand comes back as means over this window, so its energy per day is not summed.</p>}
      <p className="gf-hint">
        The daily figure is shown as published, with no unit, as its unit is unconfirmed. National demand over the day is each held half-hour’s MW times half an hour, summed, on days holding every half-hour; a dash where a day holds fewer. The difference is the daily figure less that sum. The page leaves the daily figure’s unit unconfirmed until the publisher’s own description settles it.
      </p>
    </>
  )
}
