import { useMemo, useState } from 'react'
import { ChartCard } from '../components/ChartCard'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { ForecastFanChart } from '../components/ForecastFanChart'
import { LoadingState } from '../components/LoadingState'
import type { ForecastMetric, ForecastVariant } from '../api/types'
import { useForecastDay } from '../hooks/useForecastDay'
import { useForecastMetrics } from '../hooks/useForecastMetrics'
import { useForecastVariants } from '../hooks/useForecastVariants'

function titleFor(variants: ForecastVariant[], modelId: string): string {
  return variants.find((v) => v.model_id === modelId)?.title ?? modelId
}

/** One Variant's caveat line + metric table, always visible (never a tooltip). */
function VariantMetrics({ modelId, rows, variants }: { modelId: string; rows: ForecastMetric[]; variants: ForecastVariant[] }) {
  const caveat = rows[0]?.perfect_prog_caveat ?? false
  return (
    <div className="forecast-metrics-variant">
      <h3>{titleFor(variants, modelId)}</h3>
      <p className="perfect-prog-caveat">
        {caveat
          ? 'Perfect-prog caveat: this score uses the realised (actual) weather, not a day-ahead ' +
            'forecast — it is optimistic by the unmeasured day-ahead weather-forecast error (ADR-056).'
          : 'Perfect-prog caveat: not applicable — this run uses genuine day-ahead inputs.'}
      </p>
      {rows.length === 0 ? (
        <p>No metrics recorded for this Variant's newest run.</p>
      ) : (
        <table className="forecast-metrics-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Gate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.metric_kind}-${row.metric_name}`}>
                <td>{row.metric_name}</td>
                <td>{row.metric_value.toFixed(4)}</td>
                <td>{row.gate_passed === null ? '—' : row.gate_passed ? 'pass' : 'fail'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Metrics panel: one section per requested Variant, grouped from the flat `/metrics` response. */
function MetricsPanel({ metrics, modelIds, variants }: { metrics: ForecastMetric[]; modelIds: string[]; variants: ForecastVariant[] }) {
  const byModel = new Map<string, ForecastMetric[]>()
  for (const metric of metrics) {
    const rows = byModel.get(metric.model_id) ?? []
    rows.push(metric)
    byModel.set(metric.model_id, rows)
  }

  return (
    <section className="forecast-metrics">
      <h2>Metrics</h2>
      {modelIds.map((modelId) => (
        <VariantMetrics key={modelId} modelId={modelId} rows={byModel.get(modelId) ?? []} variants={variants} />
      ))}
    </section>
  )
}

/**
 * Day picker + Variant multi-select + quantile fan/actual overlay + metrics
 * panel (P4-forecast-screen-SPEC.md). Every hook below is called
 * unconditionally on every render — the "no Variants yet" and loading
 * states are handled by conditional *rendering*, after all hooks run, per
 * the rules of hooks.
 */
export function ForecastScreen() {
  const { data: variants, loading: variantsLoading, error: variantsError } = useForecastVariants()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedModelIds, setSelectedModelIds] = useState<string[] | null>(null)

  const overallLastDate = useMemo(() => {
    if (!variants || variants.length === 0) return null
    return variants.reduce(
      (latest, v) => (v.last_settlement_date > latest ? v.last_settlement_date : latest),
      variants[0].last_settlement_date,
    )
  }, [variants])

  const overallFirstDate = useMemo(() => {
    if (!variants || variants.length === 0) return null
    return variants.reduce(
      (earliest, v) => (v.first_settlement_date < earliest ? v.first_settlement_date : earliest),
      variants[0].first_settlement_date,
    )
  }, [variants])

  const date = selectedDate ?? overallLastDate
  const modelIds = selectedModelIds ?? (variants ? variants.map((v) => v.model_id) : [])

  const { data: dayRecords, loading: dayLoading, error: dayError } = useForecastDay(date, modelIds)
  const { data: metrics, loading: metricsLoading, error: metricsError } = useForecastMetrics(modelIds)

  if (variantsLoading) return <LoadingState />
  if (variantsError) return <ErrorState error={variantsError} />

  if (!variants || variants.length === 0) {
    return (
      <div>
        <h2>Forecasts</h2>
        <EmptyState>
          No forecast Variants in the local store yet — run a gridflow_models training job to populate
          one.
        </EmptyState>
      </div>
    )
  }

  const toggleModel = (modelId: string) => {
    setSelectedModelIds((current) => {
      const base = current ?? variants.map((v) => v.model_id)
      return base.includes(modelId) ? base.filter((id) => id !== modelId) : [...base, modelId]
    })
  }

  return (
    <div>
      <h2>Forecasts</h2>
      <div className="forecast-controls">
        <label className="forecast-date-picker">
          Day
          <input
            type="date"
            value={date ?? ''}
            min={overallFirstDate ?? undefined}
            max={overallLastDate ?? undefined}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </label>
        <fieldset className="forecast-variant-picker">
          <legend>Variants</legend>
          {variants.map((variant) => (
            <label key={variant.model_id}>
              <input
                type="checkbox"
                checked={modelIds.includes(variant.model_id)}
                onChange={() => toggleModel(variant.model_id)}
              />
              {variant.title}
              {!variant.gates_passed && <span className="forecast-gate-fail"> (gates failed)</span>}
            </label>
          ))}
        </fieldset>
      </div>

      {dayLoading ? (
        <LoadingState />
      ) : dayError ? (
        <ErrorState error={dayError} />
      ) : dayRecords === null ? null : dayRecords.length === 0 ? (
        <EmptyState>
          No forecast for {date} for{' '}
          {modelIds.length > 0
            ? modelIds.map((id) => titleFor(variants, id)).join(', ')
            : 'any selected Variant'}
          . Available range across all Variants: {overallFirstDate} to {overallLastDate}.
        </EmptyState>
      ) : (
        <ChartCard title="Quantile fan + actual">
          <ForecastFanChart records={dayRecords} variants={variants} />
        </ChartCard>
      )}

      {metricsLoading ? (
        <LoadingState />
      ) : metricsError ? (
        <ErrorState error={metricsError} />
      ) : (
        <MetricsPanel metrics={metrics ?? []} modelIds={modelIds} variants={variants} />
      )}
    </div>
  )
}
