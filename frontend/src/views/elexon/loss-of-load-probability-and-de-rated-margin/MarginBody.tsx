/**
 * The main panel. Chart: the de-rated margin in GW, zero on the axis, with
 * its highest and lowest half-hour labelled; above it, on the same clock,
 * the loss of load probability as bars per million, drawn only when some
 * half-hour in the window holds one above zero (all zeros would be a flat
 * line). Table: a row per half-hour, the margin in MW, the probability as
 * held, and the issue both come from with how far ahead it was made.
 */
import { plural } from '../../../design/format'
import { HOUR_MS, instantLabel, periodLabel, stepNoun, windowDomain } from '../../../design/time'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { meansText } from '../../_template/text'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, MW_UNIT, leadText, lolpStats, lolpText, modelOf, type MarginRow, type Model } from './figures'

const dash = <span className="gf-cell-missing">–</span>

function MarginTable({ ctx, model }: { ctx: PageContext; model: Model }) {
  const cell = (r: MarginRow) => model.cells.get(r.t)
  const cols: TableCol<MarginRow>[] = [
    { key: 't', label: model.bucketed ? 'Period (means)' : 'Half-hour', render: (r) => periodLabel(r.t, model.stepMs), sortValue: (r) => r.t },
    // The half-hour names its UK day; the SP is the backend's, never derived.
    ...(model.settlement
      ? [{ key: 'sp', label: 'SP', num: true, render: (r: MarginRow) => model.settlement?.get(r.t)?.period ?? dash, sortValue: (r: MarginRow) => model.settlement?.get(r.t)?.period ?? null }]
      : []),
    {
      key: 'm',
      label: 'De-rated margin, MW',
      num: true,
      render: (r) => {
        const v = cell(r)?.mw ?? null
        return v === null ? dash : MW_UNIT.plain(v)
      },
      sortValue: (r) => cell(r)?.mw ?? null,
    },
    {
      key: 'p',
      label: 'Loss of load probability',
      num: true,
      render: (r) => {
        const v = cell(r)?.lolp ?? null
        return v === null ? dash : lolpText(v)
      },
      sortValue: (r) => cell(r)?.lolp ?? null,
    },
    ...(model.bucketed
      ? []
      : [
          {
            key: 'is',
            label: 'Issued',
            render: (r: MarginRow) => {
              const at = cell(r)?.issued ?? null
              return at === null ? dash : instantLabel(at)
            },
            sortValue: (r: MarginRow) => cell(r)?.issued ?? null,
          },
          {
            key: 'l',
            label: 'Issued ahead',
            num: true,
            render: (r: MarginRow) => (typeof r.l === 'number' ? leadText(r.l * HOUR_MS) : dash),
            sortValue: (r: MarginRow) => (typeof r.l === 'number' ? r.l : null),
          },
        ]),
  ]
  const steps = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const held = model.rows.filter((r) => typeof r.m === 'number' || typeof r.p === 'number').length
  const caption = `${ctx.windowText}: ${model.rows.length.toLocaleString('en-GB')} ${steps}, ${held.toLocaleString('en-GB')} held. Select a column heading to sort.`
  return (
    <>
      <WindowedTable columns={cols} rows={model.rows} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => r.t} />
      <p className="gf-hint">
        De-rated margin in MW and loss of load probability as held; the probability is printed to seven decimal places at least, so a small one never reads as 0, and a 0 is a 0 as held.{' '}
        {model.bucketed ? 'These are means over each period, which carry no issue time. ' : 'Both figures at a half-hour come from one issue, named under Issued, with how long before the half-hour it was made. '}A dash is a
        half-hour with no figure held.
      </p>
    </>
  )
}

export function MarginBody({ ctx }: { ctx: PageContext }) {
  const model = modelOf(ctx)
  if (!model || !ctx.window) return null
  if (ctx.mode === 'table') return <MarginTable ctx={ctx} model={model} />
  if (!model.margin) return <p className="gf-state">Rows are held for this window, but none holds a de-rated margin. The table lists them.</p>
  const lolp = lolpStats(model)
  const drawLolp = Boolean(model.lolp && lolp.above > 0)
  const base = { rows: model.rows, stepMs: model.stepMs, bucketed: model.bucketed, settlement: model.settlement, axisWidth: AXIS_WIDTH }
  // The probability sits above the margin: the lowest panel carries the clock, and a taller panel above it would lose its zero tick.
  const panels: ChartPanel[] = [
    ...(drawLolp && model.lolp ? [{ ...base, series: [model.lolp], mark: 'bars' as const, unit: model.lolp.unit, height: 130, zero: true }] : []),
    { ...base, series: [model.margin], mark: 'line', unit: model.margin.unit, height: drawLolp ? 300 : 340, extremes: model.margin, zero: true },
  ]
  const means = model.bucketed && model.stepMs ? meansText(model.stepMs) : null
  const n = (v: number) => v.toLocaleString('en-GB')
  return (
    <>
      <SeriesChart panels={panels} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      <p className="gf-hint">
        {means ? `As ${means}` : 'One figure per half-hour'}: the de-rated margin, with its highest and lowest labelled and zero on the axis.{' '}
        {drawLolp
          ? `Above it, on the same clock, the loss of load probability per million, which is above zero at ${n(lolp.above)} of the ${n(lolp.held)} ${model.bucketed ? 'periods' : 'half-hours'} held; no bar is a 0 as held, and the smallest bars may be too short to see, so the key and the days table count them.`
          : lolp.held > 0
            ? `The loss of load probability is held as 0 at all ${plural(lolp.held, model.bucketed ? 'period' : 'half-hour', model.bucketed ? 'periods' : 'half-hours')} in this window, so it isn’t drawn as a flat line; the key and the table give it.`
            : 'No loss of load probability is held in this window.'}{' '}
        A half-hour with no figure held is a gap.
      </p>
    </>
  )
}
