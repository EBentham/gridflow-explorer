/**
 * One dot per step: wind speed across, a second measure up. Composed only
 * from the shared chart theme (grid, ticks, value axis with its unit caption
 * above, the compact tooltip naming the period); the speed's unit is the
 * caption under the lower right corner, where a time chart names its clock.
 * Only steps that hold both figures are drawn: nothing is paired across a gap.
 */
import { useMemo } from 'react'
import { CartesianGrid, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { ChartFrame, TooltipBox } from '../../../design/charts'
import { CHART, CURSOR, GRID, TICK, valueAxis } from '../../../design/chartTheme'
import { fmtN, niceTicks, stepDigits } from '../../../design/format'
import { periodName } from '../../_template/seriesModel'
import type { DisplayUnit } from '../../_template/units'

export interface Pair {
  t: number
  x: number
  y: number
}

interface TipProps {
  active?: boolean
  payload?: readonly { payload?: Pair }[]
}

export function SpeedScatter({
  pairs,
  x,
  y,
  color,
  stepMs,
  height = 260,
}: {
  pairs: Pair[]
  x: { label: string; unit: DisplayUnit }
  y: { label: string; unit: DisplayUnit; color: string }
  color: string
  stepMs: number | null
  height?: number
}) {
  const xs = useMemo(() => niceTicks(Math.min(0, ...pairs.map((p) => p.x)), Math.max(1, ...pairs.map((p) => p.x)), 6), [pairs])
  const ys = useMemo(() => niceTicks(Math.min(0, ...pairs.map((p) => p.y)), Math.max(1, ...pairs.map((p) => p.y)), 4), [pairs])
  const xDigits = stepDigits(xs.ticks[1] - xs.ticks[0])
  const yDigits = stepDigits(ys.ticks[1] - ys.ticks[0])
  const yText = (v: number) => fmtN(v, yDigits)
  const width = Math.max(40, 10 + 7 * Math.max(...ys.ticks.map((v) => yText(v).length)))

  const renderTip = ({ active, payload }: TipProps) => {
    const p = payload?.[0]?.payload
    if (!active || !p) return null
    return (
      <TooltipBox
        title={periodName(p.t, stepMs, null)}
        rows={[
          { key: 'x', color, label: x.label, value: x.unit.format(p.x) },
          { key: 'y', color: y.color, label: y.label, value: y.unit.format(p.y) },
        ]}
      />
    )
  }

  return (
    <ChartFrame height={height} caption={`${x.label}, ${x.unit.label ?? 'unit unconfirmed'}`}>
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
        <YAxis type="number" dataKey="y" {...valueAxis(y.unit.caption, ys, { width, format: yText })} />
        <ZAxis range={[18, 18]} />
        <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
        <Scatter data={pairs} fill={color} fillOpacity={0.55} isAnimationActive={false} />
      </ScatterChart>
    </ChartFrame>
  )
}
