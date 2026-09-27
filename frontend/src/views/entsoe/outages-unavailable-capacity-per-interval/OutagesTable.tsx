/**
 * The main panel: the window's outage blocks as a table, newest publication
 * first, with a filter per categorical column and, in the Chart view, a strip
 * of blocks published per day. It stands in for the template's events body
 * because a block's start must name its year (blocks run years ahead of the
 * window) and still sort as a time: the events body's time cells name no
 * year, and a `text` formatter would sort the words. See NEEDS.md.
 */
import { useMemo, type ReactNode } from 'react'
import { plural } from '../../../design/format'
import { DAY_MS, HOUR_MS, instantLabel, windowDomain } from '../../../design/time'
import { CountStrip } from '../../_template/CountStrip'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { EventRow } from '../../contract'
import type { PageContext } from '../../define'
import {
  BLANK,
  MW,
  MW_LABEL,
  START,
  activeFilters,
  applyFilters,
  fieldsOf,
  filterParam,
  filterValue,
  mwText,
  rowsOf,
  said,
  shapeOf,
  startMs,
  withYear,
  type Field,
} from './shape'

const MISSING = <span className="gf-cell-missing">–</span>

function fieldCol(f: Field): TableCol<EventRow> {
  const cell = (v: EventRow[string]): ReactNode => {
    const words = f.words?.(v ?? null)
    if (words) return words
    if (v === null || v === undefined || v === '') return MISSING
    return f.id ? <code>{String(v)}</code> : String(v)
  }
  return {
    key: f.field,
    label: f.label,
    render: (r) => cell(r[f.field]),
    sortValue: (r) => {
      const v = r[f.field]
      if (v === null || v === undefined) return null
      return f.words?.(v) ?? String(v)
    },
  }
}

export function OutagesTable({ ctx }: { ctx: PageContext }) {
  const shape = shapeOf(ctx)
  const rows = rowsOf(ctx)
  const active = shape ? activeFilters(ctx, shape) : []
  const activeKey = JSON.stringify(active)
  const shown = useMemo(() => applyFilters(rows, JSON.parse(activeKey) as [string, string][]), [rows, activeKey])
  if (!shape || !ctx.window) return null

  const fields = fieldsOf(shape)
  const col = (f: Field | undefined) => (f ? [fieldCol(f)] : [])
  // What is out, its status, then the block and its figure; identifiers a name already covers go last,
  // so a narrow box cuts them off before the figures.
  const columns: TableCol<EventRow>[] = [
    { key: 'ts', label: 'Published', render: (r) => instantLabel(r.ts), sortValue: (r) => r.ts },
    ...col(shape.name ?? shape.who),
    ...col(shape.status),
    {
      key: START,
      label: 'Block starts',
      render: (r) => {
        const ms = startMs(r[START])
        return ms === null ? MISSING : withYear(ms)
      },
      sortValue: (r) => startMs(r[START]),
    },
    {
      key: MW,
      label: MW_LABEL,
      num: true,
      render: (r) => {
        const v = r[MW]
        return typeof v === 'number' ? mwText(v) : MISSING
      },
      sortValue: (r) => {
        const v = r[MW]
        return typeof v === 'number' ? v : null
      },
    },
    ...col(shape.type),
    ...shape.areas.map(fieldCol),
    ...(shape.name ? col(shape.who) : []),
  ]

  // A select per filter, listing the values held in the window with their counts. One value leaves
  // nothing to choose unless a filter on it is set; a linked value this window lacks shows its zero.
  const selects = shape.filters.flatMap((field) => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(filterValue(r[field]), (counts.get(filterValue(r[field])) ?? 0) + 1)
    const current = ctx.param(filterParam(field)) ?? ''
    if (counts.size < 2 && !current) return []
    if (current && !counts.has(current)) counts.set(current, 0)
    const f = fields.get(field)
    const words = (v: string) => (v === BLANK ? said(f, '') : said(f, v))
    return [{ field, label: f?.label ?? field, counts, current, words }]
  })

  const [lo, hi] = windowDomain(ctx.window.start, ctx.window.end)
  const per = hi - lo <= 2 * DAY_MS + HOUR_MS ? 'hour' : 'day'
  const noun = plural(rows.length, 'outage block', 'outage blocks')

  return (
    <>
      {ctx.mode === 'chart' && <CountStrip times={shown.map((r) => r.ts)} window={ctx.window} per={per} noun="blocks" />}
      {selects.length > 0 && (
        <div className="gf-filters" role="group" aria-label="Filter the outage blocks">
          {selects.map(({ field, label, counts, current, words }) => (
            <label key={field} className="gf-filter">
              <span>{label}</span>
              <select className="gf-select" value={current} onChange={(e) => ctx.setParam(filterParam(field), e.target.value || null)}>
                <option value="">All</option>
                {[...counts.entries()]
                  .sort((a, b) => b[1] - a[1] || words(a[0]).localeCompare(words(b[0])))
                  .map(([v, n]) => (
                    <option key={v} value={v}>
                      {words(v)} ({n})
                    </option>
                  ))}
              </select>
            </label>
          ))}
          {active.length > 0 && (
            <button type="button" className="gf-filters-clear" onClick={() => ctx.setParams(Object.fromEntries(active.map(([f]) => [filterParam(f), null])))}>
              Clear filters
            </button>
          )}
        </div>
      )}
      <WindowedTable
        columns={columns}
        rows={shown}
        initialSort={{ key: 'ts', dir: 'desc' }}
        caption={
          active.length
            ? `${shown.length.toLocaleString('en-GB')} of ${noun} published in ${ctx.windowText} match the filters.`
            : `${noun} published in ${ctx.windowText}, newest first. Select a column heading to sort.`
        }
        empty="No outage block in this window matches the filters."
      />
    </>
  )
}
