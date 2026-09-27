/**
 * The working panel, on both datasets. In the Chart view, one zone's actual
 * load and its day-ahead forecast on one axis, with actual less forecast as
 * bars under them, on the main chart's clock and value-axis width. Then every
 * zone over the window: the quarter-hours both hold, the mean load, the mean
 * error, the mean absolute error and that as a share of load. Then the zone's
 * UK days. The zone is the one selected in the key, else the first; a zone's
 * row in the table selects it too. Every figure is read at the steps both
 * datasets hold, and a step either lacks is a gap.
 */
import { KeyList } from '../../../design/charts'
import { pct, plural } from '../../../design/format'
import { dayLabel, stepNoun, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { daySummaries, seriesId, type SeriesDef, type SeriesModel } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, ERROR_UNIT, MEASURE, ZONES, errorByDay, joinZone, pairOf, sameClock, zoneDef, zoneInView, zoneName, type ErrorStats } from './figures'

const dash = '–'
const mw = (v: number) => ERROR_UNIT.plain(v)

function def(base: SeriesDef, key: string, field: string, label: string, color: string, from: string, unit = base.unit): SeriesDef {
  return { ...base, key, field, label, color, from, unit }
}

/** The error columns of a stats row: mean error, mean absolute error, and absolute error as a share of load. */
function ErrorCells({ s }: { s: ErrorStats }) {
  if (!s.count) {
    return (
      <>
        <td className="is-num">{dash}</td>
        <td className="is-num">{dash}</td>
        <td className="is-num">{dash}</td>
      </>
    )
  }
  return (
    <>
      <td className="is-num">{mw(s.sum / s.count)}</td>
      <td className="is-num">{mw(s.sumAbs / s.count)}</td>
      <td className="is-num">{s.sumActual > 0 ? pct(s.sumAbs / s.sumActual) : dash}</td>
    </>
  )
}

