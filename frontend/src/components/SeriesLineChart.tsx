import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { DataRecord, SeriesSpec } from '../api/types'
import { colorFor } from '../lib/palette'
import { tooltipContentStyle, tooltipItemStyle, tooltipLabelStyle } from '../lib/tooltip'

interface SeriesLineChartProps {
  records: DataRecord[]
  series: SeriesSpec[]
  timestampKey: string
}

/** One `<Line>` per series (palette-indexed by position) — a single chosen fuel or a multi-series dataset like system prices. */
export function SeriesLineChart({ records, series, timestampKey }: SeriesLineChartProps) {
  return (
    <LineChart data={records}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey={timestampKey} tick={{ fontSize: 11 }} minTickGap={40} />
      <YAxis />
      <Tooltip
        contentStyle={tooltipContentStyle}
        labelStyle={tooltipLabelStyle}
        itemStyle={tooltipItemStyle}
      />
      {series.length > 1 && <Legend />}
      {series.map((s, index) => (
        <Line
          key={s.key}
          type="monotone"
          dataKey={s.key}
          name={s.label}
          stroke={colorFor(index)}
          dot={false}
          isAnimationActive={false}
        />
      ))}
    </LineChart>
  )
}
