/**
 * Slot j chart language: the R3-2 paper-chart grammar. Flat fuel fills with a
 * paper gap, a 2px petrol line, recessive horizontal rules, dashed day rules,
 * an ink baseline, the unit set in ink above the axis, labelled extremes and
 * chartreuse highlight bands. Colours are CSS variables only.
 */
import { useMemo } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ForecastDayRecord } from '../../../api/types'
import { TooltipBox, fmt0, fmt1, money, niceTicks, toFanRows, type ChartLanguage, type PriceRow } from '../../../design/charts'
import { FUEL_BANDS, fuelVar, totalGeneration, type MixRow } from '../../../design/fuels'
import { HALF_HOUR, axisClockCaption, clock, dayLabel, halfHourWindow, ukTimeTicks } from '../../../design/time'

export const LANGUAGE_J: ChartLanguage = {
  curve: 'linear',
  areaOpacity: 1,
  areaStroke: 'surface',
  gap: 1,
  line: 2,
  gridX: 'days',
  gridY: true,
  fan: 'bands',
  font: 12.5,
  height: 400,
  fixtureDash: '5 4',
}

const MARGIN = { top: 30, right: 24, bottom: 4, left: 0 }
const TICK = { fill: 'var(--chart-tick)', fontSize: 12.5, fontFamily: 'var(--chart-font)' }

function unit(value: string) {
  return {
    value,
    position: 'top' as const,
    offset: 16,
    fill: 'var(--ink)',
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: 'var(--chart-font)',
    textAnchor: 'start' as const,
    dx: -4,
  }
}

interface TipRow {
  key: string
  color: string
  label: string
  value: string
  dashed?: boolean
  strong?: boolean
}

interface Tip<T> {
  active?: boolean
  payload?: readonly { payload?: T }[]
}

/** London midnights as dashed rules, the site's day grid. */
function dayRules(midnights: number[]) {
  return midnights.map((m) => (
    <ReferenceLine key={`d${m}`} x={m} stroke="var(--chart-day)" strokeDasharray="2 3" strokeWidth={1} ifOverflow="hidden" />
  ))
}

function xAxis(domain: [number, number], ticks: number[], format: (ms: number) => string, show = true) {
  return (
    <XAxis
      dataKey="t"
      type="number"
      scale="time"
      domain={domain}
      ticks={ticks}
      tickFormatter={format}
      tick={show ? { ...TICK, fill: 'var(--ink)', fontSize: 13 } : false}
      stroke="var(--chart-base)"
      tickLine={show ? { stroke: 'var(--chart-base)' } : false}
      tickSize={show ? 7 : 0}
      height={show ? 30 : 2}
    />
  )
}

// ---------------------------------------------------------------- generation

