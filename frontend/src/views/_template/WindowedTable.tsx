/**
 * The template's table: sticky headers, click-to-sort columns (numbers and
 * times sort as numbers, gaps last), tabular numbers, and windowed rendering
 * (only the rows in view, plus a margin, are in the DOM), so an events window
 * of tens of thousands of rows scrolls as lightly as a day of half-hours.
 * Every row is one line of fixed height; cells don't wrap.
 */
import { useMemo, useState, type ReactNode } from 'react'

export interface TableCol<R> {
  key: string
  label: ReactNode
  /** Right-aligned, tabular: numbers. */
  num?: boolean
  render: (row: R) => ReactNode
  /** What the column sorts by; omit to leave it unsortable. */
  sortValue?: (row: R) => string | number | null | undefined
}

export interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

/** Must match `.gf-wtable tbody tr` in template.css. */
const ROW_H = 28
const OVERSCAN = 12
/** Below this many rows every row renders: nothing to window. */
const WINDOW_FROM = 150

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  const an = a === null || a === undefined
  const bn = b === null || b === undefined
  if (an || bn) return an === bn ? 0 : an ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), 'en-GB', { numeric: true, sensitivity: 'base' })
}

function SortMark({ dir }: { dir: 'asc' | 'desc' | null }) {
  return (
    <svg className="gf-sortmark" width="8" height="10" viewBox="0 0 8 10" aria-hidden="true">
      <path d="M1 4 L4 1 L7 4" className={dir === 'asc' ? 'is-on' : undefined} />
      <path d="M1 6 L4 9 L7 6" className={dir === 'desc' ? 'is-on' : undefined} />
    </svg>
  )
}

export function WindowedTable<R>({
  columns,
  rows,
  caption,
  initialSort,
  rowKey,
  rowClass,
  maxHeight = 420,
  empty = 'No rows to show.',
}: {
  columns: TableCol<R>[]
  rows: R[]
  caption: ReactNode
  initialSort?: SortState | null
  rowKey?: (row: R, i: number) => string | number
  rowClass?: (row: R) => string | undefined
  maxHeight?: number
  empty?: ReactNode
}) {
  const [sort, setSort] = useState<SortState | null>(initialSort ?? null)
  const [scrollTop, setScrollTop] = useState(0)

  const sorted = useMemo(() => {
    const col = sort && columns.find((c) => c.key === sort.key)
    if (!sort || !col?.sortValue) return rows
    const value = col.sortValue
    const sign = sort.dir === 'asc' ? 1 : -1
    return rows
      .map((row, i) => ({ row, i, v: value(row) }))
      .sort((a, b) => {
        const gapA = a.v === null || a.v === undefined
        const gapB = b.v === null || b.v === undefined
        // Gaps sort last whichever way the column runs.
        if (gapA !== gapB) return gapA ? 1 : -1
        return sign * compare(a.v, b.v) || a.i - b.i
      })
      .map((x) => x.row)
  }, [rows, sort, columns])

  const windowed = sorted.length > WINDOW_FROM
  const first = windowed ? Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN) : 0
  const last = windowed ? Math.min(sorted.length, Math.ceil((scrollTop + maxHeight) / ROW_H) + OVERSCAN) : sorted.length
  const visible = sorted.slice(first, last)

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: columns.find((c) => c.key === key)?.num ? 'desc' : 'asc' }))

  return (
    <div className="gf-wtable" style={{ maxHeight }} onScroll={windowed ? (e) => setScrollTop(e.currentTarget.scrollTop) : undefined}>
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const dir = sort?.key === c.key ? sort.dir : null
              return (
                <th key={c.key} scope="col" className={c.num ? 'is-num' : undefined} aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : undefined}>
                  {c.sortValue ? (
                    <button type="button" onClick={() => toggle(c.key)}>
                      {c.label}
                      <SortMark dir={dir} />
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {first > 0 && <tr className="gf-wtable-pad" style={{ height: first * ROW_H }} aria-hidden="true" />}
          {visible.map((row, i) => (
            <tr key={rowKey ? rowKey(row, first + i) : first + i} className={rowClass?.(row)}>
              {columns.map((c) => (
                <td key={c.key} className={c.num ? 'is-num' : undefined}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {last < sorted.length && <tr className="gf-wtable-pad" style={{ height: (sorted.length - last) * ROW_H }} aria-hidden="true" />}
          {sorted.length === 0 && (
            <tr className="gf-wtable-empty">
              <td colSpan={columns.length}>{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
