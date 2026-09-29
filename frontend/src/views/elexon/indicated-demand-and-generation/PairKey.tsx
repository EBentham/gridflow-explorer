/**
 * The key for both datasets: each line with its latest half-hour held,
 * selectable to draw it alone; each one's highest and lowest half-hour in
 * the window; then how far ahead the figures drawn were issued, read from
 * each row's own issue time, which is what says which issue the page shows.
 * Demand is the held figure with its sign flipped, and says so.
 */
import { KeyList } from '../../../design/charts'
import { instantLabel } from '../../../design/time'
import { periodName } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { boundaryName, extremesIn, issueStats, latestIn, leadText, pairId, pairOf } from './figures'

export function PairKey({ ctx }: { ctx: PageContext }) {
  const pair = pairOf(ctx)
  const series = pair ? [pair.gen, pair.dem].filter((d) => d !== null) : []
  if (!pair || !series.length) {
    return <p className="gf-hint">Nothing is held for this boundary in this window, so there is nothing to key.</p>
  }
  const when = (t: number) => periodName(t, pair.stepMs, pair.settlement)
  const pickable = series.length > 1 && ctx.mode === 'chart'
  const issue = issueStats(pair)
  const own = pair.ownIsDemand ? 'demand' : 'generation'
  const figures = series.map((d) => ({ d, field: d.key === 'gen' ? ('g' as const) : ('d' as const) }))
  return (
    <>
      <ul className="gf-series-key">
        {figures.map(({ d, field }) => {
          const id = pairId(d)
          const latest = latestIn(pair.rows, field)
          const on = ctx.focus === id
          return (
            <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <KeyList items={[{ key: id, mark: { kind: 'line', color: d.color, dashed: ctx.fixture }, label: <span className="gf-series-name">{d.key === 'gen' ? 'Generation' : 'Demand, sign flipped'}</span> }]} />
                <span className="gf-series-value">{latest ? d.unit.format(latest.v) : '–'}</span>
              </button>
              {latest && <span className="gf-series-when">{when(latest.t)}</span>}
            </li>
          )
        })}
      </ul>
      {pickable && <p className="gf-hint">{ctx.focus ? 'Select it again to draw both.' : 'Select a line to draw it on its own, with its highest and lowest half-hour.'}</p>}
      <dl className="gf-stats">
        {figures.flatMap(({ d, field }) => {
          const ex = extremesIn(pair.rows, field)
          if (!ex) return []
          const name = field === 'g' ? 'generation' : 'demand, flipped'
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
      </dl>
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
            How long before each half-hour the {own} figure drawn for it was issued, over the {issue.count.toLocaleString('en-GB')} held for {boundaryName(pair.boundary)}.{' '}
            {pair.otherState === 'paired' && pair.bothHeld > 0
              ? pair.issueMismatch === 0
                ? 'Both figures at each half-hour come from the same issue.'
                : `The two figures come from different issues at ${pair.issueMismatch.toLocaleString('en-GB')} of the ${pair.bothHeld.toLocaleString('en-GB')} half-hours both hold; the table gives each one’s.`
              : ''}
          </p>
        </>
      ) : (
        <p className="gf-hint">The rows read carry no issue time{pair.bucketed ? ', as they come back as means' : ''}, so how far ahead they were issued can’t be said here.</p>
      )}
    </>
  )
}
