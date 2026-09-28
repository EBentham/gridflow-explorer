/**
 * The main panel. Up to 31 days it is the template's series body: every
 * half-hour, the fuels stacked with the carbon intensity below (Chart), or
 * every half-hour as a row (Table). The carbon intensity's highest and lowest
 * half-hours are then given in words under the chart, not labelled on it: the
 * template's lowest label can run over the date ticks (NEEDS.md). Past 31
 * days, the long view: each UK day's or month's mean (`periods.ts`), drawn by
 * `LongChart` or listed a row per point with its year, as the template's
 * table names no year. Either way the embedded-wind hatch is drawn here, by
 * the chart that uses it.
 */
import { useMemo } from 'react'
import { periodLabel, windowDomain } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import { SeriesBody } from '../../_template/SeriesBody'
import type { SeriesModel, WideRow } from '../../_template/seriesModel'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { CI, CI_LABEL, FUELS, seriesOf } from './fuels'
import { LongChart } from './LongChart'
import { clockOf, heldText, periodName, periodsOf, periodText, pointKindOf, rowKindOf, stepsText, type Clock, type Period } from './periods'
import { WindHatch } from './WindHatch'

const dash = <span className="gf-cell-missing">–</span>

function LongTable({ ctx, periods, stepWords }: { ctx: PageContext; periods: Period[]; stepWords: string }) {
  const model = ctx.series as SeriesModel
  const gw = seriesOf(model, 'gas')?.unit
  const ci = seriesOf(model, CI)?.unit
  const num = (v: number | null, plain?: (x: number) => string) => (v === null || !plain ? dash : plain(v))
  const kind = periods[0]?.kind ?? 'day'
  const gwLabel = gw?.label ?? 'unit unconfirmed'
  const columns: TableCol<Period>[] = [
    { key: 'period', label: kind === 'month' ? 'Month' : 'Day', render: (p) => periodName(p, { short: true }), sortValue: (p) => p.start },
    { key: 'held', label: `Held, ${stepWords}`, num: true, render: (p) => (p.held ? heldText(p) : 'not held locally'), sortValue: (p) => p.held },
    // The total and the carbon intensity first, so they read without scrolling past eleven fuels.
    { key: 'total', label: `Total, ${gwLabel}`, num: true, render: (p) => num(p.total, gw?.plain), sortValue: (p) => p.total },
    { key: CI, label: `${CI_LABEL}, ${ci?.label ?? 'unit unconfirmed'}`, num: true, render: (p) => num(p.mean[CI], ci?.plain), sortValue: (p) => p.mean[CI] },
    ...[...FUELS].reverse().map<TableCol<Period>>((f) => ({
      key: f.column,
      label: `${f.label}, ${gwLabel}`,
      num: true,
      render: (p) => num(p.mean[f.column], gw?.plain),
      sortValue: (p) => p.mean[f.column],
    })),
  ]
  const noun = kind === 'month' ? 'months' : 'days'
  const caption = `Generation by fuel, ${ctx.windowText}: ${periods.length.toLocaleString('en-GB')} ${noun}, each the mean of the ${stepWords} held in it. Select a column heading to sort.`
  return (
    <WindowedTable
      columns={columns}
      rows={periods}
      caption={caption}
      initialSort={{ key: 'period', dir: 'asc' }}
      rowKey={(p) => p.key}
      rowClass={(p) => (p.held === 0 ? 'is-missing' : undefined)}
    />
  )
}

/** Where a long view's first or last point stands for less than its whole month. */
function edgeText(periods: Period[]): string {
  const cut = (p: Period | undefined) => (p && !p.whole ? p : undefined)
  const first = cut(periods[0])
  const last = periods.length > 1 ? cut(periods.at(-1)) : undefined
  if (first && last) return ` The first point covers only ${periodName(first)} and the last only ${periodName(last)}: the days of those months inside the window.`
  const one = first ?? last
  return one ? ` The ${one === first ? 'first' : 'last'} point covers only ${periodName(one)}, the days of ${periodText(one)} inside the window.` : ''
}

function LongBody({ ctx, window, clock }: { ctx: PageContext; window: DateRange; clock: Clock }) {
  const model = ctx.series as SeriesModel
  const pointKind = pointKindOf(clock)
  const periods = useMemo(() => periodsOf(model, window, pointKind as 'day' | 'month'), [model, window, pointKind])
  const rowPeriods = useMemo(() => periodsOf(model, window, rowKindOf(clock) as 'month' | 'year'), [model, window, clock])
  const domain = useMemo(() => windowDomain(window.start, window.end), [window])
  const gw = seriesOf(model, 'gas')?.unit
  const ci = seriesOf(model, CI)?.unit
  const stepWords = stepsText(model)
  if (!gw || !ci) return <p className="gf-state">The rows came back without the fuel columns, so there is nothing to draw.</p>
  if (ctx.mode === 'table') return <LongTable ctx={ctx} periods={periods} stepWords={stepWords} />
  const unit = pointKind === 'month' ? 'calendar month' : 'UK day'
  const rowKind = rowKindOf(clock)
  return (
    <>
      <LongChart periods={periods} rowPeriods={rowPeriods} clock={clock} domain={domain} gw={gw} ci={ci} stepWords={stepWords} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} />
      <p className="gf-hint">
        Each point is one {unit}: the mean of the {stepWords} held in it, each fuel over its own values. A {pointKind} with none held is a gap.
        {edgeText(periods)} Click the chart, or a row of the table below, to select a {rowKind}.
      </p>
    </>
  )
}

/** The carbon intensity's highest and lowest half-hour held in the window, as a sentence; empty when there's no range to give. */
function ciExtremesText(model: SeriesModel): string {
  const d = seriesOf(model, CI)
  if (!d) return ''
  let high: WideRow | undefined
  let low: WideRow | undefined
  for (const row of model.rows) {
    const v = row[d.field]
    if (typeof v !== 'number') continue
    if (!high || v > (high[d.field] as number)) high = row
    if (!low || v < (low[d.field] as number)) low = row
  }
  if (!high || !low || high === low) return ''
  const at = (row: WideRow) => `${d.unit.format(row[d.field] as number)} (${periodLabel(row.t, model.stepMs)})`
  return `In this window, carbon intensity was highest at ${at(high)} and lowest at ${at(low)}.`
}

export function MixBody({ ctx }: { ctx: PageContext }) {
  const clock = clockOf(ctx.window)
  if (clock === 'native' || !ctx.series || !ctx.window) {
    const extremes = ctx.series && ctx.state === 'data' && ctx.mode !== 'table' ? ciExtremesText(ctx.series) : ''
    return (
      <>
        <WindHatch />
        <SeriesBody ctx={ctx} />
        {extremes && <p className="gf-hint">{extremes}</p>}
      </>
    )
  }
  return (
    <>
      <WindHatch />
      <LongBody ctx={ctx} window={ctx.window} clock={clock} />
    </>
  )
}
