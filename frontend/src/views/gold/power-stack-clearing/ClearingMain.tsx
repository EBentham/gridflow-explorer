/**
 * The clearing view's main panel. Chart: the modelled clearing price and the
 * market index price on one £/MWh axis, the half-hours where the model's
 * price floor set its price banded; under them, on the same clock, the
 * clearing demand as one bar per half-hour, coloured by the fuel of the unit
 * whose cost set the price. Table: every half-hour of the window, with what
 * set its price. Values are the rows as held: a half-hour not held is a gap
 * in the lines, no bar, and a dash in the table.
 */
import { useMemo } from 'react'
import { Bar, CartesianGrid, Cell, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, DayRules, HighlightBand, SelectionEdges, TooltipBox, ZeroLine, type TipRow } from '../../../design/charts'
import { CHART, CURSOR, GRID, lineProps, timeAxis, valueAxis } from '../../../design/chartTheme'
import { fmt0, fmt1, fmtN, money, niceTicks, stepDigits } from '../../../design/format'
import { axisClockCaption, londonMidnight, nextLondonMidnight, periodLabel, stepNoun, ukTimeTicks, windowDomain } from '../../../design/time'
import { periodName } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import {
  AXIS_WIDTH,
  MARKET_COLOR,
  MODEL_COLOR,
  clearingPoints,
  floorRuns,
  fuelWords,
  gapOf,
  ownRows,
  priceScale,
  relatedRows,
  setterOf,
  type ClearingPoint,
} from './figures'

const PRICE_H = 270
const DEMAND_H = 150
const SYNC = 'gf-stack-clearing'
/** A bar whose setter isn't held (a mean over several half-hours names none). */
const UNKNOWN_FILL = 'var(--chart-grid-strong)'

interface ChartRow {
  t: number
  model: number | null
  market: number | null
  /** GW, display only. */
  demand: number | null
  fill: string
}

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: readonly { payload?: ChartRow }[]
}

interface ClickState {
  activeTooltipIndex?: number | string | null
}

const priceText = (v: number | null) => (v === null ? 'no value' : `${money(v, 2)}/MWh`)
const gwText = (v: number | null) => (v === null ? 'no value' : `${fmt1(v / 1000)} GW`)
const dash = <span className="gf-cell-missing">–</span>

