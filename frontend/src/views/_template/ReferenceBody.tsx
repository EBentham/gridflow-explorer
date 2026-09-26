/**
 * The reference body: a register or lookup as a plain table with a search
 * box (DESIGN §8: reference tables get a table, no chart). The search reads
 * the text columns, ignores case, and lives in the URL as `?q=`.
 */
import { useMemo } from 'react'
import type { ReferenceRow, ReferenceRowsResponse } from '../contract'
import type { PageContext, ReferenceView } from '../define'
import { inferColumns, toTableCol } from './cells'
import { WindowedTable, type TableCol } from './WindowedTable'

export function ReferenceBody({ ctx }: { ctx: PageContext }) {
  const view = ctx.view as ReferenceView
  const response = ctx.response as ReferenceRowsResponse | null
  const rows = useMemo(() => response?.rows ?? [], [response])
  const columns = useMemo(() => view.columns ?? inferColumns(rows), [view.columns, rows])
  const searched = useMemo(() => view.search ?? columns.filter((c) => !c.format || c.format === 'text' || c.format === 'id').map((c) => c.field), [view.search, columns])
  const q = (ctx.param('q') ?? '').trim()
  const shown = useMemo(() => {
    const needle = q.toLocaleLowerCase('en-GB')
    if (!needle) return rows
    return rows.filter((r) => searched.some((f) => String(r[f] ?? '').toLocaleLowerCase('en-GB').includes(needle)))
  }, [rows, searched, q])

  if (!response) return null
  const tableCols = columns.map((c) => toTableCol(c) as TableCol<ReferenceRow>)
  const sort = view.sort ? { key: view.sort.field, dir: view.sort.dir } : columns[0] ? { key: columns[0].field, dir: 'asc' as const } : null
  const total = rows.length.toLocaleString('en-GB')

  return (
    <>
      <div className="gf-filters">
        <label className="gf-filter gf-search">
          <span>Search</span>
          <input type="search" className="gf-input" value={ctx.param('q') ?? ''} placeholder="Any text in the table" onChange={(e) => ctx.setParam('q', e.target.value || null)} />
        </label>
      </div>
      <WindowedTable
        columns={tableCols}
        rows={shown}
        initialSort={sort}
        caption={q ? `${shown.length.toLocaleString('en-GB')} of ${total} rows match “${q}”.` : `${total} rows. Select a column heading to sort.`}
        empty={`No row matches “${q}”.`}
      />
    </>
  )
}
