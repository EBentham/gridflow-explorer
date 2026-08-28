import type { ReactElement, ReactNode } from 'react'
import { Area, CartesianGrid, ComposedChart, Legend, Line, Tooltip, XAxis, YAxis } from 'recharts'
import type { ForecastDayRecord, ForecastVariant } from '../api/types'
import { colorFor } from '../lib/palette'
import { tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from '../lib/tooltip'

interface ForecastFanChartProps {
  records: ForecastDayRecord[]
  variants: ForecastVariant[]
}

type FanRow = {
  delivery_time: string
  settlement_period: number
} & Record<string, string | number | null | undefined>

/** One nested-band spec: the two quantile keys bounding the band, and its opacity. */
const BANDS = [
  { low: 'q_0.05', high: 'q_0.95', opacity: 0.12, label: '5th-95th pct' },
  { low: 'q_0.1', high: 'q_0.9', opacity: 0.22, label: '10th-90th pct' },
  { low: 'q_0.25', high: 'q_0.75', opacity: 0.35, label: '25th-75th pct' },
] as const

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Formats a UTC ISO timestamp (`2026-08-10T00:00:00Z`) as `HH:mm`. */
function formatTimeOfDay(isoTimestamp: string): string {
  return isoTimestamp.slice(11, 16)
}

/**
 * Pivots per-Variant `/api/forecasts/day` records into one row per
 * settlement period, keyed `${model_id}__<field>` so multiple Variants'
 * fans can render side by side on one chart.
 */
function buildFanRows(records: ForecastDayRecord[]): FanRow[] {
  const byPeriod = new Map<number, FanRow>()
  for (const record of records) {
    let row = byPeriod.get(record.settlement_period)
    if (!row) {
      row = { delivery_time: record.delivery_time, settlement_period: record.settlement_period }
      byPeriod.set(record.settlement_period, row)
    }
    const prefix = record.model_id
    for (const band of BANDS) {
      row[`${prefix}__${band.low}__base`] = record[band.low]
      row[`${prefix}__${band.low}__span`] = record[band.high] - record[band.low]
    }
    row[`${prefix}__median`] = record['q_0.5']
    row[`${prefix}__actual`] = record.actual
  }
  return [...byPeriod.values()].sort((a, b) => a.settlement_period - b.settlement_period)
}

/**
 * Builds one Variant's chart layers: three nested `<Area>` bands
 * (0.05-0.95 / 0.1-0.9 / 0.25-0.75, increasing opacity, each a transparent
 * "base" area stacked under a visibly-filled "span" area — the standard
 * Recharts band idiom), `q_0.5` as a solid line, `actual` as a dashed,
 * contrasting line. Returned as a flat array (not a wrapper element) so
 * `ComposedChart` sees `Area`/`Line` as direct children — Recharts does
 * not recurse into arbitrary wrapper elements to find its own chart types.
 */
function renderVariantLayers(modelId: string, title: string, color: string): ReactElement[] {
  const layers: ReactElement[] = BANDS.flatMap((band) => [
    <Area
      key={`${modelId}-${band.low}-base`}
      dataKey={`${modelId}__${band.low}__base`}
      stackId={`${modelId}-${band.low}`}
      stroke="none"
      fill="transparent"
      isAnimationActive={false}
      legendType="none"
      name={`${title} base`}
      tooltipType="none"
    />,
    <Area
      key={`${modelId}-${band.low}-span`}
      dataKey={`${modelId}__${band.low}__span`}
      stackId={`${modelId}-${band.low}`}
      stroke="none"
      fill={hexToRgba(color, band.opacity)}
      isAnimationActive={false}
      name={`${title} ${band.label}`}
    />,
  ])
  layers.push(
    <Line
      key={`${modelId}-median`}
      dataKey={`${modelId}__median`}
      name={`${title} median (q_0.5)`}
      stroke={color}
      dot={false}
      isAnimationActive={false}
    />,
    <Line
      key={`${modelId}-actual`}
      dataKey={`${modelId}__actual`}
      name={`${title} actual`}
      stroke={color}
      strokeDasharray="4 3"
      strokeWidth={2}
      dot={false}
      isAnimationActive={false}
    />,
  )
  return layers
}

/**
 * Quantile fan + `actual` overlay for one or more forecast Variants.
 *
 * The X axis is UTC settlement time — labelled explicitly, since
 * `delivery_time` has already been relabelled from Europe/London by the
 * backend and the raw ISO string could otherwise read as ambiguous.
 */
export function ForecastFanChart({ records, variants }: ForecastFanChartProps) {
  const rows = buildFanRows(records)
  const modelIds = [...new Set(records.map((r) => r.model_id))]
  const titleFor = (modelId: string) => variants.find((v) => v.model_id === modelId)?.title ?? modelId

  return (
    <ComposedChart data={rows}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="delivery_time"
        tickFormatter={formatTimeOfDay}
        tick={{ fontSize: 11 }}
        minTickGap={40}
        label={{ value: 'Settlement time (UTC)', position: 'insideBottom', offset: -5 }}
      />
      <YAxis />
      <Tooltip
        contentStyle={tooltipContentStyle}
        labelStyle={tooltipLabelStyle}
        itemStyle={tooltipItemStyle}
        labelFormatter={(value: ReactNode) => `Delivery ${String(value)}`}
      />
      <Legend />
      {modelIds.flatMap((modelId, index) => renderVariantLayers(modelId, titleFor(modelId), colorFor(index)))}
    </ComposedChart>
  )
}
