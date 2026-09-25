import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { fetchJson } from '../api/client'
import type { Coverage, DataRecord } from '../api/types'
import { toMixRows, type MixRow } from '../design/fuels'
import { toPriceRows, type PriceRow } from '../design/charts'
import { useDataset } from '../hooks/useDataset'
import type { DateRange } from '../lib/range'

const iso = (d: Date) => d.toISOString().slice(0, 10)

function shift(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return iso(d)
}

/**
 * Latest settlement date with local data for a dataset, from the read-only
 * coverage endpoint. The catalogue ends mid-September, so "last 7 days from
 * today" is empty. The prototype anchors its ranges on the latest day that
 * actually has data and says so in the UI.
 */
export function useLatestDate(datasetId: string): string | null {
  const [latest, setLatest] = useState<string | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    const end = iso(new Date())
    const start = shift(end, -90)
    fetchJson<Coverage>(`/api/datasets/${datasetId}/coverage?start=${start}&end=${end}`, ctrl.signal)
      .then((c) => setLatest(c.present_dates.at(-1) ?? end))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setLatest(end)
      })
    return () => ctrl.abort()
  }, [datasetId])
  return latest
}

export type Preset = 1 | 7 | 30

export function rangeEnding(end: string, days: number): DateRange {
  return { start: shift(end, -(days - 1)), end }
}

export interface RangeState {
  preset: Preset | 'custom'
  range: DateRange | null
  latest: string | null
  setPreset: (p: Preset) => void
  setCustom: (r: DateRange) => void
}

export const RangeContext = createContext<RangeState | null>(null)
export const useRange = () => {
  const r = useContext(RangeContext)
  if (!r) throw new Error('useRange outside provider')
  return r
}

export function useRangeState(): RangeState {
  const latest = useLatestDate('generation-mix')
  const [preset, setPresetState] = useState<Preset | 'custom'>(7)
  const [custom, setCustomState] = useState<DateRange | null>(null)
  const range = useMemo(() => {
    if (preset === 'custom') return custom
    return latest ? rangeEnding(latest, preset) : null
  }, [preset, custom, latest])
  return {
    preset,
    range,
    latest,
    setPreset: (p) => setPresetState(p),
    setCustom: (r) => {
      setCustomState(r)
      setPresetState('custom')
    },
  }
}

const EMPTY: DateRange = { start: '1970-01-01', end: '1970-01-01' }

export function useMix(range: DateRange | null) {
  const { data, loading, error } = useDataset('generation-mix', range ?? EMPTY)
  const rows: MixRow[] = useMemo(() => (data && range ? toMixRows(data, 'timestamp') : []), [data, range])
  return { rows, loading: loading || !range, error }
}

export function usePrices(range: DateRange | null) {
  const { data, loading, error } = useDataset('system-prices', range ?? EMPTY)
  const rows: PriceRow[] = useMemo(
    () => (data && range ? toPriceRows(data as unknown as Record<string, string | number | null>[], 'timestamp') : []),
    [data, range],
  )
  return { rows, loading: loading || !range, error }
}

export function useCoverageNote(datasetId: string, range: DateRange | null) {
  const [cov, setCov] = useState<Coverage | null>(null)
  useEffect(() => {
    if (!range) return undefined
    const ctrl = new AbortController()
    fetchJson<Coverage>(`/api/datasets/${datasetId}/coverage?start=${range.start}&end=${range.end}`, ctrl.signal)
      .then(setCov)
      .catch(() => setCov(null))
    return () => ctrl.abort()
  }, [datasetId, range])
  return cov
}

export type { DataRecord }
