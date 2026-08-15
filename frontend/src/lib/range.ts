export interface DateRange {
  start: string
  end: string
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Inclusive `YYYY-MM-DD` UTC window: `end` is today (UTC), `start` is
 * `end - (n - 1)` days, matching the backend's default-range semantics.
 */
export function lastNDays(n: number): DateRange {
  const end = new Date()
  const start = new Date(end)
  start.setUTCDate(end.getUTCDate() - (n - 1))

  return { start: toIsoDate(start), end: toIsoDate(end) }
}
