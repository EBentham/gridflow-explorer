/**
 * The supply curve view's main panel. Chart: the modelled stack at one
 * half-hour as a merit order, each unit a block as wide as its available
 * capacity and as tall as its modelled cost, placed by the capacity held
 * through the merit order and coloured by fuel; the clearing demand read
 * across to where the stack clears, and the market index price at the same
 * half-hour. Table: the template's table of every row the window holds.
 *
 * The x axis is capacity, not time, so this chart is composed here from the
 * shared theme's pieces rather than drawn by `SeriesChart` (NEEDS.md).
 */
import { Fragment, useMemo } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, Extreme, TooltipBox, ZeroLine } from '../../../design/charts'
import { CHART, CURSOR, GRID, TICK, extremeAnchor, valueAxis } from '../../../design/chartTheme'
import { fmt0, fmt1, fmtN, money, niceTicks, plural, stepDigits } from '../../../design/format'
import { SeriesBody } from '../../_template/SeriesBody'
import { ErrorWords } from '../../_template/panels'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import {
  AXIS_WIDTH,
  MARKET_COLOR,
  MODEL_COLOR,
  chosenTime,
  clearingAt,
  curveAt,
  curveTimes,
  fuelStyle,
  marketAt,
  missingUnits,
  ownRows,
  unitAtDemand,
  type ClearingPoint,
  type CurveUnit,
} from './figures'

const CURVE_H = 400
/** A block narrower than this share of the axis (about 4 px) is drawn without its surface-coloured edge. */
const THIN = 0.006

interface Block extends CurveUnit {
  /** GW, display only: where the unit's capacity starts and ends through the merit order, and its middle. */
  x0: number
  x1: number
  mid: number
  color: string
  fuelLabel: string
}

interface TipProps {
  active?: boolean
  payload?: readonly { payload?: Block }[]
}

/** Unit ids as identifiers: `a`, `a and b`, `a, b and c`. */
function Ids({ ids }: { ids: string[] }) {
  return ids.map((id, i) => (
    <Fragment key={id}>
      {i > 0 && (i === ids.length - 1 ? ' and ' : ', ')}
      <code>{id}</code>
    </Fragment>
  ))
}

/**
 * A reference line's label at its left-hand end, set like an extreme's (the
 * theme's `gf-extreme`): the cheap end of the stack is low, so the label
 * clears the blocks at any market price above them.
 */
function LineLabel({ viewBox, text }: { viewBox?: { x?: number; y?: number; width?: number }; text: string }) {
  const x = (viewBox?.x ?? 0) + 6
  const y = (viewBox?.y ?? 0) - 7
  return (
    <text x={x} y={y} textAnchor="start" className="gf-extreme" paintOrder="stroke" stroke="var(--chart-surface)" strokeWidth={4} strokeLinejoin="round">
      {text}
    </text>
  )
}

function CurveChart({ units, clearing, market }: { units: CurveUnit[]; clearing: ClearingPoint | null; market: number | null }) {
  const blocks = useMemo<Block[]>(
    () =>
      units.map((u) => {
        const style = fuelStyle(u.fuel)
        return { ...u, x0: (u.cumulative - u.available) / 1000, x1: u.cumulative / 1000, mid: (u.cumulative - u.available / 2) / 1000, color: style.color, fuelLabel: style.label }
      }),
    [units],
  )
  const demand = clearing?.demand ?? null
  const demandGw = demand === null ? null : demand / 1000
  // The stack's own price where a unit set it; at the floor the price is the floor's, far below the stack.
  const price = clearing && clearing.atFloor === false ? clearing.model : null
  // More ticks than a value axis: a clearing demand below zero then costs one step of room, not a fifth of the chart.
  const xs = useMemo(() => niceTicks(Math.min(0, demandGw ?? 0, ...blocks.map((b) => b.x0)), Math.max(demandGw ?? 0, ...blocks.map((b) => b.x1)), 8), [blocks, demandGw])
  const ys = useMemo(() => {
    const values = [...blocks.map((b) => b.cost), ...(market !== null ? [market] : []), ...(price !== null ? [price] : [])]
    return niceTicks(Math.min(0, ...values), Math.max(0, ...values))
  }, [blocks, market, price])
  const span = Math.max(xs.domain[1] - xs.domain[0], 1e-9)
  const xDigits = stepDigits(xs.ticks[1] - xs.ticks[0])
  const yDigits = stepDigits(ys.ticks[1] - ys.ticks[0])

  const renderTip = ({ active, payload }: TipProps) => {
    const b = payload?.[0]?.payload
    if (!active || !b) return null
    return (
      <TooltipBox
        title={`${b.unit}, rank ${b.rank}`}
        rows={[
          { key: 'cost', color: b.color, label: `${b.fuelLabel}, marginal cost`, value: `${money(b.cost, 2)}/MWh` },
          { key: 'available', color: 'transparent', label: 'Available capacity', value: `${fmt0(b.available)} MW` },
          { key: 'through', color: 'transparent', label: 'Through the merit order', value: `${fmt1(b.x1)} GW` },
        ]}
      />
    )
  }

  return (
    <ChartFrame height={CURVE_H} caption="Available capacity through the merit order, GW">
      <ComposedChart data={blocks} margin={CHART.margin}>
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey="mid"
          type="number"
          domain={xs.domain}
          ticks={xs.ticks}
          tickFormatter={(v: number) => fmtN(v, xDigits)}
          tick={TICK}
          stroke="var(--chart-axis)"
          tickLine={false}
          height={24}
          allowDataOverflow
        />
        <YAxis {...valueAxis('£/MWh', ys, { width: AXIS_WIDTH, format: (v) => fmtN(v, yDigits) })} />
        <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
        {blocks.map((b) => (
          <ReferenceArea
            key={`${b.rank}:${b.unit}`}
            x1={b.x0}
            x2={b.x1}
            y1={Math.min(0, b.cost)}
            y2={Math.max(0, b.cost)}
            fill={b.color}
            fillOpacity={CHART.areaOpacity}
            // A unit a few pixels wide would be all gap and no fill: only wider blocks are set apart.
            stroke={(b.x1 - b.x0) / span < THIN ? 'none' : 'var(--chart-surface)'}
            strokeWidth={CHART.gap}
            ifOverflow="hidden"
          />
        ))}
        {ys.domain[0] < 0 && <ZeroLine />}
        {market !== null && (
          <ReferenceLine y={market} stroke={MARKET_COLOR} strokeWidth={CHART.line} ifOverflow="hidden" label={<LineLabel text={`Market index ${money(market, 2)}/MWh`} />} />
        )}
        {demandGw !== null && (
          <ReferenceLine
            segment={[
              { x: demandGw, y: ys.domain[0] },
              { x: demandGw, y: price ?? ys.domain[1] },
            ]}
            stroke={MODEL_COLOR}
            strokeWidth={CHART.line}
            ifOverflow="hidden"
          />
        )}
        {demandGw !== null && price !== null && (
          <ReferenceLine
            segment={[
              { x: xs.domain[0], y: price },
              { x: demandGw, y: price },
            ]}
            stroke={MODEL_COLOR}
            strokeWidth={1}
            ifOverflow="hidden"
          />
        )}
        {demandGw !== null && price !== null && (
          <Extreme x={demandGw} y={price} anchor={extremeAnchor(demandGw, xs.domain)} color={MODEL_COLOR} text={`Clears at ${fmt1(demandGw)} GW and ${money(price, 2)}/MWh`} />
        )}
        {demandGw !== null && price === null && (
          <Extreme x={demandGw} y={ys.domain[1]} below anchor={extremeAnchor(demandGw, xs.domain)} color={MODEL_COLOR} text={`Clearing demand ${fmt1(demandGw)} GW`} />
        )}
        <Line dataKey="cost" stroke="none" dot={false} activeDot={false} legendType="none" isAnimationActive={false} />
      </ComposedChart>
    </ChartFrame>
  )
}

