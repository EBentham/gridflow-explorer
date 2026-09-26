import { useMemo, type ReactElement } from 'react'
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
import { HALF_HOUR, axisClockCaption, halfHourWindow, ukTimeTicks } from '../../../design/time'

/**
 * Slot f's chart grammar, after the site's "transition, in data" board:
 * one petrol line, hairline rules, dashed day rules, labelled extremes
 * with small rings, and a chartreuse band on the half-hour worth naming.
 */
export const F_LANGUAGE: ChartLanguage = {
  curve: 'linear',
  areaOpacity: 1,
  areaStroke: 'surface',
  gap: 1,
  line: 1.75,
  gridX: 'days',
  gridY: true,
  fan: 'bands',
  font: 12,
  height: 380,
  fixtureDash: '5 4',
}

const FONT = 12
const MARGIN = { top: 30, right: 18, bottom: 2, left: 0 }
const tick = { fill: 'var(--chart-tick)', fontSize: FONT, fontFamily: 'var(--chart-font)' }
const unitLabel = (unit: string) => ({
  value: unit,
  position: 'top' as const,
  offset: 16,
  fill: 'var(--chart-tick)',
  fontSize: FONT,
  fontFamily: 'var(--chart-font)',
  textAnchor: 'start' as const,
  dx: -4,
})

type TipRows = Parameters<typeof TooltipBox>[0]['rows']
interface Active<T> {
  active?: boolean
  payload?: readonly { payload?: T }[]
}

export interface Band {
  t0: number
  t1: number
}

export interface Mark {
  t: number
  v: number
  value: string
  desc: string
  place: 'above' | 'below'
}

function DayRules({ midnights }: { midnights: number[] }) {
  return (
    <>
      {midnights.map((m) => (
        <ReferenceLine key={m} x={m} stroke="var(--chart-grid-strong)" strokeDasharray="2 3" ifOverflow="hidden" zIndex={-60} />
      ))}
    </>
  )
}

function bandShape(p: { x?: number; y?: number; width?: number; height?: number }): ReactElement<SVGElement> {
  const w0 = Number(p.width ?? 0)
  const w = Math.max(w0, 5)
  return <rect x={Number(p.x ?? 0) - (w - w0) / 2} y={p.y} width={w} height={p.height} className="f-band" />
}

function BandArea({ band, z = 50 }: { band?: Band | null; z?: number }) {
  if (!band) return null
  return <ReferenceArea x1={band.t0} x2={band.t1} ifOverflow="hidden" shape={bandShape} zIndex={z} />
}

function ringShape(m: Mark, domain: [number, number]) {
  const frac = (m.t - domain[0]) / (domain[1] - domain[0] || 1)
  const anchor = frac > 0.7 ? 'end' : 'start'
  return function Ring(p: { cx?: number | string; cy?: number | string }): ReactElement<SVGElement> {
    const cx = Number(p.cx ?? 0)
    const cy = Number(p.cy ?? 0)
    const dx = anchor === 'start' ? 9 : -9
    const dy = m.place === 'above' ? -9 : 18
    return (
      <g className="f-ring">
        <circle cx={cx} cy={cy} r={3.75} />
        <text x={cx + dx} y={cy + dy} textAnchor={anchor}>
          <tspan className="f-ring-v">{m.value}</tspan>
          <tspan>{`, ${m.desc}`}</tspan>
        </text>
      </g>
    )
  }
}

function Rings({ marks, domain }: { marks: Mark[]; domain: [number, number] }) {
  return (
    <>
      {marks.map((m) => (
        <ReferenceDot key={`${m.t}-${m.desc}`} x={m.t} y={m.v} r={4} ifOverflow="visible" shape={ringShape(m, domain)} zIndex={1500} />
      ))}
    </>
  )
}

function ClockNote({ domain, extra }: { domain: [number, number]; extra?: string }) {
  return (
    <p className="f-clock">
      {axisClockCaption(domain[0], domain[1])}
      {extra}
    </p>
  )
}

const xAxisProps = (domain: [number, number], ticks: number[], format: (ms: number) => string) => ({
  dataKey: 't',
  type: 'number' as const,
  scale: 'time' as const,
  domain,
  ticks,
  tickFormatter: format,
  stroke: 'var(--chart-axis)',
  tickSize: 5,
})

// ---------------------------------------------------------------- generation

