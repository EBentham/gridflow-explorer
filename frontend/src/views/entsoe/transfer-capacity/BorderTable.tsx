/**
 * The Table view: one row per border and time any measure holds a value at,
 * with the page's own measure and, on GB's borders, the others read beside
 * it, so a capacity reads against what was allocated and nominated hour by
 * hour. Each border lists its own times only, so nothing stands in for a
 * step a border doesn't have; a dash is a time one measure holds and the
 * other doesn't. Nothing is filled in.
 */
import { instantLabel } from '../../../design/time'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { pointsOf } from './figures'
import { besideOf, besideState, bordersOf, measureOf, type Border, type Measure } from './model'
import { cadenceSentence } from './words'

const dash = <span className="gf-cell-missing">–</span>

interface BorderRow {
  t: number
  border: Border
  /** By measure key. */
  v: Record<string, number | null>
}

export function BorderTable({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const own = measureOf(ctx)
  const borders = bordersOf(ctx)
  if (!model || !borders.length) return <p className="gf-state">Rows are held for this window, but no border holds a value.</p>
  const drawn = besideOf(ctx).filter((m) => besideState(ctx, m) === 'drawn')
  const measures: Measure[] = [own, ...drawn]
  const rows: BorderRow[] = []
  for (const b of borders) {
    // The rows as read, not the chart's lines: those carry a null at each missing step to break them.
    const byT = new Map<number, BorderRow>()
    const put = (t: number, key: string, v: number | null) => {
      const r = byT.get(t) ?? { t, border: b, v: {} }
      r.v[key] = v
      byT.set(t, r)
    }
    for (const p of pointsOf(model.rows, b.own.def.field)) put(p.t, own.key, p.v)
    for (const x of b.beside) {
      const rel = ctx.related[x.measure.key]?.series
      if (rel) for (const p of pointsOf(rel.rows, x.line.def.field)) put(p.t, x.measure.key, p.v)
    }
    // A gap-filled read sends a null at each missing hour: a time no measure holds is left out.
    rows.push(...[...byT.values()].filter((r) => Object.values(r.v).some((v) => v !== null && v !== undefined)))
  }
  // Time first, then the borders in the page's order: the sort keeps ties as they come.
  rows.sort((a, c) => a.t - c.t || borders.indexOf(a.border) - borders.indexOf(c.border))
  const unit = borders[0].own.def.unit
  const unitLabel = unit.label ?? 'unit unconfirmed'
  const value = (v: number | null | undefined) => (v === null || v === undefined ? dash : unit.plain(v))
  const columns: TableCol<BorderRow>[] = [
    { key: 't', label: 'Starts', render: (r) => instantLabel(r.t), sortValue: (r) => r.t },
    { key: 'border', label: 'Border', render: (r) => r.border.name, sortValue: (r) => borders.indexOf(r.border) },
    ...measures.map((m) => ({ key: m.key, label: `${m.short}, ${unitLabel}`, num: true, render: (r: BorderRow) => value(r.v[m.key]), sortValue: (r: BorderRow) => r.v[m.key] ?? null })),
  ]
  const what = drawn.length ? `${own.label}, with the ${drawn.map((m) => m.words).join(' and the ')} beside it` : own.label
  const caption = `${what}, ${ctx.windowText}: ${rows.length.toLocaleString('en-GB')} rows, one per border and time held. Select a column heading to sort.`
  return (
    <>
      <WindowedTable columns={columns} rows={rows} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => `${r.border.id}:${r.t}`} />
      <p className="gf-hint">
        {own.whenSet ? 'Each limit is listed at the time it starts, as published. ' : `Each value holds for its border’s own step from the time it starts. ${cadenceSentence(borders.map((b) => ({ name: b.name, line: b.own })))}`}
        {drawn.length ? ' A dash is a time one measure holds a value at and another doesn’t.' : ''}
      </p>
    </>
  )
}
