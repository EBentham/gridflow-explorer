/**
 * The main panel for both datasets. Chart: indicated generation and
 * indicated demand for one boundary on one axis in GW, demand with its sign
 * flipped (it is held negative) so the two read side by side; a line
 * selected in the key is drawn alone with its highest and lowest half-hour
 * labelled. Table: a row per half-hour in MW, demand both as held and
 * flipped, with the issue each figure comes from.
 */
import { HOUR_MS, instantLabel, leadText, periodLabel, stepNoun, windowDomain } from '../../../design/time'
import { boundaryName, boundaryOf } from '../../_template/boundaries'
import { dashCell } from '../../_template/cells'
import type { Pair, PairRow } from '../../_template/issuePair'
import { ErrorWords } from '../../_template/panels'
import { AXIS_WIDTH, SeriesChart } from '../../_template/SeriesChart'
import { meansText } from '../../_template/text'
import { MW } from '../../_template/units'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { pairFor, pairId } from './figures'

/** Why the other dataset isn't drawn beside the page's own, when it isn't. */
function OtherNote({ pair, boundary }: { pair: Pair; boundary: string }) {
  const name = pair.ownIsA ? 'Indicated demand' : 'Indicated generation'
  if (pair.otherState === 'paired' || pair.otherState === 'loading') return null
  if (pair.otherState === 'failed')
    return (
      <p className="gf-hint">
        {name} could not be read beside it, so only one line is drawn: <ErrorWords error={pair.related?.error ?? null} />
      </p>
    )
  if (pair.otherState === 'other clock')
    return <p className="gf-hint">{name} came back as means over longer periods than these rows in this window, so the two aren’t set side by side. Choose a shorter window to see both.</p>
  return <p className="gf-hint">No {name.toLowerCase()} is held for {boundaryName(boundary)} in this window, so only one line is drawn.</p>
}

