/**
 * Elexon's transmission boundaries, for pages whose rows split by them
 * (`boundary`): N, the whole system, opens the page; the other 17 are B1 to
 * B17, named by their codes alone, as the rows don't say what area each
 * bounds. The page keeps the one shown in `?boundary=`.
 */
import type { PageContext, QuerySpec } from '../define'

export const BOUNDARY = 'boundary'
export const NATIONAL_BOUNDARY = 'N'
export const BOUNDARIES = [NATIONAL_BOUNDARY, ...Array.from({ length: 17 }, (_, i) => `B${i + 1}`)]
/** The page's own URL parameter for the boundary. */
export const BOUNDARY_PARAM = 'boundary'

/** The boundary on the page: the URL's, else N. */
export function boundaryOf(from: Pick<PageContext, 'param'> | URLSearchParams): string {
  const b = from instanceof URLSearchParams ? from.get(BOUNDARY_PARAM) : from.param(BOUNDARY_PARAM)
  return b && BOUNDARIES.includes(b) ? b : NATIONAL_BOUNDARY
}

export const boundaryName = (b: string) => (b === NATIONAL_BOUNDARY ? 'boundary N, national' : `boundary ${b}`)

/** A read filtered to the page's boundary: a dataset's own `query`, or a related one's. */
export const boundaryQuery = (params: URLSearchParams): QuerySpec => ({ filters: { [BOUNDARY]: boundaryOf(params) } })
