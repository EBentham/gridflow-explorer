/**
 * The live adapter: the local store through the backend's two source
 * routes, `GET /api/sources` (the manifest, v0.4 P3-1) and
 * `GET /api/sources/{source}/{dataset}/rows` (v0.4 P3-2). Both answer in the
 * shapes of `contract.ts`, so nothing is translated here but three things:
 *
 * - the rows query: `start` and `end` as inclusive UK dates, `group`, and
 *   one `filter=<column>:<value>` per equality filter. Filters left
 *   undefined (or an empty object) let the dataset's default filter apply;
 *   `filters: null` clears it, sent as one empty `filter=`;
 * - reference rows: the backend adds a `ts` from a reference table's time
 *   column when it has one. A reference row is a plain record with no clock
 *   (`ReferenceRow`), so that `ts` is dropped; the column itself stays;
 * - the brand: a source's name and blurb read `gridflow` in lower case, as
 *   everywhere else ("Gridflow gold" comes capitalised; NEEDS.md 9).
 *
 * Every failure rejects with `ApiError` (`api/client.ts`): the envelope's
 * code, the HTTP status, `not_held_cause`, a 413's `reason` and `hint`, and
 * an `ambiguous_series` error's `group` and `varying_dimensions` in
 * `detail`. `_template/text.ts` (`errorText`) says each in plain words, and
 * `refresh_in_progress` (503) becomes the page's refreshing state.
 */
import { fetchJson } from '../../api/client'
import type { DataSource, Manifest, ReferenceRow, RowsRequest, RowsResponse } from '../contract'

/** The rows route for a request, with its query string. */
export function rowsPath(req: RowsRequest): string {
  const q = new URLSearchParams()
  if (req.start) q.set('start', req.start)
  if (req.end) q.set('end', req.end)
  if (req.group) q.set('group', req.group)
  if (req.filters === null) q.append('filter', '')
  else if (req.filters) for (const [column, value] of Object.entries(req.filters)) q.append('filter', `${column}:${value}`)
  const query = q.toString()
  return `/api/sources/${encodeURIComponent(req.source)}/${encodeURIComponent(req.dataset)}/rows${query ? `?${query}` : ''}`
}

function plainRecord(row: ReferenceRow): ReferenceRow {
  const out = { ...row }
  delete out.ts
  return out
}

const brand = (text: string) => text.replace(/\bGridflow\b/g, 'gridflow')

function normaliseManifest(manifest: Manifest): Manifest {
  return { ...manifest, sources: manifest.sources.map((s) => ({ ...s, name: brand(s.name), blurb: brand(s.blurb) })) }
}

function normalise(response: RowsResponse): RowsResponse {
  return response.kind === 'reference' ? { ...response, rows: response.rows.map(plainRecord) } : response
}

export const httpAdapter: DataSource = {
  origin: 'live',
  manifest: (signal) => fetchJson<Manifest>('/api/sources', signal).then(normaliseManifest),
  rows: (req, signal) => fetchJson<RowsResponse>(rowsPath(req), signal).then(normalise),
}
