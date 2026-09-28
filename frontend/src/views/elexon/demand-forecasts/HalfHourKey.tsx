/**
 * The key for the half-hourly forecasts (`ndf`, `tsdf`): the line, the latest
 * half-hour held, the window's peak and trough, then how far ahead the held
 * forecasts were issued (read from each row's own issue time: this is what
 * says which forecast the page shows), and, where outturn is read beside it,
 * the mean miss and the half-hours where outturn ran furthest from it. Every
 * figure comes from the rows read.
 */
import { KeyList, type KeyItem } from '../../../design/charts'
import { instantLabel, stepNoun } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { extremesOf, latestValue, periodName } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { COLORS, ERROR_UNIT, INDO, ITSDO, NATIONAL_BOUNDARY, NDF, OUTTURN_KEY, boundaryOf, forecastColumn, issueStats, joinOutturn, leadText, sameClock, seriesOf, signedMw } from './figures'

export function HalfHourKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const column = forecastColumn(ctx.dataset.id)
  const own = seriesOf(model, column)
  if (!model || !own || !own.count) {
    return <p className="gf-hint">No forecast is held in this window, so there is nothing to key.</p>
  }
  const national = ctx.dataset.id === NDF
  // Transmission outturn is national, so only boundary N has one to set beside it.
  const rel = national || boundaryOf(ctx) === NATIONAL_BOUNDARY ? ctx.related[OUTTURN_KEY] : undefined
  const oModel = rel?.series ?? null
  const oDef = seriesOf(oModel, national ? INDO : ITSDO)
  const join = oModel && oDef && sameClock(model, oModel) ? joinOutturn(model, own, oModel, oDef) : null
  const step = model.stepMs
  const noun = model.bucketed && step ? meansText(step) : stepNoun(step)
  const when = (t: number) => periodName(t, step, model.settlement)
  const latest = latestValue(model, own)
  const ex = extremesOf(model.rows, own)
  const issue = issueStats(ctx.response, column)
  const unit = own.unit
  const outturnName = national ? 'national demand outturn' : 'transmission demand outturn'

  const items: KeyItem[] = [{ key: 'forecast', mark: { kind: 'line', color: own.color, dashed: ctx.fixture }, label: `${own.label}, ${unit.label ?? 'unit unconfirmed'}` }]
  if (rel && oDef && oDef.count > 0 && ctx.mode === 'chart') {
    items.push({ key: 'outturn', mark: { kind: 'line', color: COLORS.outturn, dashed: ctx.fixture }, label: `${national ? 'National' : 'Transmission'} demand outturn, working panel` })
  }

  return (
    <>
      <KeyList items={items} />
      <dl className="gf-stats">
        {latest && (
          <div>
            <dt>{model.bucketed ? 'Latest mean' : 'Latest held'}</dt>
            <dd>
              {unit.format(latest.v)}
              <span className="gf-stat-when">{when(latest.t)}</span>
            </dd>
          </div>
        )}
        {ex && (
          <>
            <div>
              <dt>Peak</dt>
              <dd>
                {unit.format(ex.high.v)}
                <span className="gf-stat-when">{when(ex.high.t)}</span>
              </dd>
            </div>
            <div>
              <dt>Trough</dt>
              <dd>
                {unit.format(ex.low.v)}
                <span className="gf-stat-when">{when(ex.low.t)}</span>
              </dd>
            </div>
          </>
        )}
      </dl>
      <p className="gf-hint">
        Peak and trough are of the {own.count.toLocaleString('en-GB')} {noun} held.
      </p>
      {issue ? (
        <>
          <dl className="gf-stats">
            <div>
              <dt>Issued ahead, median</dt>
              <dd>
                {leadText(issue.median)}
                <span className="gf-stat-when">
                  {issue.shortest === issue.longest ? 'for every half-hour held' : `shortest ${leadText(issue.shortest)}, longest ${leadText(issue.longest)}`}
                </span>
              </dd>
            </div>
            <div>
              <dt>Newest issue held</dt>
              <dd>{instantLabel(issue.newest)}</dd>
            </div>
          </dl>
          <p className="gf-hint">
            How long before each half-hour began the forecast drawn for it was issued, over the {issue.count.toLocaleString('en-GB')} half-hours held with an issue time.
          </p>
        </>
      ) : (
        <p className="gf-hint">The rows read carry no issue time{model.bucketed ? ', as they come back as means' : ''}, so how far ahead they were issued can’t be said here.</p>
      )}
      {join && join.stats.count > 0 && (
        <>
          <dl className="gf-stats">
            <div>
              <dt>Mean miss</dt>
              <dd>
                {signedMw(join.stats.sum / join.stats.count)} MW
                <span className="gf-stat-when">mean absolute {ERROR_UNIT.plain(join.stats.sumAbs / join.stats.count)} MW</span>
              </dd>
            </div>
            {join.stats.above && (
              <div>
                <dt>Most above forecast</dt>
                <dd>
                  {signedMw(join.stats.above.v)} MW
                  <span className="gf-stat-when">{when(join.stats.above.t)}</span>
                </dd>
              </div>
            )}
            {join.stats.below && (
              <div>
                <dt>Most below forecast</dt>
                <dd>
                  {signedMw(join.stats.below.v)} MW
                  <span className="gf-stat-when">{when(join.stats.below.t)}</span>
                </dd>
              </div>
            )}
          </dl>
          <p className="gf-hint">
            The miss is {outturnName} less the forecast, at the {join.stats.count.toLocaleString('en-GB')} {noun} both hold: above zero, GB drew more than forecast.
          </p>
        </>
      )}
      {rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          The outturn could not be read beside it: <ErrorWords error={rel.error} />
        </p>
      )}
      {rel && oModel && oDef && oDef.count > 0 && join && join.stats.count === 0 && <p className="gf-hint">The forecast and the outturn hold no {noun} in common in this window, so there is no miss to read.</p>}
      {rel && (rel.state === 'empty' || (oDef && oDef.count === 0)) && <p className="gf-hint">No {outturnName} is held in this window, so there is no miss to read.</p>}
    </>
  )
}
