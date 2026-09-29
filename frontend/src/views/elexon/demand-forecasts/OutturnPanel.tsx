/**
 * The half-hourly forecasts' working panel. In the Chart view, the forecast
 * and its outturn on one axis (national demand for `ndf`, transmission demand
 * for `tsdf` at boundary N), with outturn less forecast as bars under them,
 * on the main chart's clock and value-axis width. Then each UK day: the
 * half-hours of forecast held, its peak, the outturn's peak, and the mean and
 * mean absolute miss over the half-hours both hold. A step either side lacks
 * is a gap, never a zero.
 */
import { KeyList } from '../../../design/charts'
import { pct, plural } from '../../../design/format'
import { dayLabel, stepNoun, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { daySummaries, periodName, type SeriesDef } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import {
  AXIS_WIDTH,
  COLORS,
  ERROR_UNIT,
  INDO,
  ITSDO,
  NATIONAL_BOUNDARY,
  NDF,
  OUTTURN_KEY,
  boundaryOf,
  errorByDay,
  forecastColumn,
  joinOutturn,
  sameClock,
  seriesOf,
  signedMw,
  type ErrorStats,
} from './figures'

const dash = '–'

function def(base: SeriesDef, key: string, field: string, label: string, color: string, unit = base.unit): SeriesDef {
  return { ...base, key, field, label, color, from: key, unit }
}

function ErrorCells({ s }: { s: ErrorStats | undefined }) {
  if (!s || !s.count) {
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
      <td className="is-num">{signedMw(s.sum / s.count)}</td>
      <td className="is-num">{ERROR_UNIT.plain(s.sumAbs / s.count)}</td>
      <td className="is-num">{s.sumOutturn > 0 ? pct(s.sumAbs / s.sumOutturn) : dash}</td>
    </>
  )
}

export function OutturnPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const column = forecastColumn(ctx.dataset.id)
  const own = seriesOf(model, column)
  if (!model || !ctx.window || !own || !own.count) {
    return <p className="gf-hint">No forecast is held in this window, so there is no outturn to set it against and no day to summarise.</p>
  }
  const national = ctx.dataset.id === NDF
  const boundary = boundaryOf(ctx)
  const comparable = national || boundary === NATIONAL_BOUNDARY
  const rel = comparable ? ctx.related[OUTTURN_KEY] : undefined
  const oModel = rel?.series ?? null
  const oDef = seriesOf(oModel, national ? INDO : ITSDO)
  const clockOk = Boolean(oModel && sameClock(model, oModel))
  const join = oModel && oDef && clockOk ? joinOutturn(model, own, oModel, oDef) : null
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const outturnName = national ? 'national demand outturn' : 'transmission demand outturn'
  const OutturnName = national ? 'National demand outturn' : 'Transmission demand outturn'

  const panels: ChartPanel[] =
    join && join.stats.count > 0
      ? [
          {
            rows: join.rows,
            series: [def(own, 'forecast', 'f', own.label, own.color), def(own, 'outturn', 'o', OutturnName, COLORS.outturn)],
            mark: 'line',
            unit: own.unit,
            stepMs: model.stepMs,
            bucketed: model.bucketed,
            settlement: model.settlement,
            height: 220,
            axisWidth: AXIS_WIDTH,
          },
          {
            rows: join.rows,
            series: [def(own, 'miss', 'e', 'Outturn less forecast', COLORS.error, ERROR_UNIT)],
            mark: 'bars',
            unit: ERROR_UNIT,
            stepMs: model.stepMs,
            bucketed: model.bucketed,
            settlement: model.settlement,
            height: 140,
            zero: true,
            axisWidth: AXIS_WIDTH,
          },
        ]
      : []

  const days = daySummaries(model, ctx.window, own)
  const oDays = oModel && oDef ? new Map(daySummaries(oModel, ctx.window, oDef).map((d) => [d.start, d])) : null
  const errDays = join ? errorByDay(join, ctx.window, own.unit.factor) : null
  // A long window opening on days not fetched shows them as one row, so the held days aren't below the fold.
  const firstHeld = days.findIndex((d) => d.held > 0)
  const lead = firstHeld === -1 ? 0 : firstHeld
  const shown = lead >= 2 ? days.slice(lead) : days
  const unit = own.unit
  const fmt = (x: { v: number } | null | undefined) => (x ? unit.plain(x.v) : dash)
  const relFailed = rel && (rel.state === 'error' || rel.state === 'refreshing')

  return (
    <>
      {ctx.mode === 'chart' && panels.length > 0 && (
        <>
          <KeyList
            items={[
              { key: 'f', mark: { kind: 'line', color: own.color, dashed: ctx.fixture }, label: `${own.label}, ${unit.label}` },
              { key: 'o', mark: { kind: 'line', color: COLORS.outturn, dashed: ctx.fixture }, label: `${OutturnName}, ${unit.label}` },
              { key: 'e', mark: { kind: 'bars', color: COLORS.error, shape: 'rise' }, label: 'Outturn less forecast, MW, lower chart' },
            ]}
          />
          <SeriesChart panels={panels} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
        </>
      )}
      {join && (join.stats.above || join.stats.below) && (
        <p className="gf-hint">
          {join.stats.above ? `Outturn ran furthest above the forecast at ${periodName(join.stats.above.t, model.stepMs, model.settlement)}, by ${signedMw(join.stats.above.v)} MW` : ''}
          {join.stats.above && join.stats.below ? '; ' : ''}
          {join.stats.below ? `${join.stats.above ? 'furthest' : 'Outturn ran furthest'} below it at ${periodName(join.stats.below.t, model.stepMs, model.settlement)}, by ${signedMw(join.stats.below.v)} MW` : ''}.
        </p>
      )}
      {!comparable && <p className="gf-hint">Boundary {boundary} has no outturn held to set beside it: transmission demand outturn is national, which is boundary N. Choose boundary N to compare the two.</p>}
      {relFailed && (
        <p className="gf-hint">
          The outturn could not be read beside it, so there is no miss to show: <ErrorWords error={rel.error} />
        </p>
      )}
      {comparable && !relFailed && oModel && !clockOk && <p className="gf-hint">The forecast and the outturn come back on different clocks in this window, so they are not set against each other. Choose a shorter window.</p>}
      {comparable && !relFailed && join && join.stats.count === 0 && (
        <p className="gf-hint">
          No {outturnName} is held for any of the {noun} of forecast in this window, so there is nothing to set against it.
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
                Forecast peak, {unit.label}
              </th>
              {comparable && (
                <>
                  <th scope="col" className="is-num">
                    Outturn peak, {unit.label}
                  </th>
                  <th scope="col" className="is-num">
                    Mean miss, MW
                  </th>
                  <th scope="col" className="is-num">
                    Mean absolute miss, MW
                  </th>
                  <th scope="col" className="is-num">
                    Absolute miss, share of outturn
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lead >= 2 && (
              <tr className="is-missing">
                <th scope="row">
                  {dayLabel(days[0].start)} – {dayLabel(days[lead - 1].start)}
                </th>
                <td className="is-num">0</td>
                <td colSpan={comparable ? 5 : 1}>not held locally, {plural(lead, 'day', 'days')}</td>
              </tr>
            )}
            {shown.map((d) => {
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={comparable ? 5 : 1}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              const o = oDays?.get(d.start)
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.expected === null || !partial ? d.held : `${d.held} of ${d.expected}`}</td>
                  <td className="is-num">{fmt(d.high)}</td>
                  {comparable && (
                    <>
                      <td className="is-num">{!o || o.held === 0 ? 'not held' : o.expected !== null && o.held < o.expected ? `${o.held} of ${o.expected} held` : fmt(o.high)}</td>
                      <ErrorCells s={errDays?.get(d.start)} />
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {noun} of forecast held, so a day held in part is summarised in part; a peak is the highest {noun.replace(/s$/, '')} held that day{comparable ? ', and the outturn’s is given only on a day holding all of its own' : ''}.
        {comparable
          ? ` The miss is ${outturnName} less the forecast, read over the ${noun} both hold, and a dash where they hold none in common: above zero, GB drew more than forecast. The share is the absolute misses summed over the outturn summed.`
          : ''}
        {model.bucketed ? ` This window is read as ${noun}, so the misses are between means and can only read smaller than they would per half-hour.` : ''}
        {ctx.mode === 'chart' ? ' Select a day to mark it on every chart.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
