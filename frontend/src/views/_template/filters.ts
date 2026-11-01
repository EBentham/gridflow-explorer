/**
 * The events table's column filters, as they live in the URL: `?f.<field>=`
 * holding the value as held, or `(blank)` for an empty one, which an empty
 * parameter can't carry. The page clears every `f.` parameter when the
 * dataset changes. A page's own panels that read the filtered rows use the
 * same helpers, so they agree with the table.
 */
import type { EventRow, Scalar } from '../contract'
import type { PageContext } from '../define'

/** The URL value for a blank field. */
export const BLANK = '(blank)'

export const filterParam = (field: string) => `f.${field}`

/** A row's value as a filter matches it. */
export const filterValue = (v: Scalar | undefined) => (v === null || v === undefined || v === '' ? BLANK : String(v))

/** The filters set in the URL among `fields`, as [field, value] pairs. */
export function activeFilters(ctx: Pick<PageContext, 'param'>, fields: string[]): [string, string][] {
  return fields.map((f) => [f, ctx.param(filterParam(f))] as [string, string | null]).filter((x): x is [string, string] => x[1] !== null)
}

export function applyFilters(rows: EventRow[], active: [string, string][]): EventRow[] {
  if (!active.length) return rows
  return rows.filter((r) => active.every(([f, v]) => filterValue(r[f]) === v))
}
