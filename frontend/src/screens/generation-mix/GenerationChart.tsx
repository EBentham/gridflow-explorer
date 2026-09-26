/**
 * Generation by fuel as a stack on the UK clock: positive bands above zero,
 * pumping and net exports stacked below it, a 1px surface gap between
 * bands. Selecting a fuel in the key draws it alone. On a multi-day window a
 * click picks a day, marked with the chartreuse highlight band. Missing
 * half-hours break the stack instead of being bridged.
 */
import { useMemo } from 'react'
import { Area, CartesianGrid, ComposedChart, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, DayRules, HighlightBand, SelectionEdges, TooltipBox, ZeroLine, type TipRow } from '../../design/charts'
import { CHART, CURSOR, GRID, bandProps, timeAxis, valueAxis } from '../../design/chartTheme'
import { fmt1, niceTicks } from '../../design/format'
import { FUEL_BANDS, fuelVar, totalGeneration, type MixRow } from '../../design/fuels'
import { isGap, withGaps, type GapRow } from '../../design/series'
import { axisClockCaption, halfHourWindow, londonMidnight, nextLondonMidnight, ukTimeTicks } from '../../design/time'

type ChartRow = MixRow | GapRow

interface TipProps {
  active?: boolean
  payload?: readonly { payload?: ChartRow }[]
}

interface ClickState {
  activeTooltipIndex?: number | string | null
}

const gwText = (v: number | null | undefined) => (v === null || v === undefined ? 'no value' : `${fmt1(v)} GW`)

export function GenerationChart({
  rows,
  domain,
  focus,
  day,
  onPickDay,
  height,
}: {
  rows: MixRow[]
  /** The window on the UK clock: its first midnight to the midnight after its last day. */
  domain: [number, number]
  focus?: string
  /** The picked day's midnight, highlighted on multi-day windows. */
  day?: number
  onPickDay?: (midnight: number) => void
  height?: number
}) {
  const chartRows = useMemo<ChartRow[]>(() => withGaps(rows), [rows])
  const ticks = useMemo(() => ukTimeTicks(domain[0], domain[1]), [domain])
  const bands = useMemo(() => (focus ? FUEL_BANDS.filter((b) => b.key === focus) : FUEL_BANDS), [focus])
  const multiDay = domain[1] - domain[0] > 30 * 3600e3
  const hasNegative = rows.some((r) => bands.some((b) => b.signed && (r[b.key] ?? 0) < 0))
  const scale = useMemo(() => {
    let lo = 0
    let hi = 0
    for (const r of rows) {
      let pos = 0
      let neg = 0
      for (const b of bands) {
        const v = r[b.key] ?? 0
        if (v >= 0) pos += v
        else neg += v
      }
      hi = Math.max(hi, pos)
      lo = Math.min(lo, neg)
    }
    return niceTicks(lo, hi)
  }, [rows, bands])

  const renderTip = ({ active, payload }: TipProps) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    if (isGap(row)) return <TooltipBox title={halfHourWindow(row.t)} rows={[]} note="Not held locally" />
    const tipRows: TipRow[] = [...bands].reverse().flatMap((b) => {
      const main: TipRow = { key: b.key, color: fuelVar(b.key), label: b.label, value: gwText(row[b.key]) }
      const subs =
        b.sources.length > 1
          ? b.sources
              .filter((s) => Math.abs(row[`src__${s.key}`] ?? 0) >= 0.05)
              .map((s) => ({ key: s.key, color: 'transparent', label: `  ${s.label}`, value: fmt1(row[`src__${s.key}`] ?? 0) }))
          : []
      return [main, ...subs]
    })
    if (!focus) tipRows.push({ key: 'total', color: 'transparent', label: 'Total generation', value: `${fmt1(totalGeneration(row))} GW`, strong: true })
    return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows} note={multiDay && onPickDay ? 'Click to select this day' : undefined} />
  }

  const pick = (s: ClickState | null | undefined) => {
    const i = Number(s?.activeTooltipIndex)
    const row = Number.isInteger(i) ? chartRows[i] : undefined
    if (onPickDay && row && !isGap(row)) onPickDay(londonMidnight(row.t))
  }

  const band = multiDay && day !== undefined ? ([Math.max(day, domain[0]), Math.min(nextLondonMidnight(day), domain[1])] as const) : null

  return (
    <ChartFrame height={height} caption={axisClockCaption(domain[0], domain[1])} pickable={Boolean(onPickDay && multiDay)}>
      <ComposedChart data={chartRows} margin={CHART.margin} onClick={pick}>
        <CartesianGrid {...GRID} />
        {band && <HighlightBand x1={band[0]} x2={band[1]} />}
        <DayRules midnights={ticks.midnights} />
        <XAxis {...timeAxis(domain, ticks)} />
        <YAxis {...valueAxis('GW', scale, { width: 40 })} />
        <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
        {hasNegative && <ZeroLine />}
        {bands.map((b) => (
          <Area key={b.key} dataKey={b.signed ? `${b.key}__pos` : b.key} stackId={focus ? undefined : 'pos'} {...bandProps(fuelVar(b.key), { focused: Boolean(focus) })} />
        ))}
        {bands
          .filter((b) => b.signed)
          .map((b) => (
            <Area key={`${b.key}-neg`} dataKey={`${b.key}__neg`} stackId={focus ? undefined : 'neg'} {...bandProps(fuelVar(b.key), { focused: Boolean(focus) })} />
          ))}
        {band && <SelectionEdges x1={band[0]} x2={band[1]} />}
      </ComposedChart>
    </ChartFrame>
  )
}
