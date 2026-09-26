/**
 * Events per period as a strip of bars on the UK clock, above an events
 * table: an hour per bar over a day or two, a day per bar beyond. A period
 * with no event held has no bar; its tooltip says so rather than claiming a
 * zero the feed may simply not have delivered.
 */
import { useMemo } from 'react'
import { Bar, CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, DayRules, TooltipBox } from '../../design/charts'
import { CHART, CURSOR, GRID, timeAxis, valueAxis } from '../../design/chartTheme'
import { fmt0, niceTicks, plural } from '../../design/format'
import { DAY_MS, HOUR_MS, axisClockCaption, londonMidnight, nextLondonMidnight, periodLabel, ukTimeTicks, windowDomain } from '../../design/time'
import type { DateRange } from '../../lib/range'

interface StripRow {
  /** Where the bar sits: the middle of its period. */
  t: number
  start: number
  n: number
}

interface TipProps {
  active?: boolean
  payload?: readonly { payload?: StripRow }[]
}

export function CountStrip({ times, window, per, noun = 'events' }: { times: number[]; window: DateRange; per: 'hour' | 'day'; noun?: string }) {
  const domain = useMemo(() => windowDomain(window.start, window.end), [window])
  const ticks = useMemo(() => ukTimeTicks(domain[0], domain[1]), [domain])
  const rows = useMemo<StripRow[]>(() => {
    const counts = new Map<number, number>()
    for (const t of times) {
      const start = per === 'day' ? londonMidnight(t) : Math.floor(t / HOUR_MS) * HOUR_MS
      counts.set(start, (counts.get(start) ?? 0) + 1)
    }
    const out: StripRow[] = []
    for (let s = domain[0]; s < domain[1]; s = per === 'day' ? nextLondonMidnight(s) : s + HOUR_MS) {
      const end = per === 'day' ? nextLondonMidnight(s) : s + HOUR_MS
      out.push({ t: (s + end) / 2, start: s, n: counts.get(s) ?? 0 })
    }
    return out
  }, [times, per, domain])
  const scale = niceTicks(0, Math.max(1, ...rows.map((r) => r.n)), 3)
  const unit = `${noun} per ${per}`

  const renderTip = ({ active, payload }: TipProps) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    return <TooltipBox title={periodLabel(row.start, per === 'day' ? DAY_MS : HOUR_MS)} rows={[]} note={row.n ? plural(row.n, noun.replace(/s$/, ''), noun) : `No ${noun} held`} />
  }

  return (
    <ChartFrame height={118} caption={axisClockCaption(domain[0], domain[1])}>
      <ComposedChart data={rows} margin={{ ...CHART.margin, top: 22 }} barCategoryGap="18%">
        <CartesianGrid {...GRID} />
        <DayRules midnights={ticks.midnights} />
        <XAxis {...timeAxis(domain, ticks)} />
        <YAxis {...valueAxis(unit, scale, { width: 36, format: fmt0 })} allowDecimals={false} />
        <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
        <Bar dataKey="n" fill="var(--kind-events)" isAnimationActive={false} maxBarSize={40} />
      </ComposedChart>
    </ChartFrame>
  )
}
