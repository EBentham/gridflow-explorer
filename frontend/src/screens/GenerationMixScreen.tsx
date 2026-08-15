import { useState } from 'react'
import { ChartCard } from '../components/ChartCard'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { RangePicker } from '../components/RangePicker'
import { SeriesLineChart } from '../components/SeriesLineChart'
import { StackedAreaChart } from '../components/StackedAreaChart'
import { useDataset } from '../hooks/useDataset'
import { lastNDays, type DateRange } from '../lib/range'
import type { ScreenProps } from './registry'

type ViewMode = 'stacked' | 'single'

/** Hero screen: generation mix over the last N days, stacked or single-fuel. */
export function GenerationMixScreen({ dataset }: ScreenProps) {
  // Initial default derives from the dataset only (lazy initial state); every
  // later change flows through `setRange` from user interaction with RangePicker.
  const [range, setRange] = useState<DateRange>(() => lastNDays(dataset.default_range_days))
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
      <RangePicker value={range} onChange={setRange} />
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
          <SeriesLineChart records={data} series={[selectedSeries]} timestampKey={dataset.timestamp_key} />
        )}
      </ChartCard>
    </div>
  )
}
