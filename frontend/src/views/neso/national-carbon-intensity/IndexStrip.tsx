/**
 * NESO's index as a strip over the main chart, on its clock: each run of
 * half-hours holding one grade is washed in the heat ramp, deeper for a
 * higher grade, and named where the run is wide enough to hold its name. A
 * half-hour with no grade held is left bare. The strip places nothing on the
 * value axis: the grades' boundaries in gCO₂/kWh aren't held here.
 */
import { useMemo } from 'react'
import { ComposedChart, Line, ReferenceArea, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, DayRules, TooltipBox } from '../../../design/charts'
import { CHART, CURSOR, TICK, timeAxis } from '../../../design/chartTheme'
import { ukTimeTicks } from '../../../design/time'
import { periodName, type SeriesModel } from '../../_template/seriesModel'
import { AXIS_WIDTH, COLORS, gradeOf, gradeRuns } from './figures'

const HEIGHT = 30
const MARGIN = { top: 3, right: CHART.margin.right, bottom: 0, left: CHART.margin.left }

interface TipProps {
  active?: boolean
  label?: string | number
}

interface ShapeProps {
  x?: number
  y?: number
  width?: number
  height?: number
}

function RunShape({ x = 0, y = 0, width = 0, height = 0, value, opacity }: ShapeProps & { value: string; opacity: number }) {
  const name = gradeOf(value)?.label ?? value
  // About 6.6px a character at 12px: the name shows only where it fits with room either side.
  const fits = width >= name.length * 6.6 + 10
  return (
    <g>
      <rect x={x} y={y} width={Math.max(width, 0)} height={height} fill={COLORS.grade} fillOpacity={opacity} />
      {fits && (
        <text x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle" fill="var(--ink)" fontSize={CHART.font} fontFamily="var(--chart-font)">
          {name}
        </text>
      )}
    </g>
  )
}

export function IndexStrip({ model, grades, domain }: { model: SeriesModel; grades: Map<number, string>; domain: [number, number] }) {
  const step = model.stepMs
  const runs = useMemo(() => gradeRuns(grades, step), [grades, step])
  const ticks = useMemo(() => ukTimeTicks(domain[0], domain[1]), [domain])
  const rows = useMemo(() => model.rows.map((r) => ({ t: r.t, h: grades.has(r.t) ? 0.5 : null })), [model.rows, grades])

  const renderTip = ({ active, label }: TipProps) => {
    if (!active || typeof label !== 'number') return null
    const g = grades.get(label)
    return (
      <TooltipBox
        title={periodName(label, step, model.settlement)}
        rows={g ? [{ key: 'grade', color: COLORS.grade, label: 'NESO index', value: gradeOf(g)?.label ?? g }] : []}
        note={g ? undefined : 'No index held'}
      />
    )
  }

  return (
    <ChartFrame height={HEIGHT}>
      <ComposedChart data={rows} margin={MARGIN}>
        {runs.map((r) => (
          <ReferenceArea
            key={r.start}
            x1={r.start}
            x2={Math.min(r.last + (step ?? 0), domain[1])}
            y1={0}
            y2={1}
            ifOverflow="hidden"
            shape={(p: ShapeProps) => <RunShape {...p} value={r.value} opacity={gradeOf(r.value)?.opacity ?? 0} />}
          />
        ))}
        <DayRules midnights={ticks.midnights} />
        <XAxis {...timeAxis(domain, ticks, { labels: false })} />
        <YAxis domain={[0, 1]} ticks={[]} width={AXIS_WIDTH} axisLine={false} tickLine={false} label={{ value: 'Index', position: 'insideRight', offset: 8, ...TICK }} />
        <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
        <Line dataKey="h" stroke="none" dot={false} activeDot={false} isAnimationActive={false} />
      </ComposedChart>
    </ChartFrame>
  )
}
