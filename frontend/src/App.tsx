import { useMemo } from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
import './App.css'
import { ApiError } from './api/client'
import type { DatasetSummary } from './api/types'
import { ChartCard } from './components/ChartCard'
import { ErrorState } from './components/ErrorState'
import { Layout } from './components/Layout'
import { LoadingState } from './components/LoadingState'
import { SeriesLineChart } from './components/SeriesLineChart'
import { StackedAreaChart } from './components/StackedAreaChart'
import { useDataset } from './hooks/useDataset'
import { useDatasets } from './hooks/useDatasets'
import { lastNDays } from './lib/range'
import { SCREENS } from './screens/registry'

/** Fallback screen for any catalogue dataset with no dedicated entry in `SCREENS`. */
function GenericDatasetScreen({ dataset }: { dataset: DatasetSummary }) {
  const range = useMemo(() => lastNDays(dataset.default_range_days), [dataset.default_range_days])
  const { data, loading, error } = useDataset(dataset.id, range)

  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (!data) return null

  return (
    <ChartCard title={dataset.title}>
      {dataset.chart === 'stacked-area' ? (
        <StackedAreaChart records={data} series={dataset.series} timestampKey={dataset.timestamp_key} />
      ) : (
        <SeriesLineChart records={data} series={[dataset.series[0]]} timestampKey={dataset.timestamp_key} />
      )}
    </ChartCard>
  )
}

/** Resolves `:datasetId` against the live catalogue and renders its registered screen. */
function DatasetRoute() {
  const { datasetId } = useParams<{ datasetId: string }>()
  const { data: datasets, loading, error } = useDatasets()

  if (loading) return <LoadingState />
  if (error) return <ErrorState error={error} />

  const dataset = datasets?.find((d) => d.id === datasetId)
  if (!dataset) {
    return <ErrorState error={new ApiError('unknown_dataset', `Unknown dataset '${datasetId ?? ''}'.`)} />
  }

  const Screen = SCREENS[dataset.id] ?? GenericDatasetScreen
  return <Screen dataset={dataset} />
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/datasets/generation-mix" replace />} />
        <Route path="/datasets/:datasetId" element={<DatasetRoute />} />
      </Route>
    </Routes>
  )
}

export default App
