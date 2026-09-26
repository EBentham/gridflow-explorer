import type { ReactNode } from 'react'

interface EmptyStateProps {
  /**
   * Custom message for a screen with more specific empty-state context
   * (e.g. P4's forecast day/Variant/available-range detail). Every
   * existing call site (no children) keeps the original generic message.
   */
  children?: ReactNode
}

/** Shown when a load succeeds but returns zero records — distinct from ErrorState. */
export function EmptyState({ children }: EmptyStateProps) {
  return (
    <p className="empty-state">
      {children ?? (
        <>
          No data in the local catalogue for this range — data is ingested locally; try a range within
          the last two weeks.
        </>
      )}
    </p>
  )
}
