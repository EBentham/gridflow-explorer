/**
 * The residual demand view's main panel. Chart: three lines on one GW axis
 * and the UK clock, each a column as held: demand, the residual demand left
 * after wind and solar, and the clearing demand left for the priced stack
 * after the rest is netted off too; runs of clearing demand below zero are
 * banded. What comes off between them is drawn, on the same clock, in the
 * working panel. Table: every column in MW, in the order the demand is
 * worked down, so a row reads from demand to clearing demand.
 */
import { useMemo, type ReactNode } from 'react'
import { fmt0 } from '../../../design/format'
import { periodLabel, stepNoun, windowDomain } from '../../../design/time'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import type { SeriesDef } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { SeriesRow } from '../../contract'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, DEMAND, HYDRO, INDO, INTERCONNECTORS, INTERCONNECTOR_CODES, LINE_COLUMNS, OTHER, PUMPED, RESIDUAL, SOLAR, WIND, num, ownRows } from './figures'

const dash = <span className="gf-cell-missing">–</span>

/** The columns top to bottom of the waterfall, each with its header. */
const TABLE_COLUMNS: { column: string; label: ReactNode }[] = [
  { column: INDO, label: 'Demand, MW' },
  { column: WIND, label: 'Wind, MW' },
  { column: SOLAR, label: 'Solar, MW' },
  { column: RESIDUAL, label: 'Residual demand, MW' },
  { column: HYDRO, label: 'Hydro, not pumped, MW' },
  { column: OTHER, label: 'Other, MW' },
  { column: PUMPED, label: 'Pumped storage, MW' },
  ...INTERCONNECTORS.map((column, i) => ({
    column,
    label: (
      <>
        <code>{INTERCONNECTOR_CODES[i]}</code>, MW
      </>
    ),
  })),
  { column: DEMAND, label: 'Clearing demand, MW' },
]

function ResidualTable({ ctx }: { ctx: PageContext }) {
  const rows = ownRows(ctx)
  const sorted = useMemo(() => [...rows].sort((a, b) => a.ts - b.ts), [rows])
  const model = ctx.series
  if (!model) return null
  const settlement = model.settlement
  const columns: TableCol<SeriesRow>[] = [
    { key: 't', label: model.bucketed ? 'Period (means)' : 'Period', render: (r) => periodLabel(r.ts, model.stepMs), sortValue: (r) => r.ts },
    ...(settlement
      ? [
          { key: 'sd', label: 'Settlement date', render: (r: SeriesRow) => settlement.get(r.ts)?.date ?? dash, sortValue: (r: SeriesRow) => settlement.get(r.ts)?.date ?? null },
          { key: 'sp', label: 'SP', num: true, render: (r: SeriesRow) => settlement.get(r.ts)?.period ?? dash, sortValue: (r: SeriesRow) => settlement.get(r.ts)?.period ?? null },
        ]
      : []),
    ...TABLE_COLUMNS.map(({ column, label }) => ({
      key: column,
      label,
      num: true,
      render: (r: SeriesRow) => {
        const v = num(r[column])
        return v === null ? dash : fmt0(v)
      },
      sortValue: (r: SeriesRow) => num(r[column]),
    })),
  ]
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  // The caption spans the table, wider than its box: kept short so it shows whole; the rest goes under.
  const caption = `${sorted.length.toLocaleString('en-GB')} ${noun}, oldest first, in MW as held. Select a column heading to sort.`
  return (
    <>
      <WindowedTable columns={columns} rows={sorted} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => r.ts} />
      <p className="gf-hint">
        Across a row: demand, less wind and solar, is the residual demand; less the columns after it, the clearing demand. A negative figure, such as exports or pumping, adds to demand.
      </p>
    </>
  )
}

export function ResidualMain({ ctx }: { ctx: PageContext }) {
  if (ctx.mode === 'table') return <ResidualTable ctx={ctx} />
  const model = ctx.series
  if (!model || !ctx.window) return null
  const lines = LINE_COLUMNS.map((c) => model.all.find((d) => d.column === c)).filter((d): d is SeriesDef => d !== undefined && d.count > 0)
  if (!lines.length) return <p className="gf-state">Rows are held for this window, but none of them holds a demand figure to draw. The table lists them.</p>
  const clearing = lines.find((d) => d.column === DEMAND) ?? null
  const panel: ChartPanel = {
    rows: model.rows,
    series: lines,
    mark: 'line',
    unit: lines[0].unit,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    height: 320,
    zero: true,
    belowZero: clearing,
    axisWidth: AXIS_WIDTH,
  }
  return <SeriesChart panels={[panel]} domain={windowDomain(ctx.window.start, ctx.window.end)} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
}