export function GenerationChartJ({ rows, focus, height = 400 }: { rows: MixRow[]; focus?: string; height?: number }) {
  const d0 = rows[0]?.t ?? 0
  const d1 = rows.at(-1)?.t ?? 0
  const domain: [number, number] = [d0, d1]
  const { ticks, format, midnights } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const bands = focus ? FUEL_BANDS.filter((b) => b.key === focus) : FUEL_BANDS
  const y = useMemo(() => {
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

  const renderTip = ({ active, payload }: Tip<MixRow>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    const tipRows: TipRow[] = [...bands].reverse().map((b) => ({ key: b.key, color: fuelVar(b.key), label: b.label, value: `${fmt1(row[b.key])} GW` }))
    if (!focus) tipRows.push({ key: 'total', color: 'transparent', label: 'Total generation', value: `${fmt1(totalGeneration(row))} GW`, strong: true })
    return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows} />
  }

  return (
    <div className="gf-chart j-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          {dayRules(midnights)}
          {xAxis(domain, ticks, format)}
          <YAxis tick={TICK} axisLine={false} tickLine={false} width={44} domain={y.domain} ticks={y.ticks} tickFormatter={(v: number) => fmt0(v)} label={unit('GW')} />
          <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
          {y.domain[0] < 0 && <ReferenceLine y={0} stroke="var(--chart-base)" strokeWidth={1} />}
          {bands.map((b) => (
            <Area
              key={b.key}
              dataKey={b.signed ? `${b.key}__pos` : b.key}
              stackId={focus ? undefined : 'pos'}
              type="linear"
              fill={fuelVar(b.key)}
              fillOpacity={focus ? 0.22 : 1}
              stroke={focus ? fuelVar(b.key) : 'var(--chart-surface)'}
              strokeWidth={focus ? 2 : 1}
              isAnimationActive={false}
              activeDot={false}
            />
          ))}
          {bands
            .filter((b) => b.signed)
            .map((b) => (
              <Area
                key={`${b.key}-neg`}
                dataKey={`${b.key}__neg`}
                stackId={focus ? undefined : 'neg'}
                type="linear"
                fill={fuelVar(b.key)}
                fillOpacity={focus ? 0.22 : 1}
                stroke={focus ? fuelVar(b.key) : 'var(--chart-surface)'}
                strokeWidth={focus ? 2 : 1}
                isAnimationActive={false}
                activeDot={false}
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="gf-axis-caption">{axisClockCaption(d0, d1)}</div>
    </div>
  )
}

// ---------------------------------------------------------------- prices

interface Extreme {
  t: number
  v: number
  kind: 'lowest' | 'highest'
}

/** Contiguous runs of half-hours with a price below zero, as [start, end) instants. */
export function negativeRuns(rows: PriceRow[]): [number, number][] {
  const out: [number, number][] = []
  let start: number | null = null
  let last = 0
  for (const r of rows) {
    const neg = r.price !== null && r.price < 0
    if (neg && start === null) start = r.t
    if (!neg && start !== null) {
      out.push([start, last + HALF_HOUR])
      start = null
    }
    if (neg) last = r.t
  }
  if (start !== null) out.push([start, last + HALF_HOUR])
  return out
}

export const perMwh = (v: number) => `${money(v, 2)}/MWh`

function ExtremeLabel({ cx, cy, e, domain, text }: { cx?: number; cy?: number; e: Extreme; domain: [number, number]; text: string }) {
  if (cx === undefined || cy === undefined) return null
  const frac = (e.t - domain[0]) / Math.max(1, domain[1] - domain[0])
  const left = frac > 0.55
  const dy = e.kind === 'lowest' ? 16 : -10
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.6} fill="var(--chart-surface)" stroke="var(--ink)" strokeWidth={1.4} />
      <text
        x={cx + (left ? -9 : 9)}
        y={cy + dy}
        textAnchor={left ? 'end' : 'start'}
        fontSize={13}
        fontWeight={600}
        fill="var(--ink)"
        fontFamily="var(--chart-font)"
        paintOrder="stroke"
        stroke="var(--chart-surface)"
        strokeWidth={4}
        strokeLinejoin="round"
      >
        {text}
      </text>
    </g>
  )
}

export function PriceChartJ({ rows, height = 300, nivHeight = 150 }: { rows: PriceRow[]; height?: number; nivHeight?: number }) {
  const d0 = rows[0]?.t ?? 0
  const d1 = rows.at(-1)?.t ?? 0
  const domain: [number, number] = [d0, d1]
  const { ticks, format, midnights } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const priced = rows.filter((r): r is PriceRow & { price: number } => r.price !== null)
  const yp = useMemo(() => {
    const v = priced.map((r) => r.price)
    return niceTicks(Math.min(0, ...v), Math.max(...v))
  }, [priced])
  const yn = useMemo(() => {
    const v = rows.map((r) => r.niv).filter((x): x is number => x !== null)
    return niceTicks(Math.min(0, ...v), Math.max(0, ...v), 3)
  }, [rows])
  const runs = useMemo(() => negativeRuns(rows), [rows])
  const extremes = useMemo<Extreme[]>(() => {
    if (!priced.length) return []
    let lo = priced[0]
    let hi = priced[0]
    for (const r of priced) {
      if (r.price < lo.price) lo = r
      if (r.price > hi.price) hi = r
    }
    return [
      { t: lo.t, v: lo.price, kind: 'lowest' },
      { t: hi.t, v: hi.price, kind: 'highest' },
    ]
  }, [priced])

  const renderTip = ({ active, payload }: Tip<PriceRow>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    const tipRows: TipRow[] = [{ key: 'p', color: 'var(--chart-price)', label: 'System price', value: row.price === null ? 'no value' : perMwh(row.price) }]
    if (row.niv !== null)
      tipRows.push({
        key: 'n',
        color: row.niv >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)',
        label: row.niv >= 0 ? 'NIV, system short' : 'NIV, system long',
        value: `${fmt0(row.niv)} MWh`,
      })
    return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows} />
  }

  const bands = runs.map(([a, b]) => (
    <ReferenceArea key={`n${a}`} x1={a} x2={Math.min(b, d1)} fill="var(--band)" fillOpacity={1} stroke="none" ifOverflow="hidden" />
  ))

  return (
    <div className="gf-chart-stack">
      <div className="gf-chart j-chart" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={MARGIN} syncId="j-prices">
            {bands}
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            {dayRules(midnights)}
            {xAxis(domain, ticks, format, false)}
            <YAxis tick={TICK} axisLine={false} tickLine={false} width={44} domain={yp.domain} ticks={yp.ticks} tickFormatter={(v: number) => fmt0(v)} label={unit('£/MWh')} />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            {yp.domain[0] < 0 && <ReferenceLine y={0} stroke="var(--chart-base)" strokeWidth={1} />}
            <Line
              dataKey="price"
              type="linear"
              stroke="var(--chart-price)"
              strokeWidth={2}
              strokeLinejoin="round"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: 'var(--chart-price)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
            />
            {extremes.map((e) => (
              <ReferenceDot
                key={e.kind}
                x={e.t}
                y={e.v}
                r={0}
                ifOverflow="visible"
                shape={(p: { cx?: number; cy?: number }) => (
                  <ExtremeLabel
                    cx={p.cx}
                    cy={p.cy}
                    e={e}
                    domain={domain}
                    text={`${perMwh(e.v)}, ${e.kind} in the window, ${dayLabel(e.t)} ${clock(e.t)}`}
                  />
                )}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="gf-chart j-chart j-chart-niv" style={{ height: nivHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ ...MARGIN, top: 26 }} syncId="j-prices" barCategoryGap={0}>
            {bands}
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            {dayRules(midnights)}
            {xAxis(domain, ticks, format)}
            <YAxis tick={TICK} axisLine={false} tickLine={false} width={44} domain={yn.domain} ticks={yn.ticks} tickFormatter={(v: number) => fmt0(v)} label={unit('NIV, MWh')} />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            <ReferenceLine y={0} stroke="var(--chart-base)" />
            <Bar dataKey="niv" isAnimationActive={false} maxBarSize={6}>
              {rows.map((r) => (
                <Cell key={r.t} fill={(r.niv ?? 0) >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
        <div className="gf-axis-caption">{axisClockCaption(d0, d1)}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- forecast fan

export function FanChartJ({ records, height = 380 }: { records: ForecastDayRecord[]; height?: number }) {
  const rows = useMemo(() => toFanRows(records), [records])
  const d0 = rows[0]?.t ?? 0
  const d1 = (rows.at(-1)?.t ?? 0) + HALF_HOUR
  const domain: [number, number] = [d0, d1]
  const { ticks, format } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const yf = useMemo(() => {
    const v = rows.flatMap((r) => [r.q05, r.q95, r.actual ?? r.q50])
    return niceTicks(Math.min(0, ...v), Math.max(...v))
  }, [rows])
  const lastSettled = [...rows].reverse().find((r) => r.actual !== null)

  const renderTip = ({ active, payload }: Tip<(typeof rows)[number]>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    return (
      <TooltipBox
        title={`SP ${row.sp}, ${halfHourWindow(row.t)}`}
        rows={[
          { key: 'a', color: 'var(--chart-actual)', label: 'Actual', value: row.actual === null ? 'pending' : `${fmt0(row.actual)} MW`, strong: true },
          { key: 'm', color: 'var(--chart-fan)', label: 'Median, fixture', value: `${fmt0(row.q50)} MW`, dashed: true },
          { key: '80', color: 'var(--chart-fan-soft)', label: '80% interval', value: `${fmt0(row.q10)}–${fmt0(row.q90)}` },
          { key: '90', color: 'var(--chart-fan-soft)', label: '90% interval', value: `${fmt0(row.q05)}–${fmt0(row.q95)}` },
        ]}
      />
    )
  }

  return (
    <div className="gf-chart j-chart" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          {xAxis(domain, ticks, format)}
          <YAxis tick={TICK} axisLine={false} tickLine={false} width={52} domain={yf.domain} ticks={yf.ticks} tickFormatter={(v: number) => fmt0(v)} label={unit('MW')} />
          <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
          <Area dataKey="b90" type="linear" fill="var(--chart-fan)" fillOpacity={0.12} stroke="none" isAnimationActive={false} activeDot={false} />
          <Area dataKey="b80" type="linear" fill="var(--chart-fan)" fillOpacity={0.14} stroke="none" isAnimationActive={false} activeDot={false} />
          <Area dataKey="b50" type="linear" fill="var(--chart-fan)" fillOpacity={0.2} stroke="none" isAnimationActive={false} activeDot={false} />
          {lastSettled && (
            <ReferenceLine
              x={lastSettled.t + HALF_HOUR}
              stroke="var(--chart-day)"
              strokeDasharray="2 3"
              label={{
                value: `Settled to ${clock(lastSettled.t + HALF_HOUR)}`,
                position: 'insideTopRight',
                fill: 'var(--muted)',
                fontSize: 12.5,
                fontStyle: 'italic',
                fontFamily: 'var(--chart-font)',
              }}
            />
          )}
          <Line
            dataKey="q50"
            type="linear"
            stroke="var(--chart-fan)"
            strokeWidth={2}
            strokeDasharray={LANGUAGE_J.fixtureDash}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: 'var(--chart-fan)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
          />
          <Line
            dataKey="actual"
            type="linear"
            stroke="var(--chart-actual)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: 'var(--chart-actual)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="gf-axis-caption">{axisClockCaption(d0, d1)}</div>
    </div>
  )
}
