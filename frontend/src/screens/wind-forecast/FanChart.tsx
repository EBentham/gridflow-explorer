/**
 * A day-ahead quantile forecast as a fan (the 50, 80 and 90% intervals as
 * bands), the median as a line (dashed when synthetic), and the settled
 * actual in ink, with a dashed rule where settlement stops.
 */
import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, TooltipBox } from '../../design/charts'
import { CHART, CURSOR, GRID, TICK, fanBandProps, lineProps, timeAxis, valueAxis } from '../../design/chartTheme'
import { fmt1, niceTicks } from '../../design/format'
import { HALF_HOUR, axisClockCaption, clock, halfHourWindow, ukTimeTicks } from '../../design/time'
import type { FanRow } from './fan'

interface TipProps {
  active?: boolean
  payload?: readonly { payload?: FanRow }[]
}

export function FanChart({ rows, unit, fixture = false, height }: { rows: FanRow[]; unit: string; fixture?: boolean; height?: number }) {
  const d0 = rows[0]?.t ?? 0
  const d1 = (rows.at(-1)?.t ?? 0) + HALF_HOUR
  const domain = useMemo<[number, number]>(() => [d0, d1], [d0, d1])
  const ticks = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const settled = rows.filter((r) => r.actual !== null).at(-1)
  const settledEnd = settled ? settled.t + HALF_HOUR : null
  const scale = useMemo(() => {
    const v = rows.flatMap((r) => [r.q05, r.q95, r.actual ?? r.q50])
    return niceTicks(Math.min(0, ...v), Math.max(...v))
  }, [rows])
  const value = (v: number) => `${fmt1(v)} ${unit}`

  const renderTip = ({ active, payload }: TipProps) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    return (
      <TooltipBox
        title={`SP ${row.sp}, ${halfHourWindow(row.t)}`}
        rows={[
          { key: 'a', color: 'var(--chart-actual)', label: 'Actual', value: row.actual === null ? 'not settled' : value(row.actual), strong: true },
          { key: 'm', color: 'var(--chart-fan)', label: 'Median forecast', value: value(row.q50), dashed: fixture },
          { key: '50', color: 'var(--chart-fan-soft)', label: '50% interval', value: `${fmt1(row.q25)}–${fmt1(row.q75)}` },
          { key: '90', color: 'var(--chart-fan-soft)', label: '90% interval', value: `${fmt1(row.q05)}–${fmt1(row.q95)}` },
        ]}
        note={fixture ? 'Fixture data, synthetic' : undefined}
      />
    )
  }

  return (
    <ChartFrame height={height} caption={axisClockCaption(d0, d1)}>
      <ComposedChart data={rows} margin={CHART.margin}>
        <CartesianGrid {...GRID} />
        <XAxis {...timeAxis(domain, ticks)} />
        <YAxis {...valueAxis(unit, scale, { width: 44 })} />
        <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
        <Area dataKey="b90" {...fanBandProps(CHART.fan.b90)} />
        <Area dataKey="b80" {...fanBandProps(CHART.fan.b80)} />
        <Area dataKey="b50" {...fanBandProps(CHART.fan.b50)} />
        {settledEnd !== null && settledEnd < d1 && (
          <ReferenceLine
            x={settledEnd}
            stroke="var(--chart-grid-strong)"
            strokeDasharray="2 3"
            label={{ ...TICK, value: `settled to ${clock(settledEnd)}`, position: 'insideTopLeft', dx: 4 }}
          />
        )}
        <Line dataKey="q50" {...lineProps('var(--chart-fan)', { fixture })} />
        <Line dataKey="actual" {...lineProps('var(--chart-actual)')} />
      </ComposedChart>
    </ChartFrame>
  )
}