export function CurveMain({ ctx }: { ctx: PageContext }) {
  const rows = ownRows(ctx)
  const times = useMemo(() => curveTimes(rows), [rows])
  const at = chosenTime(ctx.param('at'), times)
  const units = useMemo(() => (at === null ? [] : curveAt(rows, at)), [rows, at])
  if (ctx.mode === 'table') return <SeriesBody ctx={ctx} />
  const model = ctx.series
  if (!model || !ctx.window) return null
  if (model.bucketed) {
    return (
      <p className="gf-state">
        This window is read as {model.stepMs ? meansText(model.stepMs) : 'means'}, and a mean of units’ ranks and costs over several half-hours isn’t a merit order, so no curve is drawn. Choose
        one day in the range to draw each half-hour’s curve; the table lists the means.
      </p>
    )
  }
  if (at === null || !units.length) return <p className="gf-state">No unit’s cost is held for this half-hour, so there is no curve to draw. The table lists the rows.</p>

  const clearing = clearingAt(ctx, at)
  const market = marketAt(ctx, at)
  const clearingRel = ctx.related.clearing
  const missing = missingUnits(rows, at)
  const within = clearing?.demand !== null && clearing?.demand !== undefined ? unitAtDemand(units, clearing.demand) : null
  const differs = clearing?.atFloor === false && clearing.unit !== null && within !== null && within.unit !== clearing.unit

  return (
    <>
      <CurveChart units={units} clearing={clearing} market={market} />
      <div className="gf-notes">
        {clearingRel && (clearingRel.state === 'error' || clearingRel.state === 'refreshing') && (
          <p>
            The clearing demand and price couldn’t be read, so the curve is drawn without them. <ErrorWords error={clearingRel.error} />
          </p>
        )}
        {clearingRel?.state === 'data' && !clearing && <p>The clearing run holds no row for this half-hour, so the curve is drawn without its clearing demand and price.</p>}
        {clearing?.atFloor === true && clearing.demand !== null && (
          <p>
            At this half-hour the clearing demand is {fmt1(clearing.demand / 1000)} GW, below zero, and the model’s price floor set the price
            {clearing.model !== null ? `, at ${money(clearing.model, 2)}/MWh` : ''}. The line marks the clearing demand; no unit’s cost set the price.
          </p>
        )}
        {differs && within && clearing?.unit && (
          <p>
            The clearing run names <code>{clearing.unit}</code> as the unit that set the price, but on this curve the clearing demand falls in the block of <code>{within.unit}</code>. Both are shown as held.
          </p>
        )}
        {market === null && <p>No market index price is held for this half-hour.</p>}
        {missing.length > 0 && (
          <p>
            {plural(missing.length, 'unit', 'units')} with rows elsewhere in this window {missing.length === 1 ? 'has' : 'have'} none for this half-hour, so {missing.length === 1 ? 'it is' : 'they are'} not in
            the curve: <Ids ids={missing} />.
          </p>
        )}
      </div>
    </>
  )
}
