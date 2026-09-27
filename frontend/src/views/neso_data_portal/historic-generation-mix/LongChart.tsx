/**
 * The long view's chart: the fuels stacked as each period's mean (a UK day,
 * or a calendar month past three years), with the carbon intensity's period
 * mean below on the same clock. It is composed from the shared chart theme
 * (`design/chartTheme.ts`, `design/charts.tsx`) as the template's
 * `SeriesChart` is; it exists because that chart's clock ticks every 14 days
 * past four months and names no year (NEEDS.md), so it can't draw years.
 *
 * Ticks fall on the first of the month (daily points) or on 1 January
 * (monthly points), with a rule at each. A period with nothing held is a gap
 * in the stack, never zero. Selecting a fuel in the key draws it alone, with
 * its highest and lowest period labelled; the carbon intensity's are always
 * labelled. A click selects the table's period under it (a month, or a year).
 */
import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, DayRules, Extreme, HighlightBand, SelectionEdges, TooltipBox, type TipRow } from '../../../design/charts'
import { CHART, CURSOR, GRID, bandProps, extremeAnchor, lineProps, timeAxis, valueAxis } from '../../../design/chartTheme'
import { fmtN, niceTicks, stepDigits, type Scale } from '../../../design/format'
import { axisClockCaption } from '../../../design/time'
import type { DisplayUnit } from '../../_template/units'
import { AXIS_WIDTH, CI, CI_COLOR, CI_LABEL, FUELS, amountText, focusedFuel, type Fuel } from './fuels'
import { heldText, longTicks, periodAt, periodName, type Clock, type Period } from './periods'

type Point = { t: number } & Record<string, number | null>

interface TipProps {
  active?: boolean
  label?: string | number
}

interface ClickState {
  activeTooltipIndex?: number | string | null
}

const SYNC = 'hgm-long'

/**
 * Room for the labelled extremes: one more step above a highest value in the
 * top 15% of the scale, so its label clears the unit caption, and one below a
 * lowest value in the bottom 15%, so its label, set under the dot, clears the
 * time ticks. Where a step below would pass `floor` (nothing here is below
 * zero), the axis runs half a step past it with no tick there, so the label
 * still sits under the dot: every other value is above it, so the line never
 * crosses it.
 */
function withRoom(s: Scale, hi: number | null, lo: number | null, floor: number | null): Scale {
  const step = s.ticks[1] - s.ticks[0]
  if (!(step > 0)) return s
  let { domain, ticks } = s
  const range = () => domain[1] - domain[0]
  if (hi !== null && (domain[1] - hi) / range() < 0.15) {
    domain = [domain[0], domain[1] + step]
    ticks = [...ticks, domain[1]]
  }
  if (lo !== null && (lo - domain[0]) / range() < 0.15) {
    if (floor === null || domain[0] - step >= floor) {
      domain = [domain[0] - step, domain[1]]
      ticks = [domain[0], ...ticks]
    } else {
      domain = [domain[0] - step / 2, domain[1]]
    }
  }
  return { domain, ticks }
}

function axisOf(scale: Scale) {
  const digits = stepDigits(scale.ticks[1] - scale.ticks[0])
  return (v: number) => fmtN(v, digits)
}

/** Highest and lowest held value of one key among the points. */
function extremes(points: Point[], key: string): { high: Point; low: Point } | null {
  let high: Point | null = null
  let low: Point | null = null
  for (const p of points) {
    const v = p[key]
    if (typeof v !== 'number') continue
    if (!high || v > (high[key] as number)) high = p
    if (!low || v < (low[key] as number)) low = p
  }
  return high && low ? { high, low } : null
}

