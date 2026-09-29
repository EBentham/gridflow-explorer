/**
 * The daily forecasts' working panel. In the Chart view, one point per
 * delivery day: both daily forecasts (national and transmission, lined up on
 * the delivery date, as their rows are stamped an hour apart in summer), and
 * the page's own measure's outturn peak and mean on the days that hold every
 * half-hour of it. Then each delivery day: when its figures were issued, how
 * many days ahead, both forecasts, and the outturn peak and mean. Nothing is
 * filled in: a day without a figure is a gap in its line and a dash.
 */
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { DAY_MS, fmtDay, instantLabel, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import type { SeriesDef, WideRow } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, COLORS, GW_UNIT, NDFD, OTHER_KEY, OUTTURN_KEY, daysAhead, deliveryDays, type DailyFigure } from './figures'

const dash = '–'

function line(key: string, label: string, color: string, count: number): SeriesDef {
  return { key, field: key, column: key, group: null, label, color, unit: GW_UNIT, from: key, count, mean: null, min: null, max: null, signed: false }
}

const gw = (f: DailyFigure | null) => (f ? GW_UNIT.plain(f.mw * GW_UNIT.factor) : dash)

export function DailyPanel({ ctx }: { ctx: PageContext }) {
  const days = deliveryDays(ctx)
  if (!ctx.window || !days.length) {
    return <p className="gf-hint">No delivery day is in this window, so there is nothing to list.</p>
  }
  const national = ctx.dataset.id === NDFD
  const own = (d: (typeof days)[number]) => (national ? d.national : d.transmission)
  const other = ctx.related[OTHER_KEY]
  const outturn = ctx.related[OUTTURN_KEY]
  const outturnName = national ? 'national demand outturn' : 'transmission demand outturn'
  const OutturnName = national ? 'National demand outturn' : 'Transmission demand outturn'

  const rows: WideRow[] = days.map((d) => ({
    t: d.start,
    n: d.national ? d.national.mw * GW_UNIT.factor : null,
    x: d.transmission ? d.transmission.mw * GW_UNIT.factor : null,
    p: d.peak,
    m: d.mean,
  }))
  const count = (k: string) => rows.filter((r) => typeof r[k] === 'number').length
  const series = [
    line('n', 'National demand forecast', COLORS.national, count('n')),
    line('x', 'Transmission demand forecast', COLORS.transmission, count('x')),
    line('p', `${OutturnName}, peak`, COLORS.outturn, count('p')),
    line('m', `${OutturnName}, mean`, COLORS.outturnMean, count('m')),
  ].filter((s) => s.count > 0)
  const panels: ChartPanel[] = series.length ? [{ rows, series, mark: 'line', unit: GW_UNIT, stepMs: DAY_MS, height: 240, axisWidth: AXIS_WIDTH }] : []
  const shown = days.filter((d) => d.national || d.transmission || d.held > 0)
  const hidden = days.length - shown.length

  return (
    <>
      {ctx.mode === 'chart' && panels.length > 0 && (
        <>
          <KeyList items={series.map((s) => ({ key: s.key, mark: { kind: 'line' as const, color: s.color, dashed: ctx.fixture }, label: `${s.label}, GW` }))} />
          <SeriesChart panels={panels} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} syncId="gf-daily" />
        </>
      )}
      {other && (other.state === 'error' || other.state === 'refreshing') && (
        <p className="gf-hint">
          The {national ? 'transmission' : 'national'} daily forecast could not be read beside it: <ErrorWords error={other.error} />
        </p>
      )}
      {outturn && (outturn.state === 'error' || outturn.state === 'refreshing') && (
        <p className="gf-hint">
          The outturn could not be read beside it: <ErrorWords error={outturn.error} />
        </p>
      )}
      {outturn?.series?.bucketed && <p className="gf-hint">The outturn comes back as means over this window, so its daily peak and mean are not read.</p>}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Delivery day</th>
              <th scope="col">Issued</th>
              <th scope="col" className="is-num">
                Days ahead
              </th>
              <th scope="col" className="is-num">
                National forecast, GW
              </th>
              <th scope="col" className="is-num">
                Transmission forecast, GW
              </th>
              <th scope="col" className="is-num">
                Outturn peak, GW
              </th>
              <th scope="col" className="is-num">
                Outturn mean, GW
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => {
              const f = own(d)
              const on = d.start === ctx.picked
              const partial = d.held > 0 && d.peak === null
              return (
                <tr key={d.date} className={on ? 'is-on' : f ? undefined : 'is-missing'}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {fmtDay(d.date)}
                    </button>
                  </th>
                  <td>{f?.issued != null ? instantLabel(f.issued) : f ? dash : 'not held locally'}</td>
                  <td className="is-num">{f?.issued != null ? daysAhead(d.date, f.issued) : dash}</td>
                  <td className="is-num">{gw(d.national)}</td>
                  <td className="is-num">{gw(d.transmission)}</td>
                  <td className="is-num">{d.peak !== null ? GW_UNIT.plain(d.peak) : partial ? `${d.held} of ${d.expected ?? '?'} held` : dash}</td>
                  <td className="is-num">{d.mean !== null ? GW_UNIT.plain(d.mean) : dash}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hidden > 0 && <p className="gf-hint">{plural(hidden, 'day', 'days')} in the window hold no forecast and no outturn, and are left out of the table.</p>}
      {shown.length > 8 && <p className="gf-hint">{plural(shown.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Issued is the {national ? 'national' : 'transmission'} forecast’s issue time on the UK clock, and days ahead counts whole UK days from it to the delivery day. The two forecasts are lined up on the delivery date. The outturn peak and mean are of {outturnName}’s half-hours that day, on days holding every one; a day held in part gives the half-hours held, and a day not held a dash.
        {ctx.mode === 'chart' ? ' Select a day to mark it on every chart.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
