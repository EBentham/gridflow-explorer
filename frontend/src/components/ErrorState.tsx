import type { ApiError } from '../api/client'

interface ErrorStateProps {
  error: ApiError
}

export function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <p>Something went wrong: {error.message}</p>
    </div>
  )
}
