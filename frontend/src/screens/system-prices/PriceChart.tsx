/**
 * The imbalance price per half-hour with net imbalance volume in a bar panel
 * below it, on one shared UK clock. Negative-price runs get the chartreuse
 * highlight band; the window's highest and lowest prices are labelled.
 * Missing half-hours break the line instead of being bridged.
 */
import { useMemo } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, DayRules, Extreme, HighlightBand, TooltipBox, ZeroLine, type TipRow } from '../../design/charts'
import { CHART, CURSOR, GRID, extremeAnchor, lineProps, timeAxis, valueAxis } from '../../design/chartTheme'
import { fmt0, money, niceTicks } from '../../design/format'
import { isGap, withGaps, type GapRow } from '../../design/series'
import { HALF_HOUR, axisClockCaption, clock, dayTick, halfHourWindow, ukTimeTicks } from '../../design/time'
import { isDualPriced, negativeRuns, type PriceRow } from './prices'

type ChartRow = PriceRow | GapRow

interface TipProps {
  active?: boolean
  payload?: readonly { payload?: ChartRow }[]
}

const nivColor = (niv: number) => (niv >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)')
const priceText = (v: number | null) => (v === null ? 'no value' : `${money(v, 2)}/MWh`)

export function PriceChart({ rows, domain, height, nivHeight }: { rows: PriceRow[]; domain: [number, number]; height?: number; nivHeight?: number }) {
  const chartRows = useMemo<ChartRow[]>(() => withGaps(rows), [rows])
  const ticks = useMemo(() => ukTimeTicks(domain[0], domain[1]), [domain])
  const runs = useMemo(() => negativeRuns(rows), [rows])
  const dual = useMemo(() => isDualPriced(rows), [rows])
  const { lo, hi, yp, yn } = useMemo(() => {
    const priced = rows.filter((r): r is PriceRow & { price: number } => r.price !== null)
    const low = priced.reduce<(typeof priced)[number] | null>((m, r) => (!m || r.price < m.price ? r : m), null)
    const high = priced.reduce<(typeof priced)[number] | null>((m, r) => (!m || r.price > m.price ? r : m), null)
    const values = rows.flatMap((r) => [r.sell, r.buy]).filter((v): v is number => v !== null)
    const nivs = rows.map((r) => r.niv).filter((v): v is number => v !== null)
    return {
      lo: low,
      hi: high,
      yp: niceTicks(Math.min(0, ...values), Math.max(...values)),
      yn: niceTicks(Math.min(0, ...nivs), Math.max(0, ...nivs), 3),
    }
  }, [rows])

  const renderTip = ({ active, payload }: TipProps) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    if (isGap(row)) return <TooltipBox title={halfHourWindow(row.t)} rows={[]} note="Not held locally" />
    const tipRows: TipRow[] = dual
      ? [
          { key: 's', color: 'var(--chart-price)', label: 'Sell price', value: priceText(row.sell) },
          { key: 'b', color: 'var(--chart-price-2)', label: 'Buy price', value: priceText(row.buy) },
        ]
      : [{ key: 'p', color: 'var(--chart-price)', label: 'System price', value: priceText(row.price) }]
    if (row.niv !== null) {
      tipRows.push({ key: 'n', color: nivColor(row.niv), label: row.niv >= 0 ? 'NIV, system short' : 'NIV, system long', value: `${fmt0(row.niv)} MWh` })
    }
    return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows} note={dual ? undefined : 'Single imbalance price: sell = buy'} />
  }

  const bands = runs.map((r) => <HighlightBand key={r.start} x1={r.start} x2={Math.min(r.last + HALF_HOUR, domain[1])} />)
  const baseHeight = height ?? CHART.height * 0.7

  return (
    <div className="gf-chart-stack">
      <ChartFrame height={baseHeight}>
        <ComposedChart data={chartRows} margin={CHART.margin} syncId="gf-prices">
          <CartesianGrid {...GRID} />
          {bands}
          <DayRules midnights={ticks.midnights} />
          <XAxis {...timeAxis(domain, ticks, { labels: false })} />
          <YAxis {...valueAxis('£/MWh', yp, { width: 48 })} />
          <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
          <ZeroLine />
          <Line dataKey={dual ? 'sell' : 'price'} {...lineProps('var(--chart-price)')} />
          {dual && <Line dataKey="buy" {...lineProps('var(--chart-price-2)')} />}
          {hi && (
            <Extreme x={hi.t} y={hi.price} anchor={extremeAnchor(hi.t, domain)} text={`${money(hi.price, 2)}/MWh, highest, ${dayTick(hi.t)} at ${clock(hi.t)}`} />
          )}
          {lo && lo !== hi && (
            <Extreme x={lo.t} y={lo.price} anchor={extremeAnchor(lo.t, domain)} below text={`${money(lo.price, 2)}/MWh, lowest, ${dayTick(lo.t)} at ${clock(lo.t)}`} />
          )}
        </ComposedChart>
      </ChartFrame>
      <ChartFrame height={nivHeight ?? CHART.height * 0.34} caption={axisClockCaption(domain[0], domain[1])}>
        <ComposedChart data={chartRows} margin={{ ...CHART.margin, top: 22 }} syncId="gf-prices" barCategoryGap={0}>
          <CartesianGrid {...GRID} />
          {bands}
          <DayRules midnights={ticks.midnights} />
          <XAxis {...timeAxis(domain, ticks)} />
          <YAxis {...valueAxis('NIV, MWh', yn, { width: 48 })} />
          <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
          <ZeroLine />
          <Bar dataKey="niv" isAnimationActive={false} maxBarSize={6}>
            {chartRows.map((r) => (
              <Cell key={r.t} fill={isGap(r) || r.niv === null ? 'none' : nivColor(r.niv)} />
            ))}
          </Bar>
        </ComposedChart>
      </ChartFrame>
    </div>
  )
}
