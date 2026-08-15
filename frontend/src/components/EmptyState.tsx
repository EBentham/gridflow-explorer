/** Shown when a load succeeds but returns zero records — distinct from ErrorState. */
export function EmptyState() {
  return (
    <p className="empty-state">
      No data in the local catalogue for this range — data is ingested locally; try a range within the
      last two weeks.
    </p>
  )
}