function ClearingChart({ ctx, points }: { ctx: PageContext; points: ClearingPoint[] }) {
  const model = ctx.series
  const window = ctx.window
  const stepMs = model?.stepMs ?? null
  const full = ctx.param('scale') === 'full'
  const start = window?.start ?? ''
  const end = window?.end ?? ''
  const domain = useMemo(() => windowDomain(start, end), [start, end])
  const ticks = useMemo(() => ukTimeTicks(domain[0], domain[1]), [domain])
  const { scale, clipped } = useMemo(() => priceScale(points, full), [points, full])
  const demandScale = useMemo(() => {
    const values = points.map((p) => p.demand).filter((v): v is number => v !== null)
    // A short panel: about 3 ticks, every one shown, as the template's short panels do, so zero is never thinned away.
    return niceTicks(Math.min(0, ...values) / 1000, Math.max(0, ...values) / 1000, 3)
  }, [points])
  const runs = useMemo(() => floorRuns(points, stepMs), [points, stepMs])
  const rows = useMemo<ChartRow[]>(
    () =>
      points.map((p) => ({
        t: p.t,
        model: p.model,
        market: p.market,
        demand: p.demand === null ? null : p.demand / 1000,
        fill: setterOf(p)?.style.color ?? UNKNOWN_FILL,
      })),
    [points],
  )
  const byT = useMemo(() => new Map(points.map((p) => [p.t, p])), [points])
  if (!model || !window) return null

  const priceDigits = stepDigits(scale.ticks[1] - scale.ticks[0])
  const demandDigits = stepDigits(demandScale.ticks[1] - demandScale.ticks[0])
  const multiDay = domain[1] - domain[0] > 30 * 3600e3
  const picked = ctx.picked
  const band = multiDay && picked !== undefined ? ([Math.max(picked, domain[0]), Math.min(nextLondonMidnight(picked), domain[1])] as const) : null
  const floorBands = runs.map((r) => <HighlightBand key={r.start} x1={r.start} x2={Math.min(r.last + (stepMs ?? 0), domain[1])} />)

  const renderTip = ({ active, label, payload }: TipProps) => {
    const t = typeof label === 'number' ? label : payload?.[0]?.payload?.t
    if (!active || t === undefined) return null
    const title = periodName(t, stepMs, model.settlement)
    const p = byT.get(t)
    if (!p || (p.model === null && p.market === null && p.demand === null)) return <TooltipBox title={title} rows={[]} note="Not held locally" />
    const setter = setterOf(p)
    const gap = gapOf(p)
    const tip: TipRow[] = [
      { key: 'market', color: MARKET_COLOR, label: 'Market index price', value: priceText(p.market) },
      { key: 'model', color: MODEL_COLOR, label: p.atFloor === true ? 'Modelled price, at the floor' : 'Modelled price', value: priceText(p.model) },
    ]
    if (gap !== null) tip.push({ key: 'gap', color: 'transparent', label: 'Modelled minus market', value: priceText(gap) })
    tip.push({ key: 'demand', color: setter?.style.color ?? UNKNOWN_FILL, label: 'Clearing demand', value: gwText(p.demand) })
    if (p.capacity !== null) tip.push({ key: 'capacity', color: 'transparent', label: 'Capacity in the stack', value: gwText(p.capacity) })
    const who =
      p.atFloor === true
        ? 'No unit set the price: the floor did.'
        : p.unit
          ? `Set by ${p.unit}, a ${fuelWords(p.fuel)} unit.`
          : setter
            ? `Set by a ${fuelWords(p.fuel)} unit.`
            : model.bucketed
              ? 'A mean over the period, which names no unit.'
              : null
    const note = [who, multiDay ? 'Click to select this day.' : null].filter(Boolean).join(' ')
    return <TooltipBox title={title} rows={tip} note={note || undefined} />
  }

  const pick = (s: ClickState | null | undefined) => {
    const i = Number(s?.activeTooltipIndex)
    const row = Number.isInteger(i) ? rows[i] : undefined
    if (multiDay && row) ctx.pick(londonMidnight(row.t))
  }

  return (
    <div className="gf-chart-stack">
      <ChartFrame height={PRICE_H} pickable={multiDay}>
        <ComposedChart data={rows} margin={{ ...CHART.margin, bottom: 8 }} onClick={pick} syncId={SYNC} syncMethod="value">
          <CartesianGrid {...GRID} />
          {floorBands}
          {band && <HighlightBand x1={band[0]} x2={band[1]} />}
          <DayRules midnights={ticks.midnights} />
          <XAxis {...timeAxis(domain, ticks, { labels: false })} />
          <YAxis {...valueAxis('£/MWh', scale, { width: AXIS_WIDTH, format: (v) => fmtN(v, priceDigits) })} allowDataOverflow={clipped} />
          <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
          {scale.domain[0] < 0 && <ZeroLine />}
          <Line dataKey="market" {...lineProps(MARKET_COLOR, { fixture: ctx.fixture })} />
          <Line dataKey="model" {...lineProps(MODEL_COLOR, { fixture: ctx.fixture })} />
          {band && <SelectionEdges x1={band[0]} x2={band[1]} />}
        </ComposedChart>
      </ChartFrame>
      <ChartFrame height={DEMAND_H} caption={axisClockCaption(domain[0], domain[1])} pickable={multiDay}>
        <ComposedChart data={rows} margin={{ ...CHART.margin, top: 22 }} onClick={pick} syncId={SYNC} syncMethod="value" barCategoryGap={0}>
          <CartesianGrid {...GRID} />
          {floorBands}
          {band && <HighlightBand x1={band[0]} x2={band[1]} />}
          <DayRules midnights={ticks.midnights} />
          <XAxis {...timeAxis(domain, ticks)} />
          <YAxis {...valueAxis('Clearing demand, GW', demandScale, { width: AXIS_WIDTH, format: (v) => fmtN(v, demandDigits) })} interval={0} />
          <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
          {demandScale.domain[0] < 0 && <ZeroLine />}
          <Bar dataKey="demand" isAnimationActive={false} maxBarSize={14}>
            {rows.map((r) => (
              <Cell key={r.t} fill={r.fill} />
            ))}
          </Bar>
          {band && <SelectionEdges x1={band[0]} x2={band[1]} />}
        </ComposedChart>
      </ChartFrame>
    </div>
  )
}