export function FGenerationChart({ rows, focus, band, marks }: { rows: MixRow[]; focus?: string; band?: Band | null; marks: Mark[] }) {
  const d0 = rows[0]?.t ?? 0
  const d1 = rows.at(-1)?.t ?? 0
  const domain: [number, number] = [d0, d1]
  const { ticks, format, midnights } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const bands = focus ? FUEL_BANDS.filter((b) => b.key === focus) : FUEL_BANDS
  const hasNegative = rows.some((r) => bands.some((b) => b.signed && r[b.key] < 0))
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
    return niceTicks(lo, hi * 1.06)
  }, [rows, bands])

  const renderTip = ({ active, payload }: Active<MixRow>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    const tip: TipRows = [...bands].reverse().flatMap((b) => {
      const main = { key: b.key, color: fuelVar(b.key), label: b.label, value: `${fmt1(row[b.key])} GW` }
      const subs =
        b.sources.length > 1
          ? b.sources
              .filter((s) => Math.abs(row[`src__${s.key}`]) >= 0.05)
              .map((s) => ({ key: s.key, color: 'transparent', label: `  ${s.label}`, value: fmt1(row[`src__${s.key}`]) }))
          : []
      return [main, ...subs]
    })
    if (!focus) tip.push({ key: 'total', color: 'transparent', label: 'Total generation', value: `${fmt1(totalGeneration(row))} GW`, strong: true })
    return <TooltipBox title={halfHourWindow(row.t)} rows={tip} />
  }

  return (
    <div className="f-chart">
      <div className="gf-chart" style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <DayRules midnights={midnights} />
            <XAxis {...xAxisProps(domain, ticks, format)} tick={tick} />
            <YAxis tick={tick} axisLine={false} tickLine={false} width={44} domain={y.domain} ticks={y.ticks} tickFormatter={(v: number) => fmt0(v)} label={unitLabel('GW')} />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            {hasNegative && <ReferenceLine y={0} stroke="var(--chart-zero)" strokeWidth={1} zIndex={450} />}
            {bands.map((b) => (
              <Area
                key={b.key}
                dataKey={b.signed ? `${b.key}__pos` : b.key}
                stackId={focus ? undefined : 'pos'}
                type="linear"
                fill={fuelVar(b.key)}
                fillOpacity={focus ? 0.2 : 1}
                stroke={focus ? fuelVar(b.key) : 'var(--chart-surface)'}
                strokeWidth={focus ? 1.75 : 0.75}
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
                  fillOpacity={focus ? 0.2 : 1}
                  stroke={focus ? fuelVar(b.key) : 'var(--chart-surface)'}
                  strokeWidth={focus ? 1.75 : 0.75}
                  isAnimationActive={false}
                  activeDot={false}
                />
              ))}
            <BandArea band={band} z={150} />
            <Rings marks={marks} domain={domain} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ClockNote domain={domain} />
    </div>
  )
}

// ---------------------------------------------------------------- prices

