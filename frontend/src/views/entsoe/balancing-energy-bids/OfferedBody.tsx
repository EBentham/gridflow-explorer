/**
 * The main panel.
 *
 * Chart: the MW offered in the zone and direction at each quarter-hour, the
 * bids added up, with the highest and lowest labelled. Where every held
 * quarter-hour stands alone (a cut-off zone's one a day), bars on the held
 * steps, as a band needs two neighbours to draw. A window read as means gets
 * the bids offered per step instead, and says why no MW is added up.
 *
 * Table: one row per step some bid holds, with the total, the bids and the
 * largest one; the steps no bid holds are counted under it, not listed.
 */
import { periodLabel, windowDomain } from '../../../design/time'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import type { WideRow } from '../../_template/seriesModel'
import { AXIS_WIDTH, n, pageBook, type Book } from './figures'
import { cutOffText, dailyHoleText, oneStep, stepCount, stepsText } from './words'

/** A cut-off zone's line, set as a caveat over the chart or table. */
export function CutOffNote({ ctx }: { ctx: PageContext }) {
  const { zone, book } = pageBook(ctx)
  const text = cutOffText(zone, book)
  if (!text) return null
  return (
    <div className="gf-notes">
      <p className="is-caveat">{text}</p>
    </div>
  )
}

function MeansWords({ book }: { book: Book }) {
  return (
    <p className="gf-hint">
      This window is read as each bid’s {stepsText(book)}, and a sum of those means isn’t the MW offered: a bid offered for part of a step would count as if offered for all of it. So the chart counts the bids offered at some point in each{' '}
      {oneStep(book)} and adds up no MW. A shorter window reads the MW offered.
    </p>
  )
}

function StepTable({ book }: { book: Book }) {
  const cols: TableCol<WideRow>[] = [
    { key: 't', label: book.bucketed ? 'Step' : 'Quarter-hour', render: (r) => periodLabel(r.t, book.stepMs), sortValue: (r) => r.t },
    ...(book.bucketed
      ? []
      : [
          {
            key: 'total',
            label: `Offered, ${book.total.unit.label}`,
            num: true,
            render: (r: WideRow) => (typeof r.total === 'number' ? book.total.unit.plain(r.total) : '–'),
            sortValue: (r: WideRow) => (typeof r.total === 'number' ? r.total : null),
          },
        ]),
    {
      key: 'bids',
      label: book.bucketed ? 'Bids offered in the step' : 'Bids',
      num: true,
      render: (r) => (typeof r.bids === 'number' ? n(r.bids) : '–'),
      sortValue: (r) => (typeof r.bids === 'number' ? r.bids : null),
    },
    ...(book.bucketed
      ? []
      : [
          {
            key: 'top',
            label: `Largest bid, ${book.total.unit.label}`,
            num: true,
            render: (r: WideRow) => {
              const top = book.tops.get(r.t)
              return top ? book.total.unit.plain(top.v) : '–'
            },
            sortValue: (r: WideRow) => book.tops.get(r.t)?.v ?? null,
          },
          {
            key: 'topBid',
            label: 'Largest bid’s id',
            render: (r: WideRow) => {
              const top = book.tops.get(r.t)
              return top ? <code>{top.bid}</code> : '–'
            },
          },
        ]),
  ]
  const missing = book.rows.length - book.held
  return (
    <>
      <WindowedTable columns={cols} rows={book.heldRows} caption={book.bucketed ? `Bids offered per ${oneStep(book)}` : `MW offered and bids per ${oneStep(book)}`} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => r.t} />
      <p className="gf-hint">
        {stepCount(book, book.held)} {book.held === 1 ? 'holds' : 'hold'} a bid{missing > 0 ? `; ${n(missing)} more in the window hold none and are left out of the table, as gaps, not zeros` : ''}. The largest bid is the one offering the most MW at that step; where two offer the same, the table names one.
      </p>
      {book.bucketed && <MeansWords book={book} />}
    </>
  )
}

export function OfferedBody({ ctx }: { ctx: PageContext }) {
  const { book } = pageBook(ctx)
  if (!book || !ctx.window) return null
  if (!book.held) return <p className="gf-state">No bid is held in this window for this zone and direction.</p>
  if (ctx.mode === 'table') {
    return (
      <>
        <CutOffNote ctx={ctx} />
        <StepTable book={book} />
      </>
    )
  }
  const hole = dailyHoleText(book, ctx.window)
  const panel: ChartPanel = book.bucketed
    ? { rows: book.isolated ? book.heldRows : book.rows, series: [book.bids], mark: 'bars', unit: book.bids.unit, stepMs: book.stepMs, bucketed: true, zero: true, axisWidth: AXIS_WIDTH, extremes: book.bids }
    : {
        rows: book.isolated ? book.heldRows : book.rows,
        series: [book.total],
        mark: book.isolated ? 'bars' : 'stacked',
        unit: book.total.unit,
        stepMs: book.stepMs,
        zero: true,
        axisWidth: AXIS_WIDTH,
        extremes: book.total,
      }
  return (
    <>
      <CutOffNote ctx={ctx} />
      <SeriesChart panels={[panel]} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      {book.bucketed ? (
        <MeansWords book={book} />
      ) : (
        <p className="gf-hint">
          Each {oneStep(book)} adds up the MW of every bid offered in it: {n(book.bidCount)} different bids in this window. A {oneStep(book)} with no bid held is a gap, not zero; nothing in these rows tells an empty book from a {oneStep(book)} that wasn’t fetched.
          {book.isolated ? ` No two held ${stepsText(book)} sit side by side, so each is drawn as a bar.` : ''}
          {hole ? ` ${hole}` : ''}
        </p>
      )}
    </>
  )
}
