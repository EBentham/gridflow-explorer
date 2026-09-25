import { createContext, useContext, useMemo, type ReactNode } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ForecastDayRecord } from '../api/types'
import { FUEL_BANDS, fuelVar, totalGeneration, type MixRow } from './fuels'
import { HALF_HOUR, axisClockCaption, halfHourWindow, toMs, ukTimeTicks } from './time'

/**
 * The per-direction chart grammar. Colours never live here: every mark reads
 * a CSS custom property (`--chart-*`, `--fuel-*`), so light/dark is a token
 * swap with no re-render.
 */
export interface ChartLanguage {
  curve: 'monotone' | 'linear' | 'stepAfter'
  areaOpacity: number
  /** Stacked-fill edge: a surface-coloured gap, or the series colour as a hairline. */
  areaStroke: 'surface' | 'series'
  /** Surface-coloured separator between stacked fills, px. */
  gap: number
  line: number
  gridX: 'none' | 'days' | 'fine'
  gridY: boolean
  fan: 'bands' | 'contours' | 'hairlines'
  font: number
  height: number
  /** Dash pattern used for synthetic/fixture series. */
  fixtureDash: string
}

export const DEFAULT_LANGUAGE: ChartLanguage = {
  curve: 'linear',
  areaOpacity: 0.85,
  areaStroke: 'surface',
  gap: 1,
  line: 2,
  gridX: 'days',
  gridY: true,
  fan: 'bands',
  font: 12,
  height: 420,
  fixtureDash: '5 4',
}

const LanguageContext = createContext<ChartLanguage>(DEFAULT_LANGUAGE)
export const ChartLanguageProvider = LanguageContext.Provider
export const useChartLanguage = () => useContext(LanguageContext)

const MARGIN = { top: 28, right: 20, bottom: 8, left: 4 }

function axisTick(lang: ChartLanguage) {
  return { fill: 'var(--chart-tick)', fontSize: lang.font, fontFamily: 'var(--chart-font)' }
}

function unitLabel(unit: string, lang: ChartLanguage) {
  return {
    value: unit,
    position: 'top' as const,
    offset: 14,
    fill: 'var(--chart-tick)',
    fontSize: lang.font,
    fontFamily: 'var(--chart-font)',
    textAnchor: 'start' as const,
    dx: -6,
  }
}

const fmt1 = (v: number) => v.toLocaleString('en-GB', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
const fmt0 = (v: number) => Math.round(v).toLocaleString('en-GB').replace('-', '−')
/** Money with the sign outside the currency symbol: `−£67`. */
const money = (v: number, digits = 0) =>
  `${v < 0 ? '−' : ''}£${Math.abs(v).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`

/** Round-number axis: a 1/2/2.5/5 x 10^n step covering [min, max], zero included when crossed. */
export function niceTicks(min: number, max: number, target = 5): { domain: [number, number]; ticks: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 1], ticks: [0, 1] }
  if (min === max) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6)
  return { domain: [lo, hi], ticks }
}

/**
 * Vertical rules drawn as reference lines, because Recharts grids can't
 * target arbitrary x. `days` rules London midnights. `fine` adds a
 * half-hour-multiple graticule (the chart-recorder grammar).
 */
function VerticalRules({ midnights, domain, lang }: { midnights: number[]; domain: [number, number]; lang: ChartLanguage }) {
  if (lang.gridX === 'none') return null
  return (
    <>
      {lang.gridX === 'fine' &&
        fineTicks(domain[0], domain[1]).map((t) => (
          <ReferenceLine key={`f${t}`} x={t} stroke="var(--chart-grid)" strokeWidth={1} ifOverflow="hidden" zIndex={-60} />
        ))}
      {midnights.map((m) => (
        <ReferenceLine key={m} x={m} stroke="var(--chart-grid-strong)" strokeWidth={1} ifOverflow="hidden" zIndex={-50} />
      ))}
    </>
  )
}

/** Fine half-hour-multiple graticule (chart-recorder grammar). */
function fineTicks(start: number, end: number): number[] {
  const span = end - start
  const step = span <= 36 * 3600e3 ? HALF_HOUR : span <= 8 * 86400e3 ? 3 * 3600e3 : 12 * 3600e3
  const first = Math.ceil(start / step) * step
  const out: number[] = []
  for (let t = first; t <= end; t += step) out.push(t)
  return out
}