export function FPriceCharts({ rows, band, marks }: { rows: PriceRow[]; band?: Band | null; marks: Mark[] }) {
  const d0 = rows[0]?.t ?? 0
  const d1 = rows.at(-1)?.t ?? 0
  const domain: [number, number] = [d0, d1]
  const { ticks, format, midnights } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const yp = useMemo(() => {
    const v = rows.map((r) => r.price).filter((x): x is number => x !== null)
    const lo = Math.min(0, ...v)
    const hi = Math.max(...v)
    return niceTicks(lo - (hi - lo) * 0.06, hi + (hi - lo) * 0.06)
  }, [rows])
  const yn = useMemo(() => {
    const v = rows.map((r) => r.niv).filter((x): x is number => x !== null)
    return niceTicks(Math.min(0, ...v), Math.max(0, ...v), 3)
  }, [rows])

  const renderTip = ({ active, payload }: Active<PriceRow>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    const tip: TipRows = [{ key: 'p', color: 'var(--chart-price)', label: 'System price', value: row.price === null ? '–' : `${money(row.price, 2)}/MWh` }]
    if (row.niv !== null)
      tip.push({
        key: 'n',
        color: row.niv >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)',
        label: row.niv >= 0 ? 'NIV, system short' : 'NIV, system long',
        value: `${fmt0(row.niv)} MWh`,
      })
    return <TooltipBox title={halfHourWindow(row.t)} rows={tip} />
  }

  return (
    <div className="f-chart">
      <div className="gf-chart" style={{ height: 290 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={MARGIN} syncId="f-prices">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <DayRules midnights={midnights} />
            <XAxis {...xAxisProps(domain, ticks, format)} tick={false} height={4} />
            <YAxis tick={tick} axisLine={false} tickLine={false} width={44} domain={yp.domain} ticks={yp.ticks} tickFormatter={(v: number) => fmt0(v)} label={unitLabel('£/MWh')} />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            <ReferenceLine y={0} stroke="var(--chart-zero)" zIndex={50} />
            <BandArea band={band} />
            <Line
              dataKey="price"
              type="linear"
              stroke="var(--chart-price)"
              strokeWidth={1.75}
              strokeLinejoin="round"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: 'var(--chart-price)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
            />
            <Rings marks={marks} domain={domain} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="gf-chart" style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ ...MARGIN, top: 26 }} syncId="f-prices" barCategoryGap={0}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <DayRules midnights={midnights} />
            <XAxis {...xAxisProps(domain, ticks, format)} tick={tick} />
            <YAxis tick={tick} axisLine={false} tickLine={false} width={44} domain={yn.domain} ticks={yn.ticks} tickFormatter={(v: number) => fmt0(v)} label={unitLabel('NIV, MWh')} />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            <ReferenceLine y={0} stroke="var(--chart-zero)" />
            <BandArea band={band} />
            <Bar dataKey="niv" isAnimationActive={false} maxBarSize={6}>
              {rows.map((r) => (
                <Cell key={r.t} fill={(r.niv ?? 0) >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ClockNote domain={domain} />
    </div>
  )
}

// ---------------------------------------------------------------- wind fan (fixture)

export function FFanChart({ records, band, marks }: { records: ForecastDayRecord[]; band?: Band | null; marks: Mark[] }) {
  const rows = useMemo(() => toFanRows(records), [records])
  const d0 = rows[0]?.t ?? 0
  const d1 = (rows.at(-1)?.t ?? 0) + HALF_HOUR
  const domain: [number, number] = [d0, d1]
  const { ticks, format } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const yf = useMemo(() => {
    const v = rows.flatMap((r) => [r.q05, r.q95, r.actual ?? r.q50])
    return niceTicks(Math.min(0, ...v), Math.max(...v) * 1.04)
  }, [rows])

  const renderTip = ({ active, payload }: Active<(typeof rows)[number]>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    return (
      <TooltipBox
        title={`SP ${row.sp}, ${halfHourWindow(row.t)}`}
        rows={[
          { key: 'a', color: 'var(--chart-actual)', label: 'Actual', value: row.actual === null ? 'pending' : `${fmt0(row.actual)} MW`, strong: true },
          { key: 'm', color: 'var(--chart-fan)', label: 'Median forecast', value: `${fmt0(row.q50)} MW`, dashed: true },
          { key: '80', color: 'var(--chart-fan-soft)', label: '80% interval', value: `${fmt0(row.q10)}–${fmt0(row.q90)}` },
          { key: '90', color: 'var(--chart-fan-soft)', label: '90% interval', value: `${fmt0(row.q05)}–${fmt0(row.q95)}` },
        ]}
        note="Fixture: synthetic values"
      />
    )
  }

  return (
    <div className="f-chart">
      <div className="gf-chart" style={{ height: 380 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis {...xAxisProps(domain, ticks, format)} tick={tick} />
            <YAxis tick={tick} axisLine={false} tickLine={false} width={52} domain={yf.domain} ticks={yf.ticks} tickFormatter={(v: number) => fmt0(v)} label={unitLabel('MW')} />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            <BandArea band={band} />
            <Area dataKey="b90" type="linear" fill="var(--chart-fan)" fillOpacity={0.1} stroke="none" isAnimationActive={false} activeDot={false} />
            <Area dataKey="b80" type="linear" fill="var(--chart-fan)" fillOpacity={0.14} stroke="none" isAnimationActive={false} activeDot={false} />
            <Area dataKey="b50" type="linear" fill="var(--chart-fan)" fillOpacity={0.22} stroke="none" isAnimationActive={false} activeDot={false} />
            <Line dataKey="q50" type="linear" stroke="var(--chart-fan)" strokeWidth={1.75} strokeDasharray="5 4" dot={false} isAnimationActive={false} activeDot={{ r: 4, fill: 'var(--chart-fan)', stroke: 'var(--chart-surface)', strokeWidth: 2 }} />
            <Line dataKey="actual" type="linear" stroke="var(--chart-actual)" strokeWidth={1.75} dot={false} connectNulls={false} isAnimationActive={false} activeDot={{ r: 4, fill: 'var(--chart-actual)', stroke: 'var(--chart-surface)', strokeWidth: 2 }} />
            <Rings marks={marks} domain={domain} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <ClockNote domain={domain} extra=", settlement periods in the tooltip" />
    </div>
  )
}

// ---------------------------------------------------------------- share of the window

export interface ShareItem {
  key: string
  label: string
  gw: number
}

/**
 * The site's "Great Britain's generation" bar: mean GW per fuel across the
 * window, widest first, named above each segment. Fuels too narrow to name
 * are listed under the axis instead of being squeezed.
 */
export function ShareBar({ items, total }: { items: ShareItem[]; total: number }) {
  const step = niceTicks(0, total, 6).ticks[1] ?? 5
  const ticks: number[] = []
  for (let v = 0; v <= total - step * 0.45; v += step) ticks.push(v)
  const pct = (v: number) => `${(v / total) * 100}%`
  const share = (v: number) => Math.round((v / total) * 100)
  return (
    <div className="f-share">
      <div className="f-share-row">
        {items.map((it) => {
          const wide = it.gw / total >= 0.075
          return (
            <div key={it.key} className="f-share-seg" style={{ flexGrow: it.gw, flexBasis: 0 }} title={`${it.label}: ${fmt1(it.gw)} GW, ${share(it.gw)}%`}>
              <span className="f-share-lab" aria-hidden={!wide}>
                {wide && (
                  <>
                    <b>{it.label}</b>
                    <span>
                      {fmt1(it.gw)} GW, {share(it.gw)}%
                    </span>
                  </>
                )}
              </span>
              <span className="f-share-fill" style={{ background: fuelVar(it.key) }} />
            </div>
          )
        })}
      </div>
      <div className="f-share-axis" aria-hidden="true">
        {ticks.map((v) => (
          <span key={v} style={{ left: pct(v) }}>
            {fmt0(v)}
          </span>
        ))}
        <span className="is-total" style={{ left: '100%' }}>
          {fmt1(total)} GW
        </span>
      </div>
    </div>
  )
}
