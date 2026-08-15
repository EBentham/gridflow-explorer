import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import type { DataRecord, SeriesSpec } from '../api/types'
import { colorFor } from '../lib/palette'

interface SeriesLineChartProps {
  records: DataRecord[]
  series: SeriesSpec
  seriesIndex: number
  timestampKey: string
}

/** A single `<Line>` for one chosen series. */
export function SeriesLineChart({ records, series, seriesIndex, timestampKey }: SeriesLineChartProps) {
  return (
    <LineChart data={records}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey={timestampKey} tick={{ fontSize: 11 }} minTickGap={40} />
      <YAxis />
      <Tooltip />
      <Line
        type="monotone"
        dataKey={series.key}
        name={series.label}
        stroke={colorFor(seriesIndex)}
        dot={false}
      />
    </LineChart>
  )
}
