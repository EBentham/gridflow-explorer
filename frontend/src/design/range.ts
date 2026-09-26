/**
 * The toolbar's state (DESIGN §5). The range: 1, 7 or 30 UK days ending on
 * the dataset's latest local day, or a custom pair of dates. Local data stops
 * well before today, so a window ending today would open empty; anchoring
 * on the latest held day is what makes the default useful. And the view:
 * Chart or Table.
 *
 * Both live in the URL (`?days=30`, or `?from=YYYY-MM-DD&to=…`; `?view=table`),
 * so a view can be linked, reloaded and screenshotted as it is. The defaults
 * (7 days, the chart) leave the URL clean.
 */
import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { DateRange } from '../lib/range'
import { rangeText, shiftDate, todayUk } from './time'

export type ChartOrTable = 'chart' | 'table'

/** The Chart | Table switch, kept in the URL as `?view=table` (the chart is the clean default). */
export function useViewParam(): [ChartOrTable, (v: ChartOrTable) => void] {
  const [params, setParams] = useSearchParams()
  const view: ChartOrTable = params.get('view') === 'table' ? 'table' : 'chart'
  const setView = useCallback(
    (v: ChartOrTable) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (v === 'table') next.set('view', 'table')
          else next.delete('view')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )
  return [view, setView]
}

export type Preset = 1 | 7 | 30

export const PRESETS: Preset[] = [1, 7, 30]
export const DEFAULT_PRESET: Preset = 7

export interface RangeState {
  preset: Preset | 'custom'
  /** The window in UK days; null until the latest local day is known. */
  range: DateRange | null
  /** The latest UK day with local data: null when none is held, undefined while still being read. */
  latest: string | null | undefined
  setPreset: (p: Preset) => void
  setCustom: (r: DateRange) => void
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function rangeEnding(end: string, days: number): DateRange {
  return { start: shiftDate(end, -(days - 1)), end }
}

/** The empty state in plain words: the window, and where local rows end when that is known. */
export function emptyRangeText({ range, latest }: Pick<RangeState, 'range' | 'latest'>): string {
  const window = range ? rangeText(range.start, range.end) : 'this range'
  // The latest day carries its year: the window may be in another one.
  return `Nothing is held locally for ${window}.${latest ? ` The latest local day is ${rangeText(latest, latest)}.` : ''}`
}

export function useAnchoredRange(latest: string | null | undefined): RangeState {
  const [params, setParams] = useSearchParams()
  const from = params.get('from')
  const to = params.get('to')
  const days = Number(params.get('days'))
  const isCustom = from !== null && to !== null && ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to
  const preset: Preset | 'custom' = isCustom ? 'custom' : PRESETS.includes(days as Preset) ? (days as Preset) : DEFAULT_PRESET
  // With nothing held locally the window still needs an end; today is the honest one.
  const anchor = latest === undefined ? undefined : (latest ?? todayUk())

  const range = useMemo<DateRange | null>(() => {
    if (preset === 'custom') return from && to ? { start: from, end: to } : null
    return anchor ? rangeEnding(anchor, preset) : null
  }, [preset, from, to, anchor])

  const setPreset = useCallback(
    (p: Preset) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('from')
          next.delete('to')
          if (p === DEFAULT_PRESET) next.delete('days')
          else next.set('days', String(p))
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const setCustom = useCallback(
    (r: DateRange) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('days')
          next.set('from', r.start)
          next.set('to', r.end)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  return { preset, range, latest, setPreset, setCustom }
}