function PairTable({ ctx, pair, boundary }: { ctx: PageContext; pair: Pair; boundary: string }) {
  const mw = (v: number | null) => (v === null ? dashCell : MW.plain(v))
  const split = pair.issueMismatch > 0
  const issued = (at: number | null) => (at === null ? dashCell : instantLabel(at))
  const ownIssued = (r: PairRow) => {
    const c = pair.cells.get(r.t)
    return (pair.ownIsA ? c?.aIssued : c?.bIssued) ?? null
  }
  const cols: TableCol<PairRow>[] = [
    { key: 't', label: pair.bucketed ? 'Period (means)' : 'Half-hour', render: (r) => periodLabel(r.t, pair.stepMs), sortValue: (r) => r.t },
    // The half-hour names its UK day; the SP is the backend's, never derived.
    ...(pair.settlement
      ? [
          { key: 'sp', label: 'SP', num: true, render: (r: PairRow) => pair.settlement?.get(r.t)?.period ?? dashCell, sortValue: (r: PairRow) => pair.settlement?.get(r.t)?.period ?? null },
        ]
      : []),
    { key: 'g', label: 'Generation, MW', num: true, render: (r) => mw(pair.cells.get(r.t)?.aMw ?? null), sortValue: (r) => pair.cells.get(r.t)?.aMw ?? null },
    { key: 'dh', label: 'Demand as held, MW', num: true, render: (r) => mw(pair.cells.get(r.t)?.bMw ?? null), sortValue: (r) => pair.cells.get(r.t)?.bMw ?? null },
    {
      key: 'df',
      label: 'Demand, sign flipped, MW',
      num: true,
      render: (r) => {
        const v = pair.cells.get(r.t)?.bMw ?? null
        return v === null ? dashCell : MW.plain(-v)
      },
      sortValue: (r) => {
        const v = pair.cells.get(r.t)?.bMw ?? null
        return v === null ? null : -v
      },
    },
    ...(split
      ? [
          { key: 'gi', label: 'Generation issued', render: (r: PairRow) => issued(pair.cells.get(r.t)?.aIssued ?? null), sortValue: (r: PairRow) => pair.cells.get(r.t)?.aIssued ?? null },
          { key: 'di', label: 'Demand issued', render: (r: PairRow) => issued(pair.cells.get(r.t)?.bIssued ?? null), sortValue: (r: PairRow) => pair.cells.get(r.t)?.bIssued ?? null },
        ]
      : [{ key: 'i', label: 'Issued', render: (r: PairRow) => issued(ownIssued(r)), sortValue: (r: PairRow) => ownIssued(r) }]),
    {
      key: 'l',
      label: 'Issued ahead',
      num: true,
      render: (r) => (typeof r.l === 'number' ? leadText(r.l * HOUR_MS) : dashCell),
      sortValue: (r) => (typeof r.l === 'number' ? r.l : null),
    },
  ]
  const steps = pair.bucketed && pair.stepMs ? meansText(pair.stepMs) : stepNoun(pair.stepMs)
  const own = pair.ownIsA ? 'generation' : 'demand'
  const held = pair.rows.filter((r) => typeof r.a === 'number' || typeof r.b === 'number').length
  const caption = `${boundaryName(boundary).replace(/^b/, 'B')}, ${ctx.windowText}: ${pair.rows.length.toLocaleString('en-GB')} ${steps}, ${held.toLocaleString('en-GB')} held. Demand as held is negative; flipped is the same figure with its sign turned. Select a column heading to sort.`
  return (
    <>
      <WindowedTable columns={cols} rows={pair.rows} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => r.t} />
      <p className="gf-hint">
        Generation and demand in MW, as held but for the flipped column, which is how the chart draws demand.{' '}
        {split
          ? `The two figures come from different issues at ${pair.issueMismatch.toLocaleString('en-GB')} of the ${pair.bothHeld.toLocaleString('en-GB')} half-hours both hold, so each has its own issue column. `
          : pair.bothHeld > 0
            ? 'Both figures at each half-hour come from the same issue, named under Issued. '
            : ''}
        Issued ahead is how long before the half-hour the {own} figure was issued. A dash is a half-hour with no figure held.
      </p>
    </>
  )
}

export function PairBody({ ctx }: { ctx: PageContext }) {
  const pair = pairFor(ctx)
  const boundary = boundaryOf(ctx)
  if (!pair || !ctx.window) return null
  if (ctx.mode === 'table')
    return (
      <>
        <OtherNote pair={pair} boundary={boundary} />
        <PairTable ctx={ctx} pair={pair} boundary={boundary} />
      </>
    )
  const series = [pair.a, pair.b].filter((d) => d !== null)
  if (!series.length) return <p className="gf-state">Rows are held for this window, but none holds a figure for {boundaryName(boundary)}. The table lists them.</p>
  const focus = series.find((d) => pairId(d) === ctx.focus) ?? null
  const means = pair.bucketed && pair.stepMs ? meansText(pair.stepMs) : null
  return (
    <>
      <OtherNote pair={pair} boundary={boundary} />
      <SeriesChart
        panels={[
          {
            rows: pair.rows,
            series,
            mark: 'line',
            unit: series[0].unit,
            stepMs: pair.stepMs,
            bucketed: pair.bucketed,
            settlement: pair.settlement,
            height: 440,
            extremes: focus,
            axisWidth: AXIS_WIDTH,
          },
        ]}
        domain={windowDomain(ctx.window.start, ctx.window.end)}
        focus={ctx.focus}
        picked={ctx.picked}
        onPick={ctx.pick}
      />
      <p className="gf-hint">
        {focus ? `${focus.label} alone, ` : 'Both lines, '}
        {means ? `as ${means}` : 'one figure per half-hour'}, {boundaryName(boundary)}. Indicated demand is held as a negative figure: the chart turns its sign so that it reads above zero beside generation, and the table gives it both ways. A half-hour with no figure held is a gap.
      </p>
    </>
  )
}
