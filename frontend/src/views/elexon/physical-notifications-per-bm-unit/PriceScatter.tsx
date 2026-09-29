/**
 * One dot per half-hour: the market index price across, the unit's start
 * level up, so the prices it notified running at read against those it sat
 * at zero at. Composed only from the shared chart theme (grid, ticks, the
 * value axis with its unit caption above, the compact tooltip naming the
 * half-hour), as the wind sites page composes its scatter; the price's unit
 * is the caption under the lower right corner, where a time chart names its
 * clock. Only half-hours holding both figures are drawn.
 */
import { useMemo } from 'react'
import { CartesianGrid, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { ChartFrame, TooltipBox } from '../../../design/charts'
import { CHART, CURSOR, GRID, TICK, valueAxis } from '../../../design/chartTheme'
import { fmtN, niceTicks, stepDigits } from '../../../design/format'
import { periodName, type Settlement } from '../../_template/seriesModel'
import type { DisplayUnit } from '../../_template/units'
import { AXIS_WIDTH, MW, PRICE_COLOR, type Pair } from './figures'

interface TipProps {
  active?: boolean
  payload?: readonly { payload?: Pair }[]
}

export function PriceScatter({
  pairs,
  unitId,
  color,
  price,
  stepMs,
  settlement,
  height = 260,
}: {
  pairs: Pair[]
  unitId: string
  color: string
  price: DisplayUnit
  stepMs: number | null
  settlement: Map<number, Settlement> | null
  height?: number
}) {
  const xs = useMemo(() => niceTicks(Math.min(0, ...pairs.map((p) => p.x)), Math.max(1, ...pairs.map((p) => p.x)), 6), [pairs])
  const ys = useMemo(() => niceTicks(Math.min(0, ...pairs.map((p) => p.y)), Math.max(1, ...pairs.map((p) => p.y)), 4), [pairs])
  const xDigits = stepDigits(xs.ticks[1] - xs.ticks[0])
  const yDigits = stepDigits(ys.ticks[1] - ys.ticks[0])

  const renderTip = ({ active, payload }: TipProps) => {
    const p = payload?.[0]?.payload
    if (!active || !p) return null
    return (
      <TooltipBox
        title={periodName(p.t, stepMs, settlement)}
        rows={[
          { key: 'y', color, label: `${unitId}, start level`, value: MW.format(p.y) },
          { key: 'x', color: PRICE_COLOR, label: 'Market index price', value: price.format(p.x) },
        ]}
      />
    )
  }

  return (
    <ChartFrame height={height} caption={`Market index price, ${price.label ?? 'unit unconfirmed'}`}>
      <ScatterChart margin={CHART.margin}>
        <CartesianGrid {...GRID} />
        <XAxis
          type="number"
          dataKey="x"
          domain={xs.domain}
          ticks={xs.ticks}
          tickFormatter={(v: number) => fmtN(v, xDigits)}
          tick={TICK}
          stroke="var(--chart-axis)"
          tickLine={false}
          height={24}
          allowDataOverflow
        />
        <YAxis type="number" dataKey="y" {...valueAxis(MW.caption, ys, { width: AXIS_WIDTH, format: (v: number) => fmtN(v, yDigits) })} />
        <ZAxis range={[18, 18]} />
        <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
        <Scatter data={pairs} fill={color} fillOpacity={0.55} isAnimationActive={false} />
      </ScatterChart>
    </ChartFrame>
  )
}
