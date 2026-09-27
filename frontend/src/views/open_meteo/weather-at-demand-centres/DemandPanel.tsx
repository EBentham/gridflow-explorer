/**
 * The reanalysis's working panel. In the Chart view, GB national demand
 * (Elexon's `indo`, read beside the weather) on the temperature chart's
 * clock: the same window, the same value-axis width and one tooltip cursor,
 * so a cold snap reads against the demand it came with. Then each UK day:
 * the city-hours held, the cities' mean, coldest and warmest temperature,
 * the mean heating and cooling degrees, and national demand's mean and peak
 * over the half-hours it holds. Select a day to mark it on both charts.
 */
import { plural } from '../../../design/format'
import { dayLabel, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { meansText } from '../../_template/text'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, DEMAND, DEMAND_KEY, HDD, TEMP, citySeries, seriesOf, weatherDays } from './figures'

export function DemandPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const temps = citySeries(model, TEMP)
  if (!model || !ctx.window || !temps.length) {
    return <p className="gf-hint">No weather is held in this window, so there is no day to summarise.</p>
  }
  const rel = ctx.related[DEMAND_KEY]
  const dModel = rel?.series ?? null
  const demand = seriesOf(dModel, DEMAND)
  const days = weatherDays(model, ctx.window, dModel && demand ? { model: dModel, def: demand } : null)
  const tUnit = temps[0].unit
  const kUnit = citySeries(model, HDD)[0]?.unit ?? null
  const dUnit = demand?.unit ?? null
  const panel: ChartPanel | null =
    dModel && demand && demand.count > 0
      ? {
          rows: dModel.rows,
          series: [demand],
          mark: 'line',
          unit: demand.unit,
          stepMs: dModel.stepMs,
          bucketed: dModel.bucketed,
          settlement: dModel.settlement,
          height: 170,
          axisWidth: AXIS_WIDTH,
        }
      : null
  const fmt = (v: number | null | undefined, u: typeof tUnit | null) => (v === null || v === undefined || !u ? '–' : u.plain(v))
  const tempUnit = tUnit.label ?? 'unit unconfirmed'
  const heldHead = model.bucketed ? 'City values held' : 'City-hours held'
  const heldText = model.bucketed && model.stepMs ? `each city’s ${meansText(model.stepMs)} with a temperature` : "each city’s hours with a temperature, of 24 for each of the seven"
  const demandSteps = dModel?.bucketed && dModel.stepMs ? `the ${meansText(dModel.stepMs)} held, so the peak is the highest mean` : 'the half-hours held'

  return (
    <>
      {ctx.mode === 'chart' && panel && (
        <SeriesChart panels={[panel]} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      )}
      {rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          National demand could not be read: <ErrorWords error={rel.error} />
        </p>
      )}
      {rel && rel.state === 'empty' && <p className="gf-hint">No national demand is held in this window.</p>}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                {heldHead}
              </th>
              <th scope="col" className="is-num">
                Mean, {tempUnit}
              </th>
              <th scope="col" className="is-num">
                Coldest
              </th>
              <th scope="col" className="is-num">
                Warmest
              </th>
              <th scope="col" className="is-num">
                Heating degrees, {kUnit?.label ?? 'unit unconfirmed'}
              </th>
              <th scope="col" className="is-num">
                Cooling degrees
              </th>
              <th scope="col" className="is-num">
                Demand mean, {dUnit?.label ?? 'GW'}
              </th>
              <th scope="col" className="is-num">
                Demand peak
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const noDemand = !d.demand || d.demand.held === 0
              if (d.temp.held === 0 && noDemand) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={7}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.temp.held < d.expected
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.expected === null || !partial ? d.temp.held : `${d.temp.held} of ${d.expected}`}</td>
                  {d.temp.held === 0 ? (
                    <td colSpan={5}>no weather held</td>
                  ) : (
                    <>
                      <td className="is-num">{fmt(d.temp.mean, tUnit)}</td>
                      <td className="is-num">{d.temp.low ? `${tUnit.plain(d.temp.low.v)}, ${d.temp.low.city}` : '–'}</td>
                      <td className="is-num">{d.temp.high ? `${tUnit.plain(d.temp.high.v)}, ${d.temp.high.city}` : '–'}</td>
                      <td className="is-num">{fmt(d.hdd, kUnit)}</td>
                      <td className="is-num">{fmt(d.cdd, kUnit)}</td>
                    </>
                  )}
                  {noDemand ? (
                    <td colSpan={2}>{rel?.state === 'data' || rel?.state === 'empty' ? 'no demand held' : '–'}</td>
                  ) : (
                    <>
                      <td className="is-num">{fmt(d.demand?.mean, dUnit)}</td>
                      <td className="is-num">{fmt(d.demand?.peak, dUnit)}</td>
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
        {heldHead} counts {heldText}. The mean and the degrees weight every city alike; a day held in part is a
        mean of the part held. Heating and cooling degrees here are the day&rsquo;s mean, so a whole day reads as its degree-days. Demand is national demand as first published,
        its mean and peak over {demandSteps} each day; it is not matched hour by hour to the weather.
        {ctx.mode === 'chart' ? ' Select a day to mark it on both charts.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
