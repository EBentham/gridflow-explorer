import { useMemo, useState } from 'react'
import { ChartCard } from '../components/ChartCard'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { ForecastFanChart } from '../components/ForecastFanChart'
import { LoadingState } from '../components/LoadingState'
import type { ForecastMetric, ForecastVariant } from '../api/types'
import { variantKey } from '../api/types'
import { useForecastDay } from '../hooks/useForecastDay'
import { useForecastMetrics } from '../hooks/useForecastMetrics'
import { useForecastVariants } from '../hooks/useForecastVariants'

function titleFor(variants: ForecastVariant[], key: string): string {
  return variants.find((v) => variantKey(v.model_id, v.vintage_policy_id) === key)?.title ?? key
}

/** One Variant's caveat line + metric table, always visible (never a tooltip). */
function VariantMetrics({
  variantKey: key,
  rows,
  variants,
}: {
  variantKey: string
  rows: ForecastMetric[]
  variants: ForecastVariant[]
}) {
  const caveat = rows[0]?.perfect_prog_caveat ?? false
  return (
    <div className="forecast-metrics-variant">
      <h3>{titleFor(variants, key)}</h3>
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

/**
 * Metrics panel: one section per requested Variant, grouped from the flat
 * `/metrics` response by `(model_id, vintage_policy_id)` pair — grouping
 * by `model_id` alone would attribute one policy's gates to the other
 * (ADR-057 secs 2-3).
 */
function MetricsPanel({
  metrics,
  variantKeys,
  variants,
}: {
  metrics: ForecastMetric[]
  variantKeys: string[]
  variants: ForecastVariant[]
}) {
  const byVariant = new Map<string, ForecastMetric[]>()
  for (const metric of metrics) {
    const key = variantKey(metric.model_id, metric.vintage_policy_id)
    const rows = byVariant.get(key) ?? []
    rows.push(metric)
    byVariant.set(key, rows)
  }

  return (
    <section className="forecast-metrics">
      <h2>Metrics</h2>
      {variantKeys.map((key) => (
        <VariantMetrics key={key} variantKey={key} rows={byVariant.get(key) ?? []} variants={variants} />
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
 *
 * A Variant is `(model_id, vintage_policy_id)`, not `model_id` alone
 * (ADR-057 secs 2-3: a single `model_id` can carry more than one live
 * `vintage_policy_id`) — selection state, the checkbox list, and the
 * metrics grouping are all keyed on `variantKey(model_id,
 * vintage_policy_id)` throughout this screen.
 */
export function ForecastScreen() {
  const { data: variants, loading: variantsLoading, error: variantsError } = useForecastVariants()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedVariantKeys, setSelectedVariantKeys] = useState<string[] | null>(null)

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
  const allVariantKeys = useMemo(
    () => (variants ? variants.map((v) => variantKey(v.model_id, v.vintage_policy_id)) : []),
    [variants],
  )
  const variantKeys = selectedVariantKeys ?? allVariantKeys

  const { data: dayRecords, loading: dayLoading, error: dayError } = useForecastDay(date, variantKeys)
  const { data: metrics, loading: metricsLoading, error: metricsError } = useForecastMetrics(variantKeys)

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

  const toggleVariant = (key: string) => {
    setSelectedVariantKeys((current) => {
      const base = current ?? allVariantKeys
      return base.includes(key) ? base.filter((k) => k !== key) : [...base, key]
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
          {variants.map((variant) => {
            const key = variantKey(variant.model_id, variant.vintage_policy_id)
            return (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={variantKeys.includes(key)}
                  onChange={() => toggleVariant(key)}
                />
                {variant.title}
                {!variant.gates_passed && <span className="forecast-gate-fail"> (gates failed)</span>}
              </label>
            )
          })}
        </fieldset>
      </div>

      {dayLoading ? (
        <LoadingState />
      ) : dayError ? (
        <ErrorState error={dayError} />
      ) : dayRecords === null ? null : dayRecords.length === 0 ? (
        <EmptyState>
          No forecast for {date} for{' '}
          {variantKeys.length > 0
            ? variantKeys.map((key) => titleFor(variants, key)).join(', ')
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
        <MetricsPanel metrics={metrics ?? []} variantKeys={variantKeys} variants={variants} />
      )}
    </div>
  )
}
