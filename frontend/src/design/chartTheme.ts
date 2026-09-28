/**
 * The chart language (DESIGN §6) as constants and Recharts prop factories.
 * Every chart composes its axes, grid, tooltip, marks and extremes from here
 * and from the components in `charts.tsx`; no view styles Recharts ad hoc.
 * Colours are never literal: every mark reads a CSS custom property
 * (`--chart-*`, `--fuel-*`), so light and dark are a token swap.
 */
import { fmt0, type Scale } from './format'
import type { TimeTicks } from './time'

export const CHART = {
  /** Straight segments between half-hours: no invented curvature. */
  curve: 'linear',
  areaOpacity: 0.95,
  /** Fill of a single focused band, drawn over its own line. */
  focusOpacity: 0.22,
  /** Surface-coloured gap between stacked bands, px. */
  gap: 1,
  line: 1.75,
  font: 12,
  height: 380,
  /** Dash for synthetic (fixture) traces. */
  fixtureDash: '5 4',
  /** Opacity of the 90, 80 and 50% forecast bands, stacked. */
  fan: { b90: 0.13, b80: 0.14, b50: 0.2 },
  margin: { top: 26, right: 18, bottom: 6, left: 2 },
} as const

/**
 * Colours for series that have no entity colour of their own (areas, sites,
 * providers), drawn from the existing chart and fuel tokens in an order that
 * keeps neighbours apart. Never chartreuse: that means "where you are". A
 * page assigns them by entity (sorted, or pinned in its config), so a colour
 * follows its entity rather than a series' rank; fuels keep `--fuel-*`.
 */
export const SERIES_COLORS = [
  'var(--chart-price)',
  'var(--chart-price-2)',
  'var(--fuel-wind)',
  'var(--fuel-biomass)',
  'var(--fuel-pumped_storage)',
  'var(--fuel-peaking)',
  'var(--fuel-hydro)',
  'var(--fuel-imports)',
  'var(--fuel-other)',
] as const

export const TICK = { fill: 'var(--chart-tick)', fontSize: CHART.font, fontFamily: 'var(--chart-font)' }

/** The horizontal grid: day rules stand in for vertical lines. */
export const GRID = { vertical: false, stroke: 'var(--chart-grid)' } as const

export const CURSOR = { stroke: 'var(--chart-cursor)', strokeWidth: 1 }

/** The unit as a caption above a value axis's ticks. */
export function unitCaption(unit: string) {
  return {
    value: unit,
    position: 'top' as const,
    offset: 12,
    fill: 'var(--chart-tick)',
    fontSize: CHART.font,
    fontFamily: 'var(--chart-font)',
    textAnchor: 'start' as const,
    dx: -4,
  }
}

/** Props for the epoch-ms time axis; `labels: false` for an upper panel sharing a lower one's clock. */
export function timeAxis(domain: [number, number], ticks: TimeTicks, { labels = true } = {}) {
  return {
    dataKey: 't',
    type: 'number' as const,
    scale: 'time' as const,
    domain,
    allowDataOverflow: true,
    ticks: ticks.ticks,
    tickFormatter: ticks.format,
    tick: labels ? TICK : false,
    stroke: 'var(--chart-axis)',
    tickLine: false,
    height: labels ? 24 : 4,
  }
}

/** Props for a value axis with its unit caption. */
export function valueAxis(unit: string, scale: Scale, { width = 44, format = fmt0 }: { width?: number; format?: (v: number) => string } = {}) {
  return {
    tick: TICK,
    stroke: 'var(--chart-axis)',
    axisLine: false,
    tickLine: false,
    width,
    domain: scale.domain,
    ticks: scale.ticks,
    tickFormatter: format,
    label: unitCaption(unit),
  }
}

/** The hover dot on a line: the series colour ringed in the chart surface. */
export function activeDot(color: string) {
  return { r: 4, fill: color, stroke: 'var(--chart-surface)', strokeWidth: 2 }
}

/** A line series: 1.75 px, no dots, broken at gaps, dashed when synthetic. */
export function lineProps(color: string, { fixture = false }: { fixture?: boolean } = {}) {
  return {
    type: CHART.curve,
    stroke: color,
    strokeWidth: CHART.line,
    strokeDasharray: fixture ? CHART.fixtureDash : undefined,
    dot: false,
    connectNulls: false,
    isAnimationActive: false,
    activeDot: activeDot(color),
  }
}

/** A stacked band, or the one band drawn alone when a key entry is focused. */
export function bandProps(color: string, { focused = false }: { focused?: boolean } = {}) {
  return {
    type: CHART.curve,
    fill: color,
    fillOpacity: focused ? CHART.focusOpacity : CHART.areaOpacity,
    stroke: focused ? color : 'var(--chart-surface)',
    strokeWidth: focused ? CHART.line : CHART.gap,
    connectNulls: false,
    isAnimationActive: false,
    activeDot: false as const,
  }
}

/** Label an extreme towards the chart's middle: in the right-hand 40%, anchor the text's end. */
export function extremeAnchor(t: number, domain: [number, number]): 'start' | 'end' {
  return (t - domain[0]) / Math.max(domain[1] - domain[0], 1) > 0.6 ? 'end' : 'start'
}

/** A forecast interval band (a `[low, high]` range value). */
export function fanBandProps(opacity: number) {
  return {
    type: CHART.curve,
    fill: 'var(--chart-fan)',
    fillOpacity: opacity,
    stroke: 'none',
    connectNulls: false,
    isAnimationActive: false,
    activeDot: false as const,
  }
}