function ZoneTable({ ctx, actual, forecast, zone }: { ctx: PageContext; actual: SeriesModel; forecast: SeriesModel; zone: string }) {
  const rows = ZONES.map((z) => {
    const a = zoneDef(actual, z.value)
    const f = zoneDef(forecast, z.value)
    const own = zoneDef(ctx.series, z.value)
    return { z, a, own, join: a && f ? joinZone(actual, a, forecast, f) : null }
  })
  return (
    <div className="gf-days">
      <table>
        <thead>
          <tr>
            <th scope="col">Zone</th>
            <th scope="col" className="is-num">
              Held by both
            </th>
            <th scope="col" className="is-num">
              Mean actual, GW
            </th>
            <th scope="col" className="is-num">
              Mean error, MW
            </th>
            <th scope="col" className="is-num">
              Mean absolute error, MW
            </th>
            <th scope="col" className="is-num">
              Share of load
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ z, a, own, join }) => {
            const on = z.value === zone
            const id = own ? seriesId(own) : null
            if (!a || !a.count) {
              return (
                <tr key={z.value} className="is-missing">
                  <th scope="row">{z.label}</th>
                  <td className="is-num">0</td>
                  <td colSpan={4}>no actual load held in this window</td>
                </tr>
              )
            }
            return (
              <tr key={z.value} className={on ? 'is-on' : undefined}>
                <th scope="row">
                  {id ? (
                    <button type="button" aria-pressed={on} onClick={() => ctx.setFocus(on && ctx.focus ? undefined : id)}>
                      {z.label}
                    </button>
                  ) : (
                    z.label
                  )}
                </th>
                <td className="is-num">{join ? join.stats.count.toLocaleString('en-GB') : '0'}</td>
                <td className="is-num">{a.mean === null ? dash : a.unit.plain(a.mean)}</td>
                {join ? <ErrorCells s={join.stats} /> : <td colSpan={3}>no forecast held in this window</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function ForecastPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const zone = zoneInView(ctx)
  if (!model || !ctx.window || !zone) {
    return <p className="gf-hint">Nothing is held in this window, so there is no forecast to set against actual load.</p>
  }
  const { actual, forecast, other, ownIsActual } = pairOf(ctx)
  const otherName = ownIsActual ? 'the day-ahead forecast' : 'actual load'
  if (other && (other.state === 'error' || other.state === 'refreshing')) {
    return (
      <p className="gf-hint">
        {ownIsActual ? 'The day-ahead forecast' : 'Actual load'} could not be read beside it, so there is no error to show: <ErrorWords error={other.error} />
      </p>
    )
  }
  if (!actual || !forecast || !actual.all.some((d) => d.count) || !forecast.all.some((d) => d.count)) {
    return <p className="gf-hint">No {otherName} is held in this window, so there is no error to show.</p>
  }
  if (!sameClock(actual, forecast)) {
    return <p className="gf-hint">Actual load and the forecast come back on different clocks in this window, so they are not set against each other. Choose a shorter window.</p>
  }

  const aDef = zoneDef(actual, zone)
  const fDef = zoneDef(forecast, zone)
  const ownDef = zoneDef(model, zone)
  const name = zoneName(zone)
  const bucketed = model.bucketed
  const noun = bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const join = aDef && fDef ? joinZone(actual, aDef, forecast, fDef) : null
  const base = aDef ?? fDef ?? ownDef
  const panels: ChartPanel[] =
    join && base && join.stats.count > 0
      ? [
          {
            rows: join.rows,
            series: [def(base, 'actual', 'a', `${name}, actual`, MEASURE.actual, 'actual'), def(base, 'forecast', 'f', `${name}, forecast`, MEASURE.forecast, 'forecast')],
            mark: 'line',
            unit: base.unit,
            stepMs: model.stepMs,
            bucketed,
            height: 210,
            axisWidth: AXIS_WIDTH,
          },
          {
            rows: join.rows,
            series: [def(base, 'error', 'e', 'Actual less forecast', MEASURE.error, 'error', ERROR_UNIT)],
            mark: 'bars',
            unit: ERROR_UNIT,
            stepMs: model.stepMs,
            bucketed,
            height: 130,
            zero: true,
            axisWidth: AXIS_WIDTH,
          },
        ]
      : []
  const days = ownDef ? daySummaries(model, ctx.window, ownDef) : []
  const errDays = join && aDef ? errorByDay(join, ctx.window, aDef.unit.factor) : null
  const own = ownIsActual ? 'actual' : 'forecast'
  const unit = ownDef?.unit
  const fmt = (x: { v: number } | null) => (x && unit ? unit.plain(x.v) : dash)

  return (
    <>
      {ctx.mode === 'chart' && panels.length > 0 && (
        <>
          <KeyList
            items={[
              { key: 'a', mark: { kind: 'line', color: MEASURE.actual, dashed: ctx.fixture }, label: `${name}, actual load, GW` },
              { key: 'f', mark: { kind: 'line', color: MEASURE.forecast, dashed: ctx.fixture }, label: `${name}, day-ahead forecast, GW` },
              { key: 'e', mark: { kind: 'bars', color: MEASURE.error, shape: 'rise' }, label: 'Actual less forecast, MW, lower chart' },
            ]}
          />
          <SeriesChart panels={panels} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
        </>
      )}
      {ctx.mode === 'chart' && panels.length === 0 && (
        <p className="gf-hint">
          {name} holds no {noun} with both actual load and a forecast in this window, so there is nothing to draw.
        </p>
      )}
      <p className="gf-hint">Each zone, over the window:</p>
      <ZoneTable ctx={ctx} actual={actual} forecast={forecast} zone={zone} />
      <p className="gf-hint">{name}, each UK day:</p>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Mean {own}, GW
              </th>
              <th scope="col" className="is-num">
                Trough
              </th>
              <th scope="col" className="is-num">
                Peak
              </th>
              <th scope="col" className="is-num">
                Mean error, MW
              </th>
              <th scope="col" className="is-num">
                Mean absolute error, MW
              </th>
              <th scope="col" className="is-num">
                Share of load
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={6}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              const e = errDays?.get(d.start)
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.expected === null || !partial ? d.held : `${d.held} of ${d.expected}`}</td>
                  <td className="is-num">{d.mean === null || !unit ? dash : unit.plain(d.mean)}</td>
                  <td className="is-num">{fmt(d.low)}</td>
                  <td className="is-num">{fmt(d.high)}</td>
                  {e ? <ErrorCells s={e} /> : <td colSpan={3}>{dash}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        The error is actual load less the forecast: above zero, the zone drew more than forecast. The means and the share of load are read over the {noun} both hold, a dash where they hold none in common; the share is the absolute errors summed over the actual load summed. Held counts the {noun} of {own} held, so a day held in part is summarised in part.
        {bucketed ? ` This window is read as ${noun}, so the errors are between means, and the mean absolute error can only read smaller than it would per quarter-hour.` : ''}
        {ctx.mode === 'chart' ? ' Select a zone to draw it here and alone above, and a day to mark it on every chart.' : ' Select a zone to read its days, and a day to mark it.'}
      </p>
    </>
  )
}
