/**
 * The zones by UK clock time: each zone's mean price at each clock time of
 * its own clock across the window's days, as a line. With one zone selected,
 * the band from its lowest to its highest price at each clock time, and the
 * picked day's own line, over it. Composed only from the shared theme
 * (`design/chartTheme.ts`, `design/charts.tsx`); the x axis is a clock time
 * of day, not an instant, so the template's `SeriesChart` can't draw it (see
 * NEEDS.md). An hourly zone among quarter-hourly ones is drawn straight
 * between its own hourly points, the segment a line draws anyway; its
 * tooltip reads its own hour. A clock time with nothing held is a gap.
 */
import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, Extreme, TooltipBox, ZeroLine, type TipRow } from '../../../design/charts'
import { CHART, CURSOR, GRID, TICK, fanBandProps, lineProps, valueAxis } from '../../../design/chartTheme'
import { fmtN, niceTicks, stepDigits } from '../../../design/format'
import { dayTick } from '../../../design/time'
import type { DisplayUnit } from '../../_template/units'
import { AXIS_WIDTH, RANGE_OPACITY, slotText, type Slot } from './figures'

export interface ProfileLine {
  key: string
  label: string
  color: string
  /** Its own clock's step, minutes. */
  stepMin: number
  slots: Slot[]
}

interface ProfileRow {
  minute: number
  range?: [number, number] | null
  day?: number | null
  [field: string]: number | null | [number, number] | undefined
}

interface TipProps {
  active?: boolean
  label?: string | number
}

const drawKey = (i: number) => `z${i}`

/** A line's value to draw at `minute`: its own slot's mean there, else straight between its two neighbouring held slots. */
function drawValue(line: ProfileLine, byMinute: Map<number, Slot>, minute: number): number | null {
  const own = byMinute.get(minute)
  if (own) return own.mean
  const before = minute - (minute % line.stepMin)
  const after = before + line.stepMin
  const a = byMinute.get(before)?.mean
  const b = byMinute.get(after)?.mean
  if (typeof a !== 'number' || typeof b !== 'number') return null
  return a + ((b - a) * (minute - before)) / line.stepMin
}

export function ProfileChart({
  lines,
  band,
  day,
  unit,
  bucketed,
  fixture,
}: {
  lines: ProfileLine[]
  /** The selected zone's lowest-to-highest band, drawn under its line. */
  band: boolean
  /** The picked day's line over the selected zone, with its label. */
  day: { label: string; color: string } | null
  unit: DisplayUnit
  bucketed: boolean
  fixture: boolean
}) {
  const finest = Math.min(...lines.map((l) => l.stepMin))
  const slotMaps = lines.map((l) => new Map(l.slots.map((s) => [s.minute, s])))
  const focus = lines.length === 1 ? lines[0] : null
  const focusSlots = focus ? slotMaps[0] : null
  const rows: ProfileRow[] = []
  for (let m = 0; m < 1440; m += finest) {
    const row: ProfileRow = { minute: m }
    lines.forEach((l, i) => {
      row[drawKey(i)] = drawValue(l, slotMaps[i], m)
    })
    if (focusSlots) {
      const s = focusSlots.get(m)
      if (band) row.range = s?.low && s.high ? [s.low.v, s.high.v] : null
      if (day) row.day = s?.day ?? null
    }
    rows.push(row)
  }

  let lo = Infinity
  let hi = -Infinity
  for (const [i, l] of lines.entries()) {
    for (const s of l.slots) {
      const values = [s.mean, ...(band && i === 0 && focus ? [s.low?.v ?? null, s.high?.v ?? null] : []), ...(day && focus ? [s.day] : [])]
      for (const v of values) {
        if (typeof v !== 'number') continue
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
      }
    }
  }
  const scale = Number.isFinite(lo) ? niceTicks(lo, hi) : niceTicks(0, 1)
  const digits = stepDigits(scale.ticks[1] - scale.ticks[0])
  const heldSlots = focus ? focus.slots.filter((s) => s.mean !== null) : []
  const peak = heldSlots.reduce<Slot | null>((a, s) => (a === null || (s.mean ?? 0) > (a.mean ?? 0) ? s : a), null)
  const trough = heldSlots.reduce<Slot | null>((a, s) => (a === null || (s.mean ?? 0) < (a.mean ?? 0) ? s : a), null)
  const anchor = (m: number) => (m / 1440 > 0.6 ? 'end' : 'start')
  const noun = bucketed ? 'means' : 'values'

  const renderTip = ({ active, label }: TipProps) => {
    if (!active || typeof label !== 'number') return null
    const tip: TipRow[] = []
    let note: string | undefined
    lines.forEach((l, i) => {
      const start = label - (label % l.stepMin)
      const s = slotMaps[i].get(start)
      const own = l.stepMin > finest ? `, ${slotText(start, l.stepMin)}` : ''
      tip.push({ key: l.key, color: l.color, label: `${l.label}${own}`, value: s && s.mean !== null ? unit.format(s.mean) : 'none held', dashed: fixture })
      if (focus && s) {
        if (s.high) tip.push({ key: 'high', color: 'var(--chart-fan)', label: `Highest, ${dayTick(s.high.t)}`, value: unit.format(s.high.v) })
        if (s.low) tip.push({ key: 'low', color: 'var(--chart-fan)', label: `Lowest, ${dayTick(s.low.t)}`, value: unit.format(s.low.v) })
        if (day) tip.push({ key: 'day', color: day.color, label: day.label, value: s.day === null ? 'no value' : unit.format(s.day) })
        note = s.n ? `Of ${s.n} ${s.n === 1 ? noun.slice(0, -1) : noun} held at this time` : 'Nothing held at this time'
      }
    })
    return <TooltipBox title={`${slotText(label - (label % finest), finest)}, UK clock`} rows={tip} note={note} />
  }

  return (
    <ChartFrame height={260} caption="UK clock time of day">
      <ComposedChart data={rows} margin={CHART.margin}>
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey="minute"
          type="number"
          domain={[0, 1440 - finest]}
          ticks={[0, 180, 360, 540, 720, 900, 1080, 1260]}
          tickFormatter={(m: number) => slotText(m, finest).slice(0, 5)}
          tick={TICK}
          stroke="var(--chart-axis)"
          tickLine={false}
          height={24}
        />
        <YAxis {...valueAxis(unit.caption, scale, { width: AXIS_WIDTH, format: (v) => fmtN(v, digits) })} />
        <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
        {scale.domain[0] < 0 && <ZeroLine />}
        {focus && band && <Area dataKey="range" {...fanBandProps(RANGE_OPACITY)} />}
        {lines.map((l, i) => (
          <Line key={l.key} dataKey={drawKey(i)} {...lineProps(l.color, { fixture })} />
        ))}
        {focus && day && <Line dataKey="day" {...lineProps(day.color, { fixture })} />}
        {focus && peak && peak.mean !== null && (
          <Extreme x={peak.minute} y={peak.mean} anchor={anchor(peak.minute)} color={focus.color} text={`Mean ${unit.format(peak.mean)}, highest, ${slotText(peak.minute, focus.stepMin)}`} />
        )}
        {focus && trough && trough.mean !== null && trough !== peak && (
          <Extreme x={trough.minute} y={trough.mean} anchor={anchor(trough.minute)} below color={focus.color} text={`Mean ${unit.format(trough.mean)}, lowest, ${slotText(trough.minute, focus.stepMin)}`} />
        )}
      </ComposedChart>
    </ChartFrame>
  )
}
