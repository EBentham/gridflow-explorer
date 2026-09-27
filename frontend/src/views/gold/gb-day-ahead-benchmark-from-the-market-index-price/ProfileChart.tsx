/**
 * The benchmark by UK clock time: across the window's days, the range from
 * the lowest to the highest price held at each clock time as a band, the
 * mean as a line, and the picked day's own line over them. Composed only
 * from the shared theme (`design/chartTheme.ts`, `design/charts.tsx`). The
 * x axis is a clock time of day, not an instant, so the template's
 * `SeriesChart` can't draw it (see NEEDS.md). A clock time with nothing held
 * is a gap in every line.
 */
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, Extreme, TooltipBox, ZeroLine, type TipRow } from '../../../design/charts'
import { CHART, CURSOR, GRID, TICK, fanBandProps, lineProps, valueAxis } from '../../../design/chartTheme'
import { fmtN, niceTicks, stepDigits } from '../../../design/format'
import { dayTick } from '../../../design/time'
import type { SeriesDef } from '../../_template/seriesModel'
import { RANGE_OPACITY, slotText, type Slot } from './figures'

/** The same width as the main chart's value axis would take at this scale; the clocks differ, so it needn't match. */
const AXIS_WIDTH = 52

interface ProfileRow {
  minute: number
  mean: number | null
  range: [number, number] | null
  day: number | null
}

interface TipProps {
  active?: boolean
  label?: string | number
}

export function ProfileChart({
  slots,
  stepMin,
  price,
  dayColor,
  pickedLabel,
  bucketed,
  fixture,
}: {
  slots: Slot[]
  stepMin: number
  price: SeriesDef
  dayColor: string
  pickedLabel: string | null
  bucketed: boolean
  fixture: boolean
}) {
  const rows: ProfileRow[] = slots.map((s) => ({
    minute: s.minute,
    mean: s.mean,
    range: s.low && s.high ? [s.low.v, s.high.v] : null,
    day: s.day,
  }))
  const bySlot = new Map(slots.map((s) => [s.minute, s]))
  let lo = Infinity
  let hi = -Infinity
  for (const s of slots) {
    if (s.low) lo = Math.min(lo, s.low.v)
    if (s.high) hi = Math.max(hi, s.high.v)
  }
  const scale = Number.isFinite(lo) ? niceTicks(lo, hi) : niceTicks(0, 1)
  const digits = stepDigits(scale.ticks[1] - scale.ticks[0])
  const held = slots.filter((s) => s.mean !== null)
  const peak = held.reduce<Slot | null>((a, s) => (a === null || (s.mean ?? 0) > (a.mean ?? 0) ? s : a), null)
  const trough = held.reduce<Slot | null>((a, s) => (a === null || (s.mean ?? 0) < (a.mean ?? 0) ? s : a), null)
  const anchor = (m: number) => (m / 1440 > 0.6 ? 'end' : 'start')
  const noun = bucketed ? 'means' : 'values'

  const renderTip = ({ active, label }: TipProps) => {
    const s = typeof label === 'number' ? bySlot.get(label) : undefined
    if (!active || !s) return null
    const tip: TipRow[] = []
    if (s.mean !== null) tip.push({ key: 'mean', color: price.color, label: 'Mean', value: price.unit.format(s.mean) })
    if (s.high) tip.push({ key: 'high', color: 'var(--chart-fan)', label: `Highest, ${dayTick(s.high.t)}`, value: price.unit.format(s.high.v) })
    if (s.low) tip.push({ key: 'low', color: 'var(--chart-fan)', label: `Lowest, ${dayTick(s.low.t)}`, value: price.unit.format(s.low.v) })
    if (pickedLabel) tip.push({ key: 'day', color: dayColor, label: pickedLabel, value: s.day === null ? 'no value' : price.unit.format(s.day) })
    const note = s.n ? `Of ${s.n} ${s.n === 1 ? noun.slice(0, -1) : noun} held at this time` : 'Nothing held at this time'
    return <TooltipBox title={`${slotText(s.minute, stepMin)}, UK clock`} rows={tip} note={note} />
  }

  return (
    <ChartFrame height={250} caption="UK clock time of day">
      <ComposedChart data={rows} margin={CHART.margin}>
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey="minute"
          type="number"
          domain={[0, 1440 - stepMin]}
          ticks={[0, 180, 360, 540, 720, 900, 1080, 1260]}
          tickFormatter={(m: number) => slotText(m, stepMin).slice(0, 5)}
          tick={TICK}
          stroke="var(--chart-axis)"
          tickLine={false}
          height={24}
        />
        <YAxis {...valueAxis(price.unit.caption, scale, { width: AXIS_WIDTH, format: (v) => fmtN(v, digits) })} />
        <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
        {scale.domain[0] < 0 && <ZeroLine />}
        <Area dataKey="range" {...fanBandProps(RANGE_OPACITY)} />
        <Line dataKey="mean" {...lineProps(price.color, { fixture })} />
        {pickedLabel && <Line dataKey="day" {...lineProps(dayColor, { fixture })} />}
        {peak && peak.mean !== null && (
          <Extreme x={peak.minute} y={peak.mean} anchor={anchor(peak.minute)} color={price.color} text={`Mean ${price.unit.format(peak.mean)}, highest, ${slotText(peak.minute, stepMin)}`} />
        )}
        {trough && trough.mean !== null && trough !== peak && (
          <Extreme x={trough.minute} y={trough.mean} anchor={anchor(trough.minute)} below color={price.color} text={`Mean ${price.unit.format(trough.mean)}, lowest, ${slotText(trough.minute, stepMin)}`} />
        )}
      </ComposedChart>
    </ChartFrame>
  )
}
