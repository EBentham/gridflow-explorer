/**
 * The key for both datasets: each measure with its latest half-hour held,
 * each one's highest and lowest half-hour in the window, how many half-hours
 * the imbalance sits either side of zero, then how far ahead the figures
 * drawn were issued, read from each row's own issue time, which is what says
 * which issue the page shows.
 */
import { KeyList } from '../../../design/charts'
import { instantLabel } from '../../../design/time'
import { periodName } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { extremesIn, issueStats, latestIn, leadText, mismatchWords, pairOf, signCounts } from './figures'

export function PairKey({ ctx }: { ctx: PageContext }) {
  const pair = pairOf(ctx)
  const series = pair ? [pair.own, pair.other].filter((d) => d !== null) : []
  if (!pair || !series.length) {
    return <p className="gf-hint">Nothing is held in this window, so there is nothing to key.</p>
  }
  const when = (t: number) => periodName(t, pair.stepMs, pair.settlement)
  const issue = issueStats(pair)
  const own = pair.ownIsImbalance ? 'imbalance' : 'margin'
  const figures = series.map((d) => ({ d, field: d.key === 'imb' ? ('i' as const) : ('m' as const) }))
  const signs = pair.imb ? signCounts(pair.rows) : null
  const n = (v: number) => v.toLocaleString('en-GB')
  return (
    <>
      <ul className="gf-series-key">
        {figures.map(({ d, field }) => {
          const latest = latestIn(pair.rows, field)
          return (
            <li key={d.key}>
              <button type="button" disabled>
                <KeyList items={[{ key: d.key, mark: { kind: 'line', color: d.color, dashed: ctx.fixture }, label: <span className="gf-series-name">{d.key === 'imb' ? 'Imbalance' : 'Margin'}</span> }]} />
                <span className="gf-series-value">{latest ? d.unit.format(latest.v) : '–'}</span>
              </button>
              {latest && <span className="gf-series-when">{when(latest.t)}</span>}
            </li>
          )
        })}
      </ul>
      <dl className="gf-stats">
        {figures.flatMap(({ d, field }) => {
          const ex = extremesIn(pair.rows, field)
          if (!ex) return []
          const name = field === 'i' ? 'imbalance' : 'margin'
          return [
            <div key={`${d.key}-high`}>
              <dt>Highest {name}</dt>
              <dd>
                {d.unit.format(ex.high.v)}
                <span className="gf-stat-when">{when(ex.high.t)}</span>
              </dd>
            </div>,
            <div key={`${d.key}-low`}>
              <dt>Lowest {name}</dt>
              <dd>
                {d.unit.format(ex.low.v)}
                <span className="gf-stat-when">{when(ex.low.t)}</span>
              </dd>
            </div>,
          ]
        })}
        {signs && signs.held > 0 && (
          <div>
            <dt>Imbalance below zero</dt>
            <dd>
              {n(signs.below)} of {n(signs.held)}
              <span className="gf-stat-when">
                half-hours held; above zero at {n(signs.above)}
                {signs.held - signs.below - signs.above > 0 ? `, at zero at ${n(signs.held - signs.below - signs.above)}` : ''}
              </span>
            </dd>
          </div>
        )}
      </dl>
      {signs && signs.held > 0 && <p className="gf-hint">gridflow describes an imbalance below zero as the system short and above zero as long; Elexon’s own definition isn’t held here.</p>}
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
            How long before each half-hour the {own} figure drawn for it was issued, over the {n(issue.count)} held. {mismatchWords(pair)}
          </p>
        </>
      ) : (
        <p className="gf-hint">The rows read carry no issue time{pair.bucketed ? ', as they come back as means' : ''}, so how far ahead they were issued can’t be said here.</p>
      )}
    </>
  )
}
