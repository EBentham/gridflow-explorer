/**
 * The series body: the chart (Chart) or the rows (Table) of a series
 * dataset. The chart comes from `planPanels`; the table holds every column,
 * text ones too, one row per time (or, past a dozen series, one per time and
 * group), oldest first, and the related series the chart draws on the same
 * clock, read at the same times (a dash where the related dataset has no row
 * at that time). Settlement date and period appear only when the rows carry
 * them.
 */
import type { ReactNode } from 'react'
import { listText } from '../../design/format'
import { windowDomain, periodLabel, stepNoun } from '../../design/time'
import type { SeriesRow, SeriesRowsResponse } from '../contract'
import type { PageContext, SeriesView } from '../define'
import { SeriesChart } from './SeriesChart'
import type { SeriesDef, WideRow } from './seriesModel'
import { planPanels } from './seriesPanels'
import { meansText } from './text'
import { displayUnit } from './units'
import { WindowedTable, type TableCol } from './WindowedTable'

const dash = <span className="gf-cell-missing">–</span>

/** Past this many series the table goes long: one row per time and group. */
const WIDE_MAX = 12

/** ` Price is in the chart only.`: the drawn series a table leaves out, and why (as one and as many). */
function chartOnly(series: SeriesDef[], why: [string, string] = ['', '']): string {
  const labels = [...new Set(series.map((d) => d.label))]
  if (!labels.length) return ''
  const many = labels.length > 1
  return ` ${listText(labels)} ${many ? 'are' : 'is'} in the chart only${many ? why[1] : why[0]}.`
}

