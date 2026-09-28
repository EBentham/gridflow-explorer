/**
 * The Table view of the flows and the schedules: one row per border and time
 * either dataset holds a value at, with the page's own value and, on GB's
 * borders, the other dataset's beside it, so a flow reads against its
 * schedule hour by hour. Each border lists its own times only (hourly or
 * every 15 minutes), so nothing stands in for a step a border doesn't have;
 * a dash is a time one dataset holds and the other doesn't. Nothing is
 * filled in.
 */
import { instantLabel } from '../../../design/time'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { pointsOf } from './figures'
import { besideState, bordersOf, roleOf, type Border } from './model'
import { cadenceSentence, stepsApartSentence } from './words'

const dash = <span className="gf-cell-missing">–</span>

interface BorderRow {
  t: number
  border: Border
  own: number | null
  beside: number | null
}

const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`

export function BorderTable({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const role = roleOf(ctx)
  const borders = bordersOf(ctx)
  if (!model || !borders.some((b) => b.own)) return <p className="gf-state">Rows are held for this window, but no border holds a value.</p>
  const besideModel = besideState(ctx) === 'drawn' ? (ctx.related[role.besideKey]?.series ?? null) : null
  const rows: BorderRow[] = []
  for (const b of borders) {
    // The rows as read, not the chart's lines: those carry a null at each missing step to break them.
    const byT = new Map<number, BorderRow>()
    const put = (t: number, patch: Partial<BorderRow>) => byT.set(t, { ...(byT.get(t) ?? { t, border: b, own: null, beside: null }), ...patch })
    if (b.own) for (const p of pointsOf(model.rows, b.own.def.field)) put(p.t, { own: p.v })
    if (b.beside && besideModel) for (const p of pointsOf(besideModel.rows, b.beside.def.field)) put(p.t, { beside: p.v })
    rows.push(...byT.values())
  }
  // Time first, then the borders in the page's order: the sort keeps ties as they come.
  rows.sort((a, c) => a.t - c.t || borders.indexOf(a.border) - borders.indexOf(c.border))
  const unit = borders.find((b) => b.own)?.own?.def.unit
  const unitLabel = unit?.label ?? 'unit unconfirmed'
  const value = (v: number | null) => (v === null || !unit ? dash : unit.plain(v))
  const columns: TableCol<BorderRow>[] = [
    { key: 't', label: 'Starts', render: (r) => instantLabel(r.t), sortValue: (r) => r.t },
    { key: 'border', label: 'Border', render: (r) => r.border.name, sortValue: (r) => borders.indexOf(r.border) },
    { key: 'own', label: `${cap(role.own)}, ${unitLabel}`, num: true, render: (r) => value(r.own), sortValue: (r) => r.own },
    ...(besideModel ? [{ key: 'beside', label: `${cap(role.beside)}, ${unitLabel}`, num: true, render: (r: BorderRow) => value(r.beside), sortValue: (r: BorderRow) => r.beside }] : []),
  ]
  const what = besideModel ? `${cap(role.own)}, with the ${role.beside} beside it` : cap(role.own)
  const caption = `${what}, ${ctx.windowText}: ${rows.length.toLocaleString('en-GB')} rows, one per border and time held. Select a column heading to sort.`
  return (
    <>
      <WindowedTable columns={columns} rows={rows} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => `${r.border.id}:${r.t}`} />
      <p className="gf-hint">
        Each value holds for its border’s own step from the time it starts. {cadenceSentence(borders.map((b) => ({ name: b.name, line: b.own })))}
        {besideModel ? ` ${stepsApartSentence(borders, role.own, role.beside)} A dash is a time one dataset holds a value at and the other doesn’t.` : ''}
      </p>
    </>
  )
}
