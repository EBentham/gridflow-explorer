import { useMemo, useState } from 'react'
import { ChartCard } from '../components/ChartCard'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { SeriesLineChart } from '../components/SeriesLineChart'
import { StackedAreaChart } from '../components/StackedAreaChart'
import { useDataset } from '../hooks/useDataset'
import { lastNDays } from '../lib/range'
import type { ScreenProps } from './registry'

type ViewMode = 'stacked' | 'single'

/** Hero screen: generation mix over the last N days, stacked or single-fuel. */
export function GenerationMixScreen({ dataset }: ScreenProps) {
  // Memoized so the range object is stable across renders — a fresh object
  // every render would retrigger useDataset's effect on every render.
  const range = useMemo(() => lastNDays(dataset.default_range_days), [dataset.default_range_days])
  const { data, loading, error } = useDataset(dataset.id, range)

  const [view, setView] = useState<ViewMode>('stacked')
  const [selectedKey, setSelectedKey] = useState(dataset.series[0]?.key ?? '')

  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (!data) return null

  const selectedIndex = Math.max(
    dataset.series.findIndex((s) => s.key === selectedKey),
    0,
  )
  const selectedSeries = dataset.series[selectedIndex]

  return (
    <div>
      <div className="view-toggle">
        <label>
          <input
            type="radio"
            name="view"
            value="stacked"
            checked={view === 'stacked'}
            onChange={() => setView('stacked')}
          />
          Stacked
        </label>
        <label>
          <input
            type="radio"
            name="view"
            value="single"
            checked={view === 'single'}
            onChange={() => setView('single')}
          />
          Single fuel
        </label>
        {view === 'single' && (
          <select value={selectedSeries.key} onChange={(event) => setSelectedKey(event.target.value)}>
            {dataset.series.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <ChartCard title={dataset.title}>
        {view === 'stacked' ? (
          <StackedAreaChart records={data} series={dataset.series} timestampKey={dataset.timestamp_key} />
        ) : (
          <SeriesLineChart
            records={data}
            series={selectedSeries}
            seriesIndex={selectedIndex}
            timestampKey={dataset.timestamp_key}
          />
        )}
      </ChartCard>
    </div>
  )
}
