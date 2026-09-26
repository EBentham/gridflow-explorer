/**
 * The series body: the chart (Chart) or the rows (Table) of a series
 * dataset. The chart comes from `planPanels`; the table holds every column,
 * text ones too, one row per time (or, past a dozen series, one per time and
 * group), oldest first. Settlement date and period appear only when the rows
 * carry them.
 */
import type { ReactNode } from 'react'
import { windowDomain, periodLabel } from '../../design/time'
import type { SeriesRow, SeriesRowsResponse } from '../contract'
import type { PageContext } from '../define'
import { SeriesChart } from './SeriesChart'
import { planPanels } from './seriesPanels'
import { displayUnit } from './units'
import { WindowedTable, type TableCol } from './WindowedTable'

const dash = <span className="gf-cell-missing">–</span>

/** Past this many series the table goes long: one row per time and group. */
const WIDE_MAX = 12

function SeriesTable({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const response = ctx.response as SeriesRowsResponse | null
  if (!model || !response) return null
  const hasSettlement = response.rows.some((r) => 'settlement_period' in r)
  const settlement = new Map<number, SeriesRow>()
  if (hasSettlement) for (const r of response.rows) if (!settlement.has(r.ts)) settlement.set(r.ts, r)
  const period: TableCol<{ t: number }> = { key: 't', label: model.bucketed ? 'Period (means)' : 'Period', render: (r) => periodLabel(r.t, model.stepMs), sortValue: (r) => r.t }
  const settlementCols: TableCol<{ t: number }>[] = hasSettlement
    ? [
        { key: 'sd', label: 'Settlement date', render: (r) => settlement.get(r.t)?.settlement_date ?? dash, sortValue: (r) => settlement.get(r.t)?.settlement_date ?? null },
        { key: 'sp', label: 'SP', num: true, render: (r) => settlement.get(r.t)?.settlement_period ?? dash, sortValue: (r) => settlement.get(r.t)?.settlement_period ?? null },
      ]
    : []
  const caption = `${ctx.view.title ?? ctx.view.label}, ${ctx.windowText}${model.bucketed ? ', as period means' : ''}. Select a column heading to sort.`

  if (model.all.length <= WIDE_MAX) {
    const textCols = model.group === null ? model.textColumns : []
    const texts = new Map<number, SeriesRow>()
    if (textCols.length) for (const r of response.rows) texts.set(r.ts, r)
    const columns: TableCol<(typeof model.rows)[number]>[] = [
      period,
      ...settlementCols,
      ...model.all.map((d) => ({
        key: d.field,
        label: d.unit.label ? `${d.label}, ${d.unit.label}` : d.label,
        num: true,
        render: (r: (typeof model.rows)[number]) => {
          const v = r[d.field]
          return typeof v === 'number' ? d.unit.plain(v) : dash
        },
        sortValue: (r: (typeof model.rows)[number]) => {
          const v = r[d.field]
          return typeof v === 'number' ? v : null
        },
      })),
      ...textCols.map((c) => ({
        key: `text:${c.column}`,
        label: (<code>{c.column}</code>) as ReactNode,
        render: (r: (typeof model.rows)[number]) => {
          const v = texts.get(r.t)?.[c.column]
          return v === null || v === undefined ? dash : String(v)
        },
        sortValue: (r: (typeof model.rows)[number]) => {
          const v = texts.get(r.t)?.[c.column]
          return v === null || v === undefined ? null : String(v)
        },
      })),
    ]
    return <WindowedTable columns={columns} rows={model.rows} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => r.t} />
  }

  const group = model.group ?? ''
  const numeric = model.numericColumns.map((c) => ({ c, unit: model.all.find((d) => d.column === c.column)?.unit ?? displayUnit(c.unit) }))
  const columns: TableCol<SeriesRow>[] = [
    { ...period, render: (r) => periodLabel(r.ts, model.stepMs), sortValue: (r) => r.ts } as TableCol<SeriesRow>,
    ...(hasSettlement
      ? [
          { key: 'sd', label: 'Settlement date', render: (r: SeriesRow) => r.settlement_date ?? dash, sortValue: (r: SeriesRow) => r.settlement_date ?? null },
          { key: 'sp', label: 'SP', num: true, render: (r: SeriesRow) => r.settlement_period ?? dash, sortValue: (r: SeriesRow) => r.settlement_period ?? null },
        ]
      : []),
    { key: 'group', label: <code>{group}</code>, render: (r) => (r[group] === null || r[group] === undefined ? dash : <code>{String(r[group])}</code>), sortValue: (r) => (r[group] === null || r[group] === undefined ? null : String(r[group])) },
    ...numeric.map(({ c, unit }) => ({
      key: c.column,
      label: (
        <>
          <code>{c.column}</code>
          {unit.label ? `, ${unit.label}` : ''}
        </>
      ) as ReactNode,
      num: true,
      render: (r: SeriesRow) => {
        const v = r[c.column]
        return typeof v === 'number' ? unit.plain(v * unit.factor) : dash
      },
      sortValue: (r: SeriesRow) => {
        const v = r[c.column]
        return typeof v === 'number' ? v : null
      },
    })),
    ...model.textColumns.map((c) => ({
      key: c.column,
      label: (<code>{c.column}</code>) as ReactNode,
      render: (r: SeriesRow) => (r[c.column] === null || r[c.column] === undefined ? dash : String(r[c.column])),
      sortValue: (r: SeriesRow) => (r[c.column] === null || r[c.column] === undefined ? null : String(r[c.column])),
    })),
  ]
  return <WindowedTable columns={columns} rows={response.rows} caption={caption} initialSort={{ key: 't', dir: 'asc' }} />
}

export function SeriesBody({ ctx }: { ctx: PageContext }) {
  if (!ctx.series || !ctx.window) return null
  if (ctx.mode === 'table') return <SeriesTable ctx={ctx} />
  const plan = planPanels(ctx)
  if (!plan.panels.length) {
    return <p className="gf-state">Rows are held for this window, but none of their values can be drawn. The table lists them.</p>
  }
  return (
    <>
      <SeriesChart panels={plan.panels} domain={windowDomain(ctx.window.start, ctx.window.end)} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      {plan.missingLower && (
        <p className="gf-hint">
          {plan.missingLower.label} isn't drawn under the chart: {plan.missingLower.reason}.
        </p>
      )}
      {plan.tableOnly.length > 0 && <p className="gf-hint">In the table only, as their unit fits neither panel: {plan.tableOnly.map((d) => d.label).join(', ')}.</p>}
    </>
  )
}
