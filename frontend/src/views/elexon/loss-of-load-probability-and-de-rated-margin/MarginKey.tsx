/**
 * The key: the de-rated margin's latest half-hour held, its highest and
 * lowest; the loss of load probability as figures, not a line (its highest,
 * as held and per million, how many half-hours sit above zero, and the
 * margin at those); then how far ahead the figures were issued, read from
 * each row's own issue time, which is what says which issue the page shows.
 */
import { KeyList } from '../../../design/charts'
import { instantLabel } from '../../../design/time'
import { periodName } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { extremesIn, issueStats, latestIn, leadText, lolpStats, lolpText, modelOf, perMillionText } from './figures'

export function MarginKey({ ctx }: { ctx: PageContext }) {
  const model = modelOf(ctx)
  if (!model || (!model.margin && !model.lolp)) {
    return <p className="gf-hint">Nothing is held in this window, so there is nothing to key.</p>
  }
  const when = (t: number) => periodName(t, model.stepMs, model.settlement)
  const n = (v: number) => v.toLocaleString('en-GB')
  const noun = model.bucketed ? 'periods' : 'half-hours'
  const margin = model.margin
  const latest = latestIn(model.rows, 'm')
  const ex = extremesIn(model.rows, 'm')
  const lolp = lolpStats(model)
  const issue = issueStats(model)
  return (
    <>
      {margin && (
        <ul className="gf-series-key">
          <li>
            <button type="button" disabled>
              <KeyList items={[{ key: margin.key, mark: { kind: 'line', color: margin.color, dashed: ctx.fixture }, label: <span className="gf-series-name">De-rated margin</span> }]} />
              <span className="gf-series-value">{latest ? margin.unit.format(latest.v) : '–'}</span>
            </button>
            {latest && <span className="gf-series-when">{when(latest.t)}</span>}
          </li>
        </ul>
      )}
      <dl className="gf-stats">
        {margin && ex && (
          <>
            <div>
              <dt>Highest margin</dt>
              <dd>
                {margin.unit.format(ex.high.v)}
                <span className="gf-stat-when">{when(ex.high.t)}</span>
              </dd>
            </div>
            <div>
              <dt>Lowest margin</dt>
              <dd>
                {margin.unit.format(ex.low.v)}
                <span className="gf-stat-when">{when(ex.low.t)}</span>
              </dd>
            </div>
          </>
        )}
        {lolp.held > 0 && (
          <>
            <div>
              <dt>Highest loss of load probability</dt>
              <dd>
                {lolp.highest ? lolpText(lolp.highest.v) : '0'}
                <span className="gf-stat-when">{lolp.highest ? `${perMillionText(lolp.highest.v)}, ${when(lolp.highest.t)}` : `held as 0 at every one of the ${n(lolp.held)} ${noun} held`}</span>
              </dd>
            </div>
            {lolp.above > 0 && (
              <div>
                <dt>Probability above zero</dt>
                <dd>
                  {n(lolp.above)} of {n(lolp.held)}
                  <span className="gf-stat-when">
                    {noun} held
                    {lolp.marginAbove && margin
                      ? `, at a de-rated margin of ${lolp.marginAbove.low === lolp.marginAbove.high ? margin.unit.format(lolp.marginAbove.low) : `${margin.unit.plain(lolp.marginAbove.low)} to ${margin.unit.format(lolp.marginAbove.high)}`}`
                      : ''}
                    {lolp.lowestMarginAtZero && margin ? `; the lowest margin where it is 0 is ${margin.unit.format(lolp.lowestMarginAtZero.v)}` : ''}
                  </span>
                </dd>
              </div>
            )}
          </>
        )}
      </dl>
      {lolp.held > 0 && (
        <p className="gf-hint">
          The loss of load probability runs from 0 to 1, as the source list and gridflow describe it; Elexon’s own definition isn’t held here. It is printed to seven decimal places at least, so a small one never reads as 0.
        </p>
      )}
      {issue ? (
        <>
          <dl className="gf-stats">
            <div>
              <dt>Issued ahead, median</dt>
              <dd>
                {leadText(issue.median)}
                <span className="gf-stat-when">{issue.shortest === issue.longest ? 'for every half-hour held' : `shortest ${leadText(issue.shortest)}, longest ${leadText(issue.longest)}`}</span>
              </dd>
            </div>
            <div>
              <dt>Newest issue held</dt>
              <dd>{instantLabel(issue.newest)}</dd>
            </div>
          </dl>
          <p className="gf-hint">How long before each half-hour the figures drawn for it were issued, over the {n(issue.count)} held. Both figures at a half-hour come from the same issue.</p>
        </>
      ) : (
        <p className="gf-hint">The rows read carry no issue time{model.bucketed ? ', as they come back as means' : ''}, so how far ahead they were issued can’t be said here.</p>
      )}
    </>
  )
}
