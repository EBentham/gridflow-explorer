import { useState } from 'react'
import { ChartCard } from '../components/ChartCard'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { RangePicker } from '../components/RangePicker'
import { SeriesLineChart } from '../components/SeriesLineChart'
import { useDataset } from '../hooks/useDataset'
import { lastNDays, type DateRange } from '../lib/range'
import type { ScreenProps } from './registry'

/** System sell/buy imbalance prices — one line per catalogue series. */
export function SystemPricesScreen({ dataset }: ScreenProps) {
  // Initial default derives from the dataset only (lazy initial state); every
  // later change flows through `setRange` from user interaction with RangePicker.
  const [range, setRange] = useState<DateRange>(() => lastNDays(dataset.default_range_days))
  const { data, loading, error } = useDataset(dataset.id, range)

  return (
    <div>
      <RangePicker value={range} onChange={setRange} />
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} />
      ) : !data ? null : data.length === 0 ? (
        <EmptyState />
      ) : (
        <ChartCard title={dataset.title}>
          <SeriesLineChart records={data} series={dataset.series} timestampKey={dataset.timestamp_key} />
        </ChartCard>
      )}
    </div>
  )
}
