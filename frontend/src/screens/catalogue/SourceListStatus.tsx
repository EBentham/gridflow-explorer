/**
 * The source list's read, in words, while there is nothing else to show:
 * reading it, gridflow refreshing its store, or what failed.
 */
import type { ApiError } from '../../api/client'
import type { LoadState } from '../../views/_data/hooks'
import { ErrorWords } from '../../views/_template/panels'

export function SourceListStatus({ state, error }: { state: LoadState; error: ApiError | null }) {
  if (state === 'loading') return <p className="gf-state">Reading gridflow's source list…</p>
  if (state === 'refreshing') {
    return (
      <p className="gf-state" role="status">
        gridflow is refreshing the local store, so its source list can't be read for a moment. This page tries again every 15 seconds.
      </p>
    )
  }
  if (state === 'error') {
    return (
      <p className="gf-state is-error" role="alert">
        Couldn't read gridflow's source list. <ErrorWords error={error} />
      </p>
    )
  }
  return null
}
