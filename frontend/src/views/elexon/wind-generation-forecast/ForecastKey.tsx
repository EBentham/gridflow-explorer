/**
 * The key: the forecast line, the latest hour held, the window's highest and
 * lowest hour, then which issues of the forecast the hours drawn come from
 * (read from each row's own issue time: this says how many of them were
 * forecast ahead of the hour and how many were issued after it), and, where
 * the metered wind output is read beside it, metered less forecast over the
 * hours both hold, split the same way. Every figure comes from the rows read.
 */
import { KeyList, type KeyItem } from '../../../design/charts'
import { dayLabel, instantLabel, stepNoun } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { extremesOf, latestValue, periodName } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { COLORS, FORECAST, METERED, METERED_KEY, MW_UNIT, issuesByHour, joinMetered, leadText, seriesOf, signedMw, summariseIssues, type DiffStats } from './figures'

function DiffStat({ label, s }: { label: string; s: DiffStats }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {signedMw(s.sum / s.count)} MW
        <span className="gf-stat-when">
          mean absolute {MW_UNIT.plain(s.sumAbs / s.count)} MW, over {s.count.toLocaleString('en-GB')} {s.count === 1 ? 'hour' : 'hours'}
        </span>
      </dd>
    </div>
  )
}

export function ForecastKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const own = seriesOf(model, FORECAST)
  if (!model || !own || !own.count) {
    return <p className="gf-hint">No forecast is held in this window, so there is nothing to key.</p>
  }
  const step = model.stepMs
  const when = (t: number) => periodName(t, step, model.settlement)
  const latest = latestValue(model, own)
  const ex = extremesOf(model.rows, own)
  const unit = own.unit
  const issues = issuesByHour(ctx.response)
  const summary = summariseIssues(issues)
  const rel = ctx.related[METERED_KEY]
  const mModel = rel?.series ?? null
  const mDef = seriesOf(mModel, METERED)
  const join = joinMetered(model, own, mModel, mDef, issues)
  const noun = model.bucketed && step ? meansText(step) : stepNoun(step)

  const items: KeyItem[] = [{ key: 'forecast', mark: { kind: 'line', color: own.color, dashed: ctx.fixture }, label: `${own.label}, ${unit.label ?? 'unit unconfirmed'}` }]
  if (ctx.mode === 'chart' && mDef && mDef.count > 0) {
    items.push({ key: 'metered', mark: { kind: 'line', color: COLORS.metered, dashed: ctx.fixture }, label: 'Metered wind output, working panel' })
  }

  return (
    <>
      <KeyList items={items} />
      <dl className="gf-stats">
        {latest && (
          <div>
            <dt>{model.bucketed ? 'Latest mean' : 'Latest hour held'}</dt>
            <dd>
              {unit.format(latest.v)}
              <span className="gf-stat-when">{when(latest.t)}</span>
            </dd>
          </div>
        )}
        {ex && (
          <>
            <div>
              <dt>Highest</dt>
              <dd>
                {unit.format(ex.high.v)}
                <span className="gf-stat-when">{when(ex.high.t)}</span>
              </dd>
            </div>
            <div>
              <dt>Lowest</dt>
              <dd>
                {unit.format(ex.low.v)}
                <span className="gf-stat-when">{when(ex.low.t)}</span>
              </dd>
            </div>
          </>
        )}
      </dl>
      {summary ? (
        <>
          <dl className="gf-stats">
            <div>
              <dt>Issued before the hour</dt>
              <dd>
                {summary.ahead.toLocaleString('en-GB')} of {summary.hours.toLocaleString('en-GB')} hours
                <span className="gf-stat-when">{summary.longestAhead !== null ? `up to ${leadText(summary.longestAhead)} ahead` : 'none in this window'}</span>
              </dd>
            </div>
            <div>
              <dt>Issued after the hour</dt>
              <dd>
                {summary.after.toLocaleString('en-GB')} of {summary.hours.toLocaleString('en-GB')} hours
                <span className="gf-stat-when">{summary.longestAfter !== null ? `up to ${leadText(summary.longestAfter)} after` : 'none in this window'}</span>
              </dd>
            </div>
            <div>
              <dt>Issues drawn</dt>
              <dd>{summary.issues.length.toLocaleString('en-GB')}</dd>
            </div>
            <div>
              <dt>Newest issue drawn</dt>
              <dd>
                {instantLabel(summary.issues[summary.issues.length - 1])}
                {summary.newestReach !== null && <span className="gf-stat-when">runs to {when(summary.newestReach)}</span>}
              </dd>
            </div>
          </dl>
          <p className="gf-hint">An hour issued after it shows a figure made once the hour had passed, not a forecast made ahead.</p>
        </>
      ) : (
        <p className="gf-hint">The rows read carry no issue time{model.bucketed ? ', as they come back as means' : ''}, so which issue each hour comes from can’t be said here.</p>
      )}
      {rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          The metered wind output could not be read beside it: <ErrorWords error={rel.error} />
        </p>
      )}
      {rel && (rel.state === 'empty' || (mDef && mDef.count === 0)) && <p className="gf-hint">No metered wind output is held in this window, so there is nothing to set the forecast against.</p>}
      {join.all.count > 0 && (
        <>
          <dl className="gf-stats">
            {join.after.count > 0 && <DiffStat label="Metered less forecast, issued after" s={join.after} />}
            {join.ahead.count > 0 && <DiffStat label="Metered less forecast, issued before" s={join.ahead} />}
            {join.ahead.count + join.after.count < join.all.count && <DiffStat label="Metered less forecast" s={join.all} />}
          </dl>
          <p className="gf-hint">
            Each hour’s mean of the metered half-hours less its forecast, over the {join.all.count.toLocaleString('en-GB')} {noun} both hold. Only hours issued before them measure a forecast’s miss.
            {join.meteredTo !== null && summary?.newestReach != null && join.meteredTo < summary.newestReach ? ` Metered output is held locally to ${dayLabel(join.meteredTo)}.` : ''}
          </p>
        </>
      )}
      {mDef && mDef.count > 0 && join.comparable && join.all.count === 0 && <p className="gf-hint">The forecast and the metered output hold no {noun} in common in this window, so there is no difference to read.</p>}
      {mDef && mDef.count > 0 && !join.comparable && <p className="gf-hint">The metered output comes back on a coarser clock than the forecast in this window, so the two are not set against each other. Choose a shorter window.</p>}
    </>
  )
}