interface TipRow {
  key: string
  color: string
  label: string
  value: string
  dashed?: boolean
  strong?: boolean
}

export function TooltipBox({ title, rows, note }: { title: string; rows: TipRow[]; note?: string }) {
  return (
    <div className="gf-tip">
      <div className="gf-tip-title">{title}</div>
      <table>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.strong ? 'gf-tip-strong' : undefined}>
              <td className="gf-tip-value">{r.value}</td>
              <td>
                <svg width="12" height="8" aria-hidden="true">
                  <line
                    x1="0"
                    y1="4"
                    x2="12"
                    y2="4"
                    stroke={r.color}
                    strokeWidth="3"
                    strokeDasharray={r.dashed ? '3 2' : undefined}
                  />
                </svg>
              </td>
              <td className="gf-tip-label">{r.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <div className="gf-tip-note">{note}</div>}
    </div>
  )
}

interface ActivePayload<T> {
  active?: boolean
  payload?: readonly { payload?: T }[]
}

// ---------------------------------------------------------------- generation

export function GenerationChart({
  rows,
  focus,
  height,
}: {
  rows: MixRow[]
  /** A band key for the single-fuel view; omitted = full stack. */
  focus?: string
  height?: number
}) {
  const lang = useChartLanguage()
  const d0 = rows[0]?.t ?? 0
  const d1 = rows.at(-1)?.t ?? 0
  const domain: [number, number] = [d0, d1]
  const { ticks, format, midnights } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const bands = focus ? FUEL_BANDS.filter((b) => b.key === focus) : FUEL_BANDS
  const hasNegative = rows.some((r) => FUEL_BANDS.some((b) => b.signed && (focus ? b.key === focus : true) && r[b.key] < 0))
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

  const renderTip = ({ active, payload }: ActivePayload<MixRow>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    const tipRows: TipRow[] = [...bands].reverse().flatMap((b) => {
      const main: TipRow = { key: b.key, color: fuelVar(b.key), label: b.label, value: `${fmt1(row[b.key])} GW` }
      const subs =
        b.sources.length > 1
          ? b.sources
              .filter((s) => Math.abs(row[`src__${s.key}`]) >= 0.05)
              .map((s) => ({ key: s.key, color: 'transparent', label: `  ${s.label}`, value: fmt1(row[`src__${s.key}`]) }))
          : []
      return [main, ...subs]
    })
    if (!focus) tipRows.push({ key: 'total', color: 'transparent', label: 'Total generation', value: `${fmt1(totalGeneration(row))} GW`, strong: true })
    return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows} />
  }

  return (
    <div className="gf-chart" style={{ height: height ?? lang.height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={MARGIN} stackOffset="none">
          <CartesianGrid vertical={false} horizontal={lang.gridY} stroke="var(--chart-grid)" />
          <VerticalRules midnights={midnights} domain={domain} lang={lang} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={domain}
            ticks={ticks}
            tickFormatter={format}
            tick={axisTick(lang)}
            stroke="var(--chart-axis)"
            tickLine={false}
          />
          <YAxis
            tick={axisTick(lang)}
            stroke="var(--chart-axis)"
            axisLine={false}
            tickLine={false}
            width={44}
            domain={y.domain}
            ticks={y.ticks}
            tickFormatter={(v: number) => fmt0(v)}
            label={unitLabel('GW', lang)}
          />
          <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
          {hasNegative && <ReferenceLine y={0} stroke="var(--chart-axis)" strokeWidth={1} />}
          {bands.map((b) => (
            <Area
              key={b.key}
              dataKey={b.signed ? `${b.key}__pos` : b.key}
              stackId={focus ? undefined : 'pos'}
              type={lang.curve}
              fill={fuelVar(b.key)}
              fillOpacity={focus ? 0.18 : lang.areaOpacity}
              stroke={focus || lang.areaStroke === 'series' ? fuelVar(b.key) : 'var(--chart-surface)'}
              strokeWidth={focus ? lang.line : lang.gap}
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
                type={lang.curve}
                fill={fuelVar(b.key)}
                fillOpacity={focus ? 0.18 : lang.areaOpacity}
                stroke={focus || lang.areaStroke === 'series' ? fuelVar(b.key) : 'var(--chart-surface)'}
                strokeWidth={focus ? lang.line : lang.gap}
                isAnimationActive={false}
                activeDot={false}
              />
            ))}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="gf-axis-caption">{axisClockCaption(domain[0], domain[1])}</div>
    </div>
  )
}

// ---------------------------------------------------------------- prices

export interface PriceRow {
  t: number
  price: number | null
  sell: number | null
  buy: number | null
  niv: number | null
}

export function toPriceRows(records: Record<string, string | number | null>[], timestampKey: string): PriceRow[] {
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
  return records.map((r) => {
    const sell = num(r.system_sell_price)
    const buy = num(r.system_buy_price)
    return { t: toMs(String(r[timestampKey])), sell, buy, price: sell ?? buy, niv: num(r.net_imbalance_volume) }
  })
}

export function PriceChart({ rows, height, nivHeight }: { rows: PriceRow[]; height?: number; nivHeight?: number }) {
  const lang = useChartLanguage()
  const d0 = rows[0]?.t ?? 0
  const d1 = rows.at(-1)?.t ?? 0
  const domain: [number, number] = [d0, d1]
  const { ticks, format, midnights } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const singlePriced = rows.every((r) => r.sell === r.buy)
  const hasNegative = rows.some((r) => (r.price ?? 0) < 0)
  const yp = useMemo(() => {
    const v = rows.flatMap((r) => [r.sell, r.buy]).filter((x): x is number => x !== null)
    return niceTicks(Math.min(0, ...v), Math.max(...v))
  }, [rows])
  const yn = useMemo(() => {
    const v = rows.map((r) => r.niv).filter((x): x is number => x !== null)
    return niceTicks(Math.min(0, ...v), Math.max(0, ...v), 3)
  }, [rows])

  const renderPriceTip = ({ active, payload }: ActivePayload<PriceRow>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    const tipRows: TipRow[] = singlePriced
      ? [{ key: 'p', color: 'var(--chart-price)', label: 'System price', value: `${money(row.price ?? NaN, 2)}/MWh` }]
      : [
          { key: 's', color: 'var(--chart-price)', label: 'Sell price', value: money(row.sell ?? NaN, 2) },
          { key: 'b', color: 'var(--chart-price-2)', label: 'Buy price', value: money(row.buy ?? NaN, 2) },
        ]
    if (row.niv !== null) {
      tipRows.push({
        key: 'n',
        color: row.niv >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)',
        label: row.niv >= 0 ? 'NIV, system short' : 'NIV, system long',
        value: `${fmt0(row.niv)} MWh`,
      })
    }
    return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows} note={singlePriced ? 'Single imbalance price: sell = buy' : undefined} />
  }

  const xAxis = (showTicks: boolean) => (
    <XAxis
      dataKey="t"
      type="number"
      scale="time"
      domain={domain}
      ticks={ticks}
      tickFormatter={format}
      tick={showTicks ? axisTick(lang) : false}
      stroke="var(--chart-axis)"
      tickLine={false}
      height={showTicks ? 24 : 4}
    />
  )

  return (
    <div className="gf-chart-stack">
      <div className="gf-chart" style={{ height: height ?? lang.height * 0.72 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={MARGIN} syncId="prices">
            <CartesianGrid vertical={false} horizontal={lang.gridY} stroke="var(--chart-grid)" />
            <VerticalRules midnights={midnights} domain={domain} lang={lang} />
            {xAxis(false)}
            <YAxis
              tick={axisTick(lang)}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={yp.domain}
              ticks={yp.ticks}
              tickFormatter={(v: number) => fmt0(v)}
              label={unitLabel('£/MWh', lang)}
            />
            <Tooltip content={renderPriceTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            {hasNegative && <ReferenceLine y={0} stroke="var(--chart-axis)" />}
            <Line
              dataKey={singlePriced ? 'price' : 'sell'}
              type={lang.curve === 'monotone' ? 'linear' : lang.curve}
              stroke="var(--chart-price)"
              strokeWidth={lang.line}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: 'var(--chart-price)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
            />
            {!singlePriced && (
              <Line dataKey="buy" type={lang.curve} stroke="var(--chart-price-2)" strokeWidth={lang.line} dot={false} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="gf-chart gf-chart-niv" style={{ height: nivHeight ?? lang.height * 0.36 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ ...MARGIN, top: 22 }} syncId="prices" barCategoryGap={0}>
            <CartesianGrid vertical={false} horizontal={lang.gridY} stroke="var(--chart-grid)" />
            <VerticalRules midnights={midnights} domain={domain} lang={lang} />
            {xAxis(true)}
            <YAxis
              tick={axisTick(lang)}
              axisLine={false}
              tickLine={false}
              width={44}
              domain={yn.domain}
              ticks={yn.ticks}
              tickFormatter={(v: number) => fmt0(v)}
              label={unitLabel('NIV, MWh', lang)}
            />
            <Tooltip content={renderPriceTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            <ReferenceLine y={0} stroke="var(--chart-axis)" />
            <Bar dataKey="niv" isAnimationActive={false} maxBarSize={6}>
              {rows.map((r) => (
                <Cell key={r.t} fill={(r.niv ?? 0) >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)'} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
        <div className="gf-axis-caption">{axisClockCaption(domain[0], domain[1])}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- forecast fan

interface FanRow {
  t: number
  sp: number
  actual: number | null
  q05: number
  q10: number
  q25: number
  q50: number
  q75: number
  q90: number
  q95: number
  b90: [number, number]
  b80: [number, number]
  b50: [number, number]
}

export function toFanRows(records: ForecastDayRecord[]): FanRow[] {
  return records
    .map((r) => ({
      t: toMs(r.delivery_time),
      sp: r.settlement_period,
      actual: r.actual,
      q05: r['q_0.05'],
      q10: r['q_0.1'],
      q25: r['q_0.25'],
      q50: r['q_0.5'],
      q75: r['q_0.75'],
      q90: r['q_0.9'],
      q95: r['q_0.95'],
      b90: [r['q_0.05'], r['q_0.95']] as [number, number],
      b80: [r['q_0.1'], r['q_0.9']] as [number, number],
      b50: [r['q_0.25'], r['q_0.75']] as [number, number],
    }))
    .sort((a, b) => a.t - b.t)
}

const CONTOURS: { key: keyof FanRow; label: string; w: number; labelled: boolean }[] = [
  { key: 'q05', label: 'p5', w: 1, labelled: true },
  { key: 'q10', label: 'p10', w: 1, labelled: false },
  { key: 'q25', label: 'p25', w: 1.25, labelled: true },
  { key: 'q75', label: 'p75', w: 1.25, labelled: true },
  { key: 'q90', label: 'p90', w: 1, labelled: false },
  { key: 'q95', label: 'p95', w: 1, labelled: true },
]

export function FanChart({
  records,
  unit,
  fixture,
  height,
}: {
  records: ForecastDayRecord[]
  unit: string
  fixture?: boolean
  height?: number
}) {
  const lang = useChartLanguage()
  const rows = useMemo(() => toFanRows(records), [records])
  const d0 = rows[0]?.t ?? 0
  const d1 = (rows.at(-1)?.t ?? 0) + HALF_HOUR
  const domain: [number, number] = [d0, d1]
  const { ticks, format } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const dash = fixture ? lang.fixtureDash : undefined
  const yf = useMemo(() => {
    const v = rows.flatMap((r) => [r.q05, r.q95, r.actual ?? r.q50])
    return niceTicks(Math.min(...v), Math.max(...v))
  }, [rows])

  const renderTip = ({ active, payload }: ActivePayload<FanRow>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    return (
      <TooltipBox
        title={`SP ${row.sp}, ${halfHourWindow(row.t)}`}
        rows={[
          { key: 'a', color: 'var(--chart-actual)', label: 'Actual', value: row.actual === null ? 'pending' : `${fmt0(row.actual)} ${unit}`, strong: true },
          { key: 'm', color: 'var(--chart-fan)', label: 'Median forecast', value: `${fmt0(row.q50)} ${unit}`, dashed: fixture },
          { key: '80', color: 'var(--chart-fan-soft)', label: '80% interval', value: `${fmt0(row.q10)}–${fmt0(row.q90)}` },
          { key: '90', color: 'var(--chart-fan-soft)', label: '90% interval', value: `${fmt0(row.q05)}–${fmt0(row.q95)}` },
        ]}
      />
    )
  }

  return (
    <div className="gf-chart" style={{ height: height ?? lang.height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ ...MARGIN, right: lang.fan === 'contours' ? 40 : MARGIN.right }}>
          <CartesianGrid vertical={false} horizontal={lang.gridY} stroke="var(--chart-grid)" />
          <VerticalRules midnights={[]} domain={domain} lang={lang} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={domain}
            ticks={ticks}
            tickFormatter={format}
            tick={axisTick(lang)}
            stroke="var(--chart-axis)"
            tickLine={false}
          />
          <YAxis
            tick={axisTick(lang)}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v: number) => fmt0(v)}
            label={unitLabel(unit, lang)}
            domain={yf.domain}
            ticks={yf.ticks}
          />
          <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
          {lang.fan === 'bands' && (
            <>
              <Area dataKey="b90" type={lang.curve} fill="var(--chart-fan)" fillOpacity={0.12} stroke="none" isAnimationActive={false} activeDot={false} />
              <Area dataKey="b80" type={lang.curve} fill="var(--chart-fan)" fillOpacity={0.16} stroke="none" isAnimationActive={false} activeDot={false} />
              <Area dataKey="b50" type={lang.curve} fill="var(--chart-fan)" fillOpacity={0.24} stroke="none" isAnimationActive={false} activeDot={false} />
            </>
          )}
          {lang.fan !== 'bands' &&
            CONTOURS.map((c) => (
              <Line
                key={c.key}
                dataKey={c.key}
                type={lang.curve}
                stroke={lang.fan === 'contours' ? 'var(--chart-fan-soft)' : 'var(--chart-fan)'}
                strokeOpacity={lang.fan === 'hairlines' ? 0.55 : 1}
                strokeWidth={lang.fan === 'hairlines' ? 1 : c.w}
                strokeDasharray={dash}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                label={
                  lang.fan === 'contours'
                    ? (p: { x?: number | string; y?: number | string; index?: number }) =>
                        p.index === rows.length - 1 && c.labelled ? (
                          <text x={Number(p.x ?? 0) + 6} y={Number(p.y ?? 0) + 4} fontSize={lang.font - 1} fill="var(--chart-tick)" fontFamily="var(--chart-font)">
                            {c.label}
                          </text>
                        ) : (
                          <g />
                        )
                    : undefined
                }
              />
            ))}
          <Line
            dataKey="q50"
            type={lang.curve}
            stroke="var(--chart-fan)"
            strokeWidth={lang.line}
            strokeDasharray={dash}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: 'var(--chart-fan)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
          />
          <Line
            dataKey="actual"
            type={lang.curve}
            stroke="var(--chart-actual)"
            strokeWidth={lang.line}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: 'var(--chart-actual)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="gf-axis-caption">{axisClockCaption(domain[0], domain[1])}, settlement periods in tooltip</div>
    </div>
  )
}

// ---------------------------------------------------------------- keys & tables

export function FuelKey({ latest, dense, onPick, focus }: { latest?: MixRow; dense?: boolean; onPick?: (k: string | undefined) => void; focus?: string }) {
  return (
    <ul className={`gf-fuel-key${dense ? ' is-dense' : ''}`}>
      {[...FUEL_BANDS].reverse().map((b) => (
        <li key={b.key} className={focus === b.key ? 'is-focus' : focus ? 'is-muted' : undefined}>
          <button type="button" onClick={onPick ? () => onPick(focus === b.key ? undefined : b.key) : undefined} disabled={!onPick}>
            <span className="gf-swatch" style={{ background: fuelVar(b.key) }} />
            <span className="gf-fuel-name">{b.label}</span>
            {latest && <span className="gf-fuel-value">{fmt1(latest[b.key])}</span>}
          </button>
        </li>
      ))}
    </ul>
  )
}

export function DataTable({ columns, rows, caption }: { columns: { key: string; label: string; align?: 'end' }[]; rows: Record<string, ReactNode>[]; caption: string }) {
  return (
    <div className="gf-table-wrap">
      <table className="gf-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'end' ? 'is-num' : undefined} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'end' ? 'is-num' : undefined}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { fmt0, fmt1, money, fineTicks }
