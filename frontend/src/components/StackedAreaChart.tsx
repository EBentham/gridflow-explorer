import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts'
import type { DataRecord, SeriesSpec } from '../api/types'
import { colorFor } from '../lib/palette'
import { tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from '../lib/tooltip'

interface StackedAreaChartProps {
  records: DataRecord[]
  series: SeriesSpec[]
  timestampKey: string
}

/** One `<Area stackId="1">` per series, in catalogue (display) order. */
export function StackedAreaChart({ records, series, timestampKey }: StackedAreaChartProps) {
  return (
    <AreaChart data={records}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey={timestampKey} tick={{ fontSize: 11 }} minTickGap={40} />
      <YAxis />
      <Tooltip
        contentStyle={tooltipContentStyle}
        labelStyle={tooltipLabelStyle}
        itemStyle={tooltipItemStyle}
      />
      <Legend />
      {series.map((s, index) => (
        <Area
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stackId="1"
          stroke={colorFor(index)}
          fill={colorFor(index)}
          isAnimationActive={false}
        />
      ))}
    </AreaChart>
  )
}