function SeriesTable({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const response = ctx.response as SeriesRowsResponse | null
  if (!model || !response) return null
  const hasSettlement = response.rows.some((r) => 'settlement_period' in r)
  const settlement = new Map<number, SeriesRow>()
  // A held row's settlement columns, not those of another group's missing step at the same time.
  if (hasSettlement) for (const r of response.rows) if (!settlement.get(r.ts)?.settlement_period) settlement.set(r.ts, r)
  // A column's header, and a group value's name: the page's labels for them, else the ids.
  const view = ctx.view as SeriesView
  const labels = new Map((view.values ?? []).map((v) => [v.column, v.label]))
  const textHeader = (column: string): ReactNode => labels.get(column) ?? <code>{column}</code>
  const groupLabels = new Map((view.groups ?? []).flatMap((g) => (g.label ? [[g.value, g.label] as const] : [])))
  const period: TableCol<{ t: number }> = { key: 't', label: model.bucketed ? 'Period (means)' : 'Period', render: (r) => periodLabel(r.t, model.stepMs), sortValue: (r) => r.t }
  const settlementCols: TableCol<{ t: number }>[] = hasSettlement
    ? [
        { key: 'sd', label: 'Settlement date', render: (r) => settlement.get(r.t)?.settlement_date ?? dash, sortValue: (r) => settlement.get(r.t)?.settlement_date ?? null },
        { key: 'sp', label: 'SP', num: true, render: (r) => settlement.get(r.t)?.settlement_period ?? dash, sortValue: (r) => settlement.get(r.t)?.settlement_period ?? null },
      ]
    : []
  const drawnRelated = planPanels(ctx)
    .panels.flatMap((p) => p.series)
    .filter((d) => d.from !== 'self')
  // A related series joins the rows only on the same clock: read at another step, a half-hour would pass for a mean.
  const sameClock = (d: SeriesDef) => {
    const m = ctx.related[d.from]?.series
    return Boolean(m) && m?.stepMs === model.stepMs && m?.bucketed === model.bucketed
  }
  const related = drawnRelated.filter(sameClock)
  const steps = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const title = `${ctx.view.title ?? ctx.view.label}, ${ctx.windowText}`
  const sortHint = 'Select a column heading to sort.'

  // Rows holding text only (no number to pivot on) go long, as do more series than fit across.
  if (model.all.length > 0 && model.all.length <= WIDE_MAX) {
    const apart = chartOnly(
      drawnRelated.filter((d) => !sameClock(d)),
      [', as its rows come at another step', ', as their rows come at another step'],
    )
    const caption = `${title}: ${model.rows.length.toLocaleString('en-GB')} ${model.rows.length === 1 ? 'row' : steps}.${apart} ${sortHint}`
    const relatedAt = new Map<string, Map<number, WideRow>>()
    for (const d of related) if (!relatedAt.has(d.from)) relatedAt.set(d.from, new Map((ctx.related[d.from]?.series?.rows ?? []).map((r) => [r.t, r])))
    const relatedValue = (from: string, field: string, t: number) => {
      const v = relatedAt.get(from)?.get(t)?.[field]
      return typeof v === 'number' ? v : null
    }
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
      ...related.map((d) => ({
        key: `${d.from}:${d.field}`,
        label: d.unit.label ? `${d.label}, ${d.unit.label}` : d.label,
        num: true,
        render: (r: (typeof model.rows)[number]) => {
          const v = relatedValue(d.from, d.field, r.t)
          return v === null ? dash : d.unit.plain(v)
        },
        sortValue: (r: (typeof model.rows)[number]) => relatedValue(d.from, d.field, r.t),
      })),
      ...textCols.map((c) => ({
        key: `text:${c.column}`,
        label: textHeader(c.column),
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

  // The split the rows carry: the model's, or the response's when a filter pins it to one value.
  const group = model.group ?? response.group
  const numeric = model.numericColumns.map((c) => ({ c, unit: model.all.find((d) => d.column === c.column)?.unit ?? displayUnit(c.unit) }))
  const columns: TableCol<SeriesRow>[] = [
    { ...period, render: (r) => periodLabel(r.ts, model.stepMs), sortValue: (r) => r.ts } as TableCol<SeriesRow>,
    ...(hasSettlement
      ? [
          { key: 'sd', label: 'Settlement date', render: (r: SeriesRow) => r.settlement_date ?? dash, sortValue: (r: SeriesRow) => r.settlement_date ?? null },
          { key: 'sp', label: 'SP', num: true, render: (r: SeriesRow) => r.settlement_period ?? dash, sortValue: (r: SeriesRow) => r.settlement_period ?? null },
        ]
      : []),
    ...(group
      ? [
          {
            key: 'group',
            label: <code>{group}</code>,
            render: (r: SeriesRow) => {
              const v = r[group]
              if (v === null || v === undefined) return dash
              return groupLabels.get(String(v)) ?? <code>{String(v)}</code>
            },
            sortValue: (r: SeriesRow) => (r[group] === null || r[group] === undefined ? null : String(r[group])),
          },
        ]
      : []),
    ...numeric.map(({ c, unit }) => ({
      key: c.column,
      label: (
        <>
          {textHeader(c.column)}
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
      label: textHeader(c.column),
      render: (r: SeriesRow) => (r[c.column] === null || r[c.column] === undefined ? dash : String(r[c.column])),
      sortValue: (r: SeriesRow) => (r[c.column] === null || r[c.column] === undefined ? null : String(r[c.column])),
    })),
  ]
  const perStep = model.bucketed ? 'period' : model.stepMs === null ? 'time' : stepNoun(model.stepMs).replace(/s$/, '')
  const missing = model.all.length === 0 ? ' A dash is a step with no row held.' : ''
  const caption = `${title}: ${response.rows.length.toLocaleString('en-GB')} rows, one per ${perStep}${group ? ` and ${group}` : ''}.${missing}${chartOnly(drawnRelated)} ${sortHint}`
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
          {plan.missingLower.label} isn't drawn under the chart. {plan.missingLower.reason}
        </p>
      )}
      {plan.tableOnly.length > 0 && <p className="gf-hint">In the table only, as their unit fits neither panel: {plan.tableOnly.map((d) => d.label).join(', ')}.</p>}
    </>
  )
}
