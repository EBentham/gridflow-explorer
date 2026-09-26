/**
 * /forecasts: the v0.3 forecast screen over gridflow_models' forecast store.
 * Its design is owned by gridflow_models v1.7 P4, so v0.4 wraps it in the
 * new shell without restyling it (EFFORT-PLAN OQ-2); only its colours moved
 * onto the tokens. The catalogue reaches it from its note on gridflow's own
 * tables; it isn't pinned.
 */
import { useMemo, useState } from 'react'
import { Screen, type ViewState } from '../../design/frame'
import { useDocumentTitle } from '../../design/title'
import { ChartCard } from './ChartCard'
import { EmptyState } from './EmptyState'
import { ErrorState } from './ErrorState'
import { ForecastFanChart } from './ForecastFanChart'
import { LoadingState } from './LoadingState'
import type { ForecastMetric, ForecastVariant } from '../../api/types'
import { variantKey } from '../../api/types'
import { useForecastDay } from '../../hooks/useForecastDay'
import { useForecastMetrics } from '../../hooks/useForecastMetrics'
import { useForecastVariants } from '../../hooks/useForecastVariants'
import './forecasts.css'

function titleFor(variants: ForecastVariant[], key: string): string {
  return variants.find((v) => variantKey(v.model_id, v.vintage_policy_id) === key)?.title ?? key
}

/**
 * The caveat is a three-state fact, not a boolean with a default: `true`
 * (applies), `false` (verified not applicable), or "unknown" when no
 * metrics row exists yet for this Variant's newest run. Collapsing
 * "unknown" into `false` (a Sol diff review finding) would report
 * "not applicable" for a Variant that simply has not been scored.
 */
function caveatFor(rows: ForecastMetric[]): boolean | null {
  return rows.length === 0 ? null : rows[0].perfect_prog_caveat
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
  const caveat = caveatFor(rows)
  return (
    <div className="forecast-metrics-variant">
      <h3>{titleFor(variants, key)}</h3>
      <p className="perfect-prog-caveat">
        {caveat === true
          ? 'Perfect-prog caveat: this score uses the realised (actual) weather, not a day-ahead ' +
            'forecast — it is optimistic by the unmeasured day-ahead weather-forecast error (ADR-056).'
          : caveat === false
            ? 'Perfect-prog caveat: not applicable — this run uses genuine day-ahead inputs.'
            : "Perfect-prog caveat: unknown — no metrics recorded for this Variant's newest run."}
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
 *
 * Deselecting every checkbox means "show nothing", not "show every
 * Variant" — `variantKeys` becomes `[]` (an explicit empty array,
 * distinct from `selectedVariantKeys === null`'s "not customised yet"),
 * and `useForecastDay`/`useForecastMetrics` both treat an empty key list
 * as "fetch nothing" (a Sol diff review finding: the previous behaviour
 * silently fell back to every Variant, contradicting the screen's own
 * controls).
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
  useDocumentTitle('Forecasts')

  const failure = variantsError ?? dayError ?? metricsError
  const state: ViewState = variantsLoading
    ? 'loading'
    : failure
      ? failure.code === 'refresh_in_progress'
        ? 'refreshing'
        : 'error'
      : !variants || variants.length === 0
        ? 'empty'
        : dayLoading || metricsLoading
          ? 'loading'
          : dayRecords && dayRecords.length > 0
            ? 'data'
            : 'empty'

  if (variantsLoading)
    return (
      <Screen state={state}>
        <LoadingState />
      </Screen>
    )
  if (variantsError)
    return (
      <Screen state={state}>
        <ErrorState error={variantsError} />
      </Screen>
    )

  if (!variants || variants.length === 0) {
    return (
      <Screen state={state}>
        <h2>Forecasts</h2>
        <EmptyState>
          No forecast Variants in the local store yet — run a gridflow_models training job to populate
          one.
        </EmptyState>
      </Screen>
    )
  }

  const toggleVariant = (key: string) => {
    setSelectedVariantKeys((current) => {
      const base = current ?? allVariantKeys
      return base.includes(key) ? base.filter((k) => k !== key) : [...base, key]
    })
  }

  return (
    <Screen state={state}>
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
                {variant.gates_passed === false && (
                  <span className="forecast-gate-fail"> (gates failed)</span>
                )}
                {variant.gates_passed === null && (
                  <span className="forecast-gate-unknown"> (gates unknown)</span>
                )}
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
          {variantKeys.length === 0 ? (
            <>No Variant selected — check at least one Variant above to see its forecast.</>
          ) : (
            <>
              No forecast for {date} for {variantKeys.map((key) => titleFor(variants, key)).join(', ')}.
              Available range across all Variants: {overallFirstDate} to {overallLastDate}.
            </>
          )}
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
    </Screen>
  )
}