function ClearingTable({ ctx, points }: { ctx: PageContext; points: ClearingPoint[] }) {
  const model = ctx.series
  if (!model) return null
  const settlement = model.settlement
  const money2 = (v: number | null) => (v === null ? dash : fmtN(v, 2))
  const mw = (v: number | null) => (v === null ? dash : fmt0(v))
  const columns: TableCol<ClearingPoint>[] = [
    { key: 't', label: model.bucketed ? 'Period (means)' : 'Period', render: (p) => periodLabel(p.t, model.stepMs), sortValue: (p) => p.t },
    ...(settlement
      ? [
          { key: 'sd', label: 'Settlement date', render: (p: ClearingPoint) => settlement.get(p.t)?.date ?? dash, sortValue: (p: ClearingPoint) => settlement.get(p.t)?.date ?? null },
          { key: 'sp', label: 'SP', num: true, render: (p: ClearingPoint) => settlement.get(p.t)?.period ?? dash, sortValue: (p: ClearingPoint) => settlement.get(p.t)?.period ?? null },
        ]
      : []),
    { key: 'model', label: 'Modelled, £/MWh', num: true, render: (p) => money2(p.model), sortValue: (p) => p.model },
    { key: 'market', label: 'Market index, £/MWh', num: true, render: (p) => money2(p.market), sortValue: (p) => p.market },
    { key: 'gap', label: 'Modelled − market, £/MWh', num: true, render: (p) => money2(gapOf(p)), sortValue: gapOf },
    { key: 'set', label: 'Set by', render: (p) => setterOf(p)?.style.label ?? dash, sortValue: (p) => setterOf(p)?.style.label ?? null },
    { key: 'unit', label: 'Marginal unit', render: (p) => (p.unit ? <code>{p.unit}</code> : dash), sortValue: (p) => p.unit },
    { key: 'demand', label: 'Clearing demand, MW', num: true, render: (p) => mw(p.demand), sortValue: (p) => p.demand },
    { key: 'capacity', label: 'Capacity, MW', num: true, render: (p) => mw(p.capacity), sortValue: (p) => p.capacity },
    { key: 'floor', label: 'Floor, £/MWh', num: true, render: (p) => money2(p.floor), sortValue: (p) => p.floor },
  ]
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  // The caption spans the table, wider than its box: kept short so it shows whole; the rest goes under.
  const caption = `${points.length.toLocaleString('en-GB')} ${noun}, oldest first, with the market index price at the same time. Select a column heading to sort.`
  return (
    <>
      <WindowedTable columns={columns} rows={points} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(p) => p.t} />
      <p className="gf-hint">Set by names the fuel of the unit whose cost set the price, or the floor where no unit did. Capacity is the priced capacity in the stack.</p>
    </>
  )
}

export function ClearingMain({ ctx }: { ctx: PageContext }) {
  const rows = ownRows(ctx)
  const market = relatedRows(ctx, 'market')
  const points = useMemo(() => clearingPoints(rows, market), [rows, market])
  if (!ctx.window || !ctx.series) return null
  return ctx.mode === 'table' ? <ClearingTable ctx={ctx} points={points} /> : <ClearingChart ctx={ctx} points={points} />
}
