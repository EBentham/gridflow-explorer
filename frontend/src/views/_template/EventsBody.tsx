/**
 * The events body: the window's events as a table, newest first, with a
 * filter per categorical column (the values held in the window, with their
 * counts) and sortable headings. In the Chart view an optional strip of
 * events per period sits above the table. Filters live in the URL as
 * `?f.<field>=<value>`, so a filtered table can be linked and shot.
 */
import { useMemo } from 'react'
import { plural } from '../../design/format'
import { DAY_MS, HOUR_MS, instantLabel, windowDomain } from '../../design/time'
import type { EventRow, EventsRowsResponse } from '../contract'
import type { ColumnSpec, EventsView, PageContext } from '../define'
import { headerOf, inferColumns, toTableCol, wordsOf } from './cells'
import { CountStrip } from './CountStrip'
import { WindowedTable, type TableCol } from './WindowedTable'

/** A column is offered as a filter when it holds this many distinct values or fewer. */
const FILTER_MAX_VALUES = 40

/** The URL parameter holding a column filter; the page clears every `f.` parameter when the dataset changes. */
const filterParam = (field: string) => `f.${field}`

function autoFilters(rows: EventRow[], columns: ColumnSpec[]): string[] {
  return columns
    .filter((c) => c.format === 'text' || c.format === 'id' || c.format === undefined)
    .map((c) => c.field)
    .filter((f) => {
      const values = new Set(rows.map((r) => r[f]).filter((v) => v !== null && v !== undefined))
      return values.size > 1 && values.size <= FILTER_MAX_VALUES
    })
}

export function EventsBody({ ctx }: { ctx: PageContext }) {
  const view = ctx.view as EventsView
  const response = ctx.response as EventsRowsResponse | null
  const rows = useMemo(() => response?.rows ?? [], [response])
  const columns = useMemo(() => view.columns ?? inferColumns(rows, ['ts']), [view.columns, rows])
  const fields = useMemo(() => view.filters ?? autoFilters(rows, columns), [view.filters, rows, columns])
  const active = fields.map((f) => [f, ctx.param(filterParam(f))] as const).filter((x): x is readonly [string, string] => x[1] !== null)
  const activeKey = JSON.stringify(active)
  const shown = useMemo(() => {
    const on = JSON.parse(activeKey) as [string, string][]
    return rows.filter((r) => on.every(([f, v]) => String(r[f] ?? '') === v))
  }, [rows, activeKey])

  if (!response || !ctx.window) return null

  // A select per filter field, with each value's count in the window. One value leaves nothing
  // to choose, unless a filter on it is already set; a value linked from another window that
  // holds no event in this one is still offered, with its zero.
  const selects = fields.flatMap((f) => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      const v = r[f]
      if (v !== null && v !== undefined) counts.set(String(v), (counts.get(String(v)) ?? 0) + 1)
    }
    const current = ctx.param(filterParam(f)) ?? ''
    if (counts.size < 2 && !current) return []
    if (current && !counts.has(current)) counts.set(current, 0)
    return [{ f, counts, current }]
  })

  const tableCols: TableCol<EventRow>[] = [
    { key: 'ts', label: view.timeLabel ?? 'Time', render: (r) => instantLabel(r.ts), sortValue: (r) => r.ts },
    ...columns.map((c) => toTableCol(c) as TableCol<EventRow>),
  ]
  const sort = view.sort ? { key: view.sort.field, dir: view.sort.dir } : { key: 'ts', dir: 'desc' as const }
  const [lo, hi] = windowDomain(ctx.window.start, ctx.window.end)
  const per = view.strip && typeof view.strip === 'object' ? view.strip.per : hi - lo <= 2 * DAY_MS + HOUR_MS ? 'hour' : 'day'
  const noun = plural(rows.length, 'event', 'events')

  return (
    <>
      {ctx.mode === 'chart' && view.strip && <CountStrip times={shown.map((r) => r.ts)} window={ctx.window} per={per} />}
      {selects.length > 0 && (
        <div className="gf-filters" role="group" aria-label="Filter the events">
          {selects.map(({ f, counts, current }) => {
            const spec = columns.find((c) => c.field === f) ?? { field: f }
            // A coded value is listed by its words; the filter still matches the value as held.
            const said = (v: string) => wordsOf(spec, v) ?? v
            return (
              <label key={f} className="gf-filter">
                <span>{headerOf({ ...spec, unit: undefined })}</span>
                <select className="gf-select" value={current} onChange={(e) => ctx.setParam(filterParam(f), e.target.value || null)}>
                  <option value="">All</option>
                  {[...counts.entries()]
                    .sort((a, b) => b[1] - a[1] || said(a[0]).localeCompare(said(b[0])))
                    .map(([v, n]) => (
                      <option key={v} value={v}>
                        {said(v)} ({n})
                      </option>
                    ))}
                </select>
              </label>
            )
          })}
          {active.length > 0 && (
            <button type="button" className="gf-filters-clear" onClick={() => ctx.setParams(Object.fromEntries(active.map(([f]) => [filterParam(f), null])))}>
              Clear filters
            </button>
          )}
        </div>
      )}
      <WindowedTable
        columns={tableCols}
        rows={shown}
        initialSort={sort}
        caption={active.length ? `${shown.length.toLocaleString('en-GB')} of ${noun} in ${ctx.windowText} match the filters.` : `${noun} in ${ctx.windowText}. Select a column heading to sort.`}
        empty="No event in this window matches the filters."
      />
    </>
  )
}
