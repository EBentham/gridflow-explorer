/**
 * The key: the mark and name of what the main chart draws, the latest step
 * held (MW offered and bids), then the window's figures: highest and lowest
 * total with when, the mean over the steps held, the different bids, the
 * largest one bid, and how many steps the window holds. A window read as
 * means gets the counts only. A cut-off zone says so here too.
 */
import { KeyList, type KeyItem } from '../../../design/charts'
import { periodLabel } from '../../../design/time'
import { extremesOf } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { n, pageBook } from './figures'
import { oneStep, stepsText } from './words'
import { selectionText } from './zones'

export function BookKey({ ctx }: { ctx: PageContext }) {
  const sel = pageBook(ctx)
  const { zone, book } = sel
  if (!book || !book.held) return <p className="gf-hint">No bid is held in this window for {selectionText(sel)}, so there is nothing to key.</p>
  const when = (t: number) => periodLabel(t, book.stepMs)
  const latest = book.heldRows[book.heldRows.length - 1]
  const drawn = book.bucketed ? book.bids : book.total
  const bars = book.bucketed || book.isolated
  const items: KeyItem[] = [
    {
      key: drawn.key,
      mark: ctx.mode === 'chart' ? (bars ? { kind: 'bars', color: drawn.color, shape: 'rise' } : { kind: 'swatch', color: drawn.color }) : { kind: 'swatch', color: drawn.color },
      label: book.bucketed ? `Bids offered per ${oneStep(book)}, ${selectionText(sel)}` : `MW offered, ${selectionText(sel)}`,
    },
  ]
  const ex = extremesOf(book.rows, book.bucketed ? book.bids : book.total)
  const mw = book.total.unit
  const largest = book.largest
  const ties = book.largestBids.length

  return (
    <>
      <KeyList items={items} />
      <dl className="gf-stats">
        {!book.bucketed && typeof latest.total === 'number' && (
          <div>
            <dt>Latest offered</dt>
            <dd>
              {mw.format(latest.total)}
              <span className="gf-stat-when">{typeof latest.bids === 'number' ? `from ${n(latest.bids)} bids, ` : ''}{when(latest.t)}</span>
            </dd>
          </div>
        )}
        {book.bucketed && typeof latest.bids === 'number' && (
          <div>
            <dt>Latest bids offered</dt>
            <dd>
              {n(latest.bids)}
              <span className="gf-stat-when">{when(latest.t)}</span>
            </dd>
          </div>
        )}
        {ex && ex.high.t !== ex.low.t && (
          <>
            <div>
              <dt>{book.bucketed ? 'Most bids in a step' : 'Highest total'}</dt>
              <dd>
                {book.bucketed ? n(ex.high.v) : mw.format(ex.high.v)}
                <span className="gf-stat-when">{when(ex.high.t)}</span>
              </dd>
            </div>
            <div>
              <dt>{book.bucketed ? 'Fewest bids in a step' : 'Lowest total'}</dt>
              <dd>
                {book.bucketed ? n(ex.low.v) : mw.format(ex.low.v)}
                <span className="gf-stat-when">{when(ex.low.t)}</span>
              </dd>
            </div>
          </>
        )}
        {!book.bucketed && book.total.mean !== null && (
          <div>
            <dt>Mean total</dt>
            <dd>{mw.format(book.total.mean)}</dd>
          </div>
        )}
        <div>
          <dt>Different bids</dt>
          <dd>{n(book.bidCount)}</dd>
        </div>
        {largest && (
          <div>
            <dt>Largest one bid</dt>
            <dd>
              {mw.format(largest.v)}
              <span className="gf-stat-when">
                {ties === 1 ? (
                  <>
                    bid <code>{largest.bid}</code>, {book.largestSteps === 1 ? when(largest.t) : `at ${n(book.largestSteps)} ${stepsText(book)}, first ${when(largest.t)}`}
                  </>
                ) : (
                  <>
                    {n(ties)} bids offer it, among them <code>{largest.bid}</code>, first {when(largest.t)}
                  </>
                )}
              </span>
            </dd>
          </div>
        )}
        <div>
          <dt>{book.bucketed ? 'Steps held' : 'Quarter-hours held'}</dt>
          <dd>{book.expected === null ? n(book.held) : `${n(book.held)} of ${n(book.expected)}`}</dd>
        </div>
      </dl>
      {zone.cutOff && <p className="gf-hint">Not complete: gridflow’s download of {zone.name}’s bids may have been cut off. The main panel says what it holds.</p>}
      <p className="gf-hint">
        In {book.bucketed ? 'bids' : 'MW, as published'}, over the {n(book.held)} {stepsText(book)} held in {ctx.windowText}.{' '}
        {book.bucketed ? 'A bid counts in a step when it was offered at some point in it.' : 'The mean is of those steps; steps with no bid held are gaps, and count in neither.'}
      </p>
    </>
  )
}