export function LongChart({
  periods,
  rowPeriods,
  clock,
  domain,
  gw,
  ci,
  stepWords,
  focus,
  picked,
  onPick,
}: {
  /** One per chart point: days, or months. */
  periods: Period[]
  /** The working panel's periods (months, or years): what a click selects. */
  rowPeriods: Period[]
  clock: Clock
  domain: [number, number]
  gw: DisplayUnit
  ci: DisplayUnit
  /** What the rows under each mean are: `half-hours`, `4-hour means`. */
  stepWords: string
  focus?: string
  picked?: number
  onPick: (start: number) => void
}) {
  const one = focusedFuel(focus)
  const shown: Fuel[] = one ? [one] : FUELS
  const points = useMemo<Point[]>(() => periods.map((p) => ({ t: p.start, ...p.mean, __total: p.total })), [periods])
  const byT = useMemo(() => new Map(periods.map((p) => [p.start, p])), [periods])
  const ticks = useMemo(() => longTicks(domain, clock), [domain, clock])
  const rowKind = rowPeriods[0]?.kind ?? 'year'

  const scale = useMemo(() => {
    let hi = 0
    let lo: number | null = null
    for (const p of periods) {
      const v = one ? p.mean[one.column] : p.total
      if (typeof v !== 'number') continue
      hi = Math.max(hi, v)
      lo = lo === null ? v : Math.min(lo, v)
    }
    const s = niceTicks(0, hi || 1)
    // A focused fuel's extremes are labelled; the stack's aren't. Its band still fills from zero when the axis runs under it.
    return one ? withRoom(s, hi, lo, 0) : s
  }, [periods, one])
  const ciScale = useMemo(() => {
    const vs = periods.map((p) => p.mean[CI]).filter((v): v is number => typeof v === 'number')
    if (!vs.length) return niceTicks(0, 1)
    const hi = Math.max(...vs)
    const lo = Math.min(...vs)
    // A short panel: four steps or so, so its tick labels don't crowd.
    return withRoom(niceTicks(lo, hi, 4), hi, lo, 0)
  }, [periods])
  const fuelEx = useMemo(() => (one ? extremes(points, one.column) : null), [points, one])
  const ciEx = useMemo(() => extremes(points, CI), [points])

  const pickedPeriod = picked === undefined ? undefined : rowPeriods.find((p) => p.start === picked)
  const band = pickedPeriod ? ([Math.max(pickedPeriod.start, domain[0]), Math.min(pickedPeriod.end, domain[1])] as const) : null

  const noteOf = (p: Period): string => {
    if (!p.held) return 'Not held locally'
    const mean = p.held === p.steps ? `Mean of ${heldText(p)} ${stepWords}` : `Mean of the ${heldText(p)} ${stepWords} held`
    return `${mean}. Click to select the ${rowKind}.`
  }
  const when = (t: number) => {
    const p = byT.get(t)
    return p ? periodName(p, { short: true }) : ''
  }
  const title = (p: Period) => periodName(p)

  const fuelTip = ({ active, label }: TipProps) => {
    const p = typeof label === 'number' ? byT.get(label) : undefined
    if (!active || !p) return null
    const rows: TipRow[] = [...shown].reverse().map((f) => {
      const v = p.mean[f.column]
      return { key: f.column, color: f.fill, label: f.label, value: v === null ? 'no value' : amountText(gw, v) }
    })
    if (!one && p.total !== null) rows.push({ key: '__total', color: 'transparent', label: 'Total', value: gw.format(p.total), strong: true })
    return <TooltipBox title={title(p)} rows={p.held ? rows : []} note={noteOf(p)} />
  }
  const ciTip = ({ active, label }: TipProps) => {
    const p = typeof label === 'number' ? byT.get(label) : undefined
    if (!active || !p) return null
    const v = p.mean[CI]
    return <TooltipBox title={title(p)} rows={p.held ? [{ key: CI, color: CI_COLOR, label: CI_LABEL, value: v === null ? 'no value' : ci.format(v) }] : []} note={noteOf(p)} />
  }

  const click = (s: ClickState | null | undefined) => {
    const i = Number(s?.activeTooltipIndex)
    const point = Number.isInteger(i) ? points[i] : undefined
    const row = point ? periodAt(rowPeriods, point.t) : undefined
    if (row) onPick(row.start)
  }

  // The template's split for a chart with a panel below it, the lower one a little taller for its labelled extremes.
  const upperHeight = Math.round(CHART.height * 0.7)
  const lowerHeight = Math.round(CHART.height * 0.4)

  return (
    <div className="gf-chart-stack">
      <ChartFrame height={upperHeight} pickable>
        <ComposedChart data={points} margin={{ ...CHART.margin, bottom: 2 }} onClick={click} syncId={SYNC} syncMethod="value">
          <CartesianGrid {...GRID} />
          {band && <HighlightBand x1={band[0]} x2={band[1]} />}
          <DayRules midnights={ticks.midnights} />
          <XAxis {...timeAxis(domain, ticks, { labels: false })} />
          <YAxis {...valueAxis(gw.caption, scale, { width: AXIS_WIDTH, format: axisOf(scale) })} />
          <Tooltip content={fuelTip} cursor={CURSOR} isAnimationActive={false} />
          {shown.map((f) => (
            // Embedded wind's hatch is its fill only: a focused band's line stays the solid colour.
            <Area key={f.column} dataKey={f.column} stackId={one ? undefined : 'fuels'} {...bandProps(f.color, { focused: Boolean(one) })} fill={f.fill} />
          ))}
          {band && <SelectionEdges x1={band[0]} x2={band[1]} />}
          {one && fuelEx && (
            <Extreme
              x={fuelEx.high.t}
              y={fuelEx.high[one.column] as number}
              anchor={extremeAnchor(fuelEx.high.t, domain)}
              color={one.color}
              text={`${gw.format(fuelEx.high[one.column] as number)}, highest, ${when(fuelEx.high.t)}`}
            />
          )}
          {one && fuelEx && fuelEx.low.t !== fuelEx.high.t && (
            <Extreme
              x={fuelEx.low.t}
              y={fuelEx.low[one.column] as number}
              anchor={extremeAnchor(fuelEx.low.t, domain)}
              below
              color={one.color}
              text={`${gw.format(fuelEx.low[one.column] as number)}, lowest, ${when(fuelEx.low.t)}`}
            />
          )}
        </ComposedChart>
      </ChartFrame>
      <ChartFrame height={lowerHeight} caption={axisClockCaption(domain[0], domain[1])} pickable>
        <ComposedChart data={points} margin={CHART.margin} onClick={click} syncId={SYNC} syncMethod="value">
          <CartesianGrid {...GRID} />
          {band && <HighlightBand x1={band[0]} x2={band[1]} />}
          <DayRules midnights={ticks.midnights} />
          <XAxis {...timeAxis(domain, ticks)} />
          <YAxis {...valueAxis(ci.caption, ciScale, { width: AXIS_WIDTH, format: axisOf(ciScale) })} />
          <Tooltip content={ciTip} cursor={CURSOR} isAnimationActive={false} />
          <Line dataKey={CI} {...lineProps(CI_COLOR)} />
          {band && <SelectionEdges x1={band[0]} x2={band[1]} />}
          {ciEx && (
            <Extreme
              x={ciEx.high.t}
              y={ciEx.high[CI] as number}
              anchor={extremeAnchor(ciEx.high.t, domain)}
              color={CI_COLOR}
              text={`${ci.format(ciEx.high[CI] as number)}, highest, ${when(ciEx.high.t)}`}
            />
          )}
          {ciEx && ciEx.low.t !== ciEx.high.t && (
            <Extreme
              x={ciEx.low.t}
              y={ciEx.low[CI] as number}
              anchor={extremeAnchor(ciEx.low.t, domain)}
              below
              color={CI_COLOR}
              text={`${ci.format(ciEx.low[CI] as number)}, lowest, ${when(ciEx.low.t)}`}
            />
          )}
        </ComposedChart>
      </ChartFrame>
    </div>
  )
}
