import type { ApiError } from '../../api/client'

interface ErrorStateProps {
  error: ApiError
}

export function ErrorState({ error }: ErrorStateProps) {
  // A fetch job is running (ours, another tab's, or an orphaned writer) —
  // this is a transient state, not a failure, so it gets a calm message
  // and a non-alerting role rather than the error wall.
  if (error.code === 'refresh_in_progress') {
    return (
      <div className="error-state error-state-refresh" role="status">
        <p>Refresh in progress — this will reload when it finishes.</p>
      </div>
    )
  }

  return (
    <div className="error-state" role="alert">
      <p>Something went wrong: {error.message}</p>
    </div>
  )
}
