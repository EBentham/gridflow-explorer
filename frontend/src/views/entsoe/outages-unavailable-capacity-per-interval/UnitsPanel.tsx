/**
 * The working panel: the window's outage blocks gathered per unit (per
 * border asset for transmission, per area for consumption), so a reader can
 * see which plant or line the window's notices touch, how many blocks each
 * gave, how far its block starts reach, and the span of its published MW
 * figures. The span is the lowest and highest figure as published, never a
 * total or a mean: what the figure measures isn't confirmed. The table's
 * filters apply here too.
 */
import type { ReactNode } from 'react'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import { instantLabel } from '../../../design/time'
import type { Scalar } from '../../contract'
import type { PageContext } from '../../define'
import { MW, START, activeFilters, applyFilters, mwText, rowsOf, shapeOf, startMs, withYear, type Field } from './shape'

interface Unit {
  key: string
  who: Scalar | undefined
  name: Scalar | undefined
  type: Scalar | undefined
  areas: (Scalar | undefined)[]
  blocks: number
  cancelled: number
  first: number | null
  last: number | null
  low: number | null
  high: number | null
  published: number
}

const MISSING = <span className="gf-cell-missing">–</span>

function cell(f: Field | undefined, v: Scalar | undefined): ReactNode {
  const words = f?.words?.(v ?? null)
  if (words) return words
  if (v === null || v === undefined || v === '') return MISSING
  return f?.id ? <code>{String(v)}</code> : String(v)
}

export function UnitsPanel({ ctx }: { ctx: PageContext }) {
  const shape = shapeOf(ctx)
  const all = rowsOf(ctx)
  if (!shape) return null
  if (ctx.state === 'empty' || !all.length) return <p className="gf-hint">No outage block was published in {ctx.windowText}, so no {shape.noun[0]} is listed.</p>
  const active = activeFilters(ctx, shape)
  const rows = applyFilters(all, active)

  const units = new Map<string, Unit>()
  for (const r of rows) {
    const key = [shape.who.field, ...shape.areas.map((a) => a.field)].map((f) => String(r[f] ?? '')).join('|')
    let u = units.get(key)
    if (!u) {
      u = {
        key,
        who: r[shape.who.field],
        name: shape.name ? r[shape.name.field] : undefined,
        type: shape.type ? r[shape.type.field] : undefined,
        areas: shape.areas.map((a) => r[a.field]),
        blocks: 0,
        cancelled: 0,
        first: null,
        last: null,
        low: null,
        high: null,
        published: r.ts,
      }
      units.set(key, u)
    }
    u.blocks += 1
    if (shape.status && r[shape.status.field] === 'A09') u.cancelled += 1
    const t = startMs(r[START])
    if (t !== null) {
      u.first = u.first === null ? t : Math.min(u.first, t)
      u.last = u.last === null ? t : Math.max(u.last, t)
    }
    const v = r[MW]
    if (typeof v === 'number') {
      u.low = u.low === null ? v : Math.min(u.low, v)
      u.high = u.high === null ? v : Math.max(u.high, v)
    }
    u.published = Math.max(u.published, r.ts)
  }

  const whoCol: TableCol<Unit> = { key: 'who', label: shape.who.label, render: (u) => cell(shape.who, u.who), sortValue: (u) => shape.who.words?.(u.who ?? null) ?? (u.who == null ? null : String(u.who)) }
  // The name (or id) first, the figures next, and an id a name already covers last.
  const columns: TableCol<Unit>[] = [
    ...(shape.name ? [{ key: 'name', label: shape.name.label, render: (u: Unit) => cell(shape.name, u.name), sortValue: (u: Unit) => (u.name == null ? null : String(u.name)) }] : [whoCol]),
    ...shape.areas.map((a, i) => ({ key: a.field, label: a.label, render: (u: Unit) => cell(a, u.areas[i]), sortValue: (u: Unit) => a.words?.(u.areas[i] ?? null) ?? String(u.areas[i] ?? '') })),
    { key: 'blocks', label: 'Blocks', num: true, render: (u) => u.blocks.toLocaleString('en-GB'), sortValue: (u) => u.blocks },
    ...(shape.status ? [{ key: 'cancelled', label: 'Cancelled', num: true, render: (u: Unit) => u.cancelled.toLocaleString('en-GB'), sortValue: (u: Unit) => u.cancelled }] : []),
    {
      key: 'span',
      label: 'MW, lowest to highest',
      num: true,
      render: (u) => (u.low === null || u.high === null ? MISSING : u.low === u.high ? mwText(u.low) : `${mwText(u.low)} to ${mwText(u.high)}`),
      sortValue: (u) => u.high,
    },
    { key: 'first', label: 'First block starts', render: (u) => (u.first === null ? MISSING : withYear(u.first)), sortValue: (u) => u.first },
    { key: 'last', label: 'Last block starts', render: (u) => (u.last === null ? MISSING : withYear(u.last)), sortValue: (u) => u.last },
    ...(shape.type ? [{ key: 'type', label: shape.type.label, render: (u: Unit) => cell(shape.type, u.type), sortValue: (u: Unit) => shape.type?.words?.(u.type ?? null) ?? (u.type == null ? null : String(u.type)) }] : []),
    { key: 'published', label: 'Last published', render: (u) => instantLabel(u.published), sortValue: (u) => u.published },
    ...(shape.name ? [whoCol] : []),
  ]

  const list = [...units.values()]
  const [one, many] = shape.noun
  return (
    <>
      <WindowedTable
        columns={columns}
        rows={list}
        rowKey={(u) => u.key}
        initialSort={{ key: 'blocks', dir: 'desc' }}
        maxHeight={360}
        caption={`${list.length.toLocaleString('en-GB')} ${list.length === 1 ? one : many} with blocks published in ${ctx.windowText}${active.length ? ', matching the table’s filters' : ''}, most blocks first.`}
        empty={`No ${one} in this window matches the table’s filters.`}
      />
      <p className="gf-hint">
        The MW span is the lowest and highest figure published for the {one} in this window{shape.status ? ', cancelled blocks included unless the table filters them out' : ''}. It is not a total, and what it measures isn’t confirmed.
      </p>
    </>
  )
}
