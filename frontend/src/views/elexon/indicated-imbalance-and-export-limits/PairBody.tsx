/**
 * The main panel for both datasets. Chart: the page's own dataset on top and
 * the other below it, each on an axis of its own in GW and on one clock
 * (the imbalance runs either side of zero, the margin tens of GW above it,
 * so one axis would flatten the imbalance); each panel labels its highest and
 * lowest half-hour. Table: a row per half-hour in MW, both figures, with the
 * issue each comes from and how far ahead it was made.
 */
import { HOUR_MS, instantLabel, periodLabel, stepNoun, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { meansText } from '../../_template/text'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, BOUNDARY_WORDS, MW_UNIT, leadText, pairOf, type Pair, type PairRow } from './figures'

const dash = <span className="gf-cell-missing">–</span>

/** Why the other dataset isn't drawn beside the page's own, when it isn't. */
export function OtherNote({ pair }: { pair: Pair }) {
  const name = pair.ownIsImbalance ? 'Indicated margin' : 'Indicated imbalance'
  if (pair.otherState === 'paired' || pair.otherState === 'loading') return null
  if (pair.otherState === 'failed')
    return (
      <p className="gf-hint">
        {name} could not be read beside it, so only one chart is drawn: <ErrorWords error={pair.related?.error ?? null} />
      </p>
    )
  if (pair.otherState === 'other clock')
    return <p className="gf-hint">{name} came back as means over longer periods than these rows in this window, so the two aren’t set side by side. Choose a shorter window to see both.</p>
  return <p className="gf-hint">No {name.toLowerCase()} is held in this window, so only one chart is drawn.</p>
}

function PairTable({ ctx, pair }: { ctx: PageContext; pair: Pair }) {
  const mw = (v: number | null) => (v === null ? dash : MW_UNIT.plain(v))
  const split = pair.issueMismatch > 0
  const issued = (at: number | null) => (at === null ? dash : instantLabel(at))
  const ownIssued = (r: PairRow) => {
    const c = pair.cells.get(r.t)
    return (pair.ownIsImbalance ? c?.imbIssued : c?.marIssued) ?? null
  }
  const imbCol: TableCol<PairRow> = {
    key: 'i',
    label: 'Imbalance, MW',
    num: true,
    render: (r) => mw(pair.cells.get(r.t)?.imbMw ?? null),
    sortValue: (r) => pair.cells.get(r.t)?.imbMw ?? null,
  }
  const marCol: TableCol<PairRow> = {
    key: 'm',
    label: 'Margin, MW',
    num: true,
    render: (r) => mw(pair.cells.get(r.t)?.marMw ?? null),
    sortValue: (r) => pair.cells.get(r.t)?.marMw ?? null,
  }
  const cols: TableCol<PairRow>[] = [
    { key: 't', label: pair.bucketed ? 'Period (means)' : 'Half-hour', render: (r) => periodLabel(r.t, pair.stepMs), sortValue: (r) => r.t },
    // The half-hour names its UK day; the SP is the backend's, never derived.
    ...(pair.settlement
      ? [
          { key: 'sp', label: 'SP', num: true, render: (r: PairRow) => pair.settlement?.get(r.t)?.period ?? dash, sortValue: (r: PairRow) => pair.settlement?.get(r.t)?.period ?? null },
        ]
      : []),
    ...(pair.ownIsImbalance ? [imbCol, marCol] : [marCol, imbCol]),
    ...(split
      ? [
          { key: 'ii', label: 'Imbalance issued', render: (r: PairRow) => issued(pair.cells.get(r.t)?.imbIssued ?? null), sortValue: (r: PairRow) => pair.cells.get(r.t)?.imbIssued ?? null },
          { key: 'mi', label: 'Margin issued', render: (r: PairRow) => issued(pair.cells.get(r.t)?.marIssued ?? null), sortValue: (r: PairRow) => pair.cells.get(r.t)?.marIssued ?? null },
        ]
      : [{ key: 'is', label: 'Issued', render: (r: PairRow) => issued(ownIssued(r)), sortValue: (r: PairRow) => ownIssued(r) }]),
    {
      key: 'l',
      label: 'Issued ahead',
      num: true,
      render: (r) => (typeof r.l === 'number' ? leadText(r.l * HOUR_MS) : dash),
      sortValue: (r) => (typeof r.l === 'number' ? r.l : null),
    },
  ]
  const steps = pair.bucketed && pair.stepMs ? meansText(pair.stepMs) : stepNoun(pair.stepMs)
  const own = pair.ownIsImbalance ? 'imbalance' : 'margin'
  const held = pair.rows.filter((r) => typeof r.i === 'number' || typeof r.m === 'number').length
  const caption = `Boundary N, ${ctx.windowText}: ${pair.rows.length.toLocaleString('en-GB')} ${steps}, ${held.toLocaleString('en-GB')} held. Select a column heading to sort.`
  return (
    <>
      <WindowedTable columns={cols} rows={pair.rows} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => r.t} />
      <p className="gf-hint">
        Indicated imbalance and indicated margin in MW, as held, for {BOUNDARY_WORDS}.{' '}
        {split
          ? `The two figures’ issue times differ at ${pair.issueMismatch.toLocaleString('en-GB')} of the ${pair.bothHeld.toLocaleString('en-GB')} half-hours both hold, by ${leadText(pair.widestMismatch)} at most, so each has its own issue column. `
          : pair.bothHeld > 0
            ? 'Both figures at each half-hour come from the same issue, named under Issued. '
            : ''}
        Issued ahead is how long before the half-hour the {own} figure was issued. A dash is a half-hour with no figure held.
      </p>
    </>
  )
}

export function PairBody({ ctx }: { ctx: PageContext }) {
  const pair = pairOf(ctx)
  if (!pair || !ctx.window) return null
  if (ctx.mode === 'table')
    return (
      <>
        <OtherNote pair={pair} />
        <PairTable ctx={ctx} pair={pair} />
      </>
    )
  if (!pair.own) return <p className="gf-state">Rows are held for this window, but none holds a figure. The table lists them.</p>
  const panel = (d: NonNullable<Pair['own']>, height: number, labelled: boolean): ChartPanel => ({
    rows: pair.rows,
    series: [d],
    mark: 'line',
    unit: d.unit,
    stepMs: pair.stepMs,
    bucketed: pair.bucketed,
    settlement: pair.settlement,
    height,
    extremes: labelled ? d : null,
    zero: d.key === 'imb',
    axisWidth: AXIS_WIDTH,
  })
  // The lower panel's labels would sit on the clock's labels; the key gives its highest and lowest.
  const panels = [panel(pair.own, 300, true), ...(pair.other ? [panel(pair.other, 190, false)] : [])]
  const means = pair.bucketed && pair.stepMs ? meansText(pair.stepMs) : null
  const top = pair.ownIsImbalance ? 'indicated imbalance' : 'indicated margin'
  const below = pair.ownIsImbalance ? 'indicated margin' : 'indicated imbalance'
  return (
    <>
      <OtherNote pair={pair} />
      <SeriesChart panels={panels} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      <p className="gf-hint">
        {pair.other ? `On top, ${top}, with its highest and lowest half-hour labelled; below it, ${below}, on the same clock with an axis of its own (the key gives its highest and lowest).` : `${top.replace(/^i/, 'I')} alone, with its highest and lowest half-hour labelled.`}{' '}
        {means ? `As ${means}` : 'One figure per half-hour'}, {BOUNDARY_WORDS}. The imbalance axis always takes in zero. A half-hour with no figure held is a gap.
      </p>
    </>
  )
}
