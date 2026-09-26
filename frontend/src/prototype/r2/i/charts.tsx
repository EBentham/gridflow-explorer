/**
 * Slot i chart set. Same data grammar as design/charts (colours only through
 * CSS custom properties, UK clock on every axis), plus the site's two
 * annotation moves: a chartreuse highlight band (the selected day on the
 * generation chart, negative-price runs on the price chart) and labelled
 * extremes on the price line.
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
import { TooltipBox, fmt0, fmt1, money, niceTicks, toFanRows, useChartLanguage, type PriceRow } from '../../../design/charts'
import { FUEL_BANDS, fuelVar, totalGeneration, type MixRow } from '../../../design/fuels'
import { HALF_HOUR, axisClockCaption, clock, dayTick, halfHourWindow, londonMidnight, ukTimeTicks } from '../../../design/time'

const MARGIN = { top: 26, right: 18, bottom: 6, left: 2 }

export const nextMidnight = (m: number) => londonMidnight(m + 26 * 3600e3)

interface TipRow {
  key: string
  color: string
  label: string
  value: string
  dashed?: boolean
  strong?: boolean
}

interface ActivePayload<T> {
  active?: boolean
  payload?: readonly { payload?: T }[]
}

interface PickState {
  activeTooltipIndex?: number | string | null
}

function useAxis() {
  const lang = useChartLanguage()
  const tick = { fill: 'var(--chart-tick)', fontSize: lang.font, fontFamily: 'var(--chart-font)' }
  const unit = (value: string) => ({
    value,
    position: 'top' as const,
    offset: 12,
    fill: 'var(--chart-tick)',
    fontSize: lang.font,
    fontFamily: 'var(--chart-font)',
    textAnchor: 'start' as const,
    dx: -4,
  })
  return { lang, tick, unit }
}

function DayRules({ midnights }: { midnights: number[] }) {
  return (
    <>
      {midnights.map((m) => (
        <ReferenceLine key={m} x={m} stroke="var(--chart-grid-strong)" strokeWidth={1} ifOverflow="hidden" />
      ))}
    </>
  )
}

// ---------------------------------------------------------------- generation

export function NightGenerationChart({
  rows,
  focus,
  day,
  onPickDay,
  height,
}: {
  rows: MixRow[]
  focus?: string
  day?: number
  onPickDay?: (d: number) => void
  height?: number
}) {
  const { lang, tick, unit } = useAxis()
  const d0 = rows[0]?.t ?? 0
  const d1 = rows.at(-1)?.t ?? 0
  const domain: [number, number] = [d0, d1]
  const { ticks, format, midnights } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const bands = focus ? FUEL_BANDS.filter((b) => b.key === focus) : FUEL_BANDS
  const hasNegative = rows.some((r) => bands.some((b) => b.signed && r[b.key] < 0))
  const multiDay = midnights.length > 0 && d1 - d0 > 30 * 3600e3
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
    return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows} note={multiDay && onPickDay ? 'Click to select this day' : undefined} />
  }

  const pick = (s: PickState | null | undefined) => {
    const i = Number(s?.activeTooltipIndex)
    if (onPickDay && Number.isInteger(i) && rows[i]) onPickDay(londonMidnight(rows[i].t))
  }

  const band = multiDay && day !== undefined ? [Math.max(day, d0), Math.min(nextMidnight(day), d1)] : null

  return (
    <div className={`gf-chart${onPickDay && multiDay ? ' i-pickable' : ''}`} style={{ height: height ?? lang.height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={MARGIN} onClick={pick}>
          <CartesianGrid vertical={false} horizontal={lang.gridY} stroke="var(--chart-grid)" />
          {band && <ReferenceArea x1={band[0]} x2={band[1]} fill="var(--band)" fillOpacity={1} stroke="none" ifOverflow="hidden" />}
          <DayRules midnights={midnights} />
          <XAxis dataKey="t" type="number" scale="time" domain={domain} ticks={ticks} tickFormatter={format} tick={tick} stroke="var(--chart-axis)" tickLine={false} />
          <YAxis
            tick={tick}
            stroke="var(--chart-axis)"
            axisLine={false}
            tickLine={false}
            width={40}
            domain={y.domain}
            ticks={y.ticks}
            tickFormatter={(v: number) => fmt0(v)}
            label={unit('GW')}
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
              fillOpacity={focus ? 0.22 : lang.areaOpacity}
              stroke={focus ? fuelVar(b.key) : 'var(--chart-surface)'}
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
                fillOpacity={focus ? 0.22 : lang.areaOpacity}
                stroke={focus ? fuelVar(b.key) : 'var(--chart-surface)'}
                strokeWidth={focus ? lang.line : lang.gap}
                isAnimationActive={false}
                activeDot={false}
              />
            ))}
          {band &&
            band.map((x) => <ReferenceLine key={`sel${x}`} x={x} stroke="var(--accent)" strokeWidth={1.5} ifOverflow="hidden" />)}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="gf-axis-caption">{axisClockCaption(domain[0], domain[1])}</div>
    </div>
  )
}

// ---------------------------------------------------------------- prices

export interface NegRun {
  start: number
  /** Start of the last negative half-hour in the run. */
  last: number
  n: number
  min: number
}

/** Consecutive half-hours with a system price below zero. */
export function negativeRuns(rows: PriceRow[]): NegRun[] {
  const out: NegRun[] = []
  let cur: NegRun | null = null
  for (const r of rows) {
    const p = r.price
    const contiguous = cur !== null && r.t - cur.last <= HALF_HOUR
    if (p !== null && p < 0) {
      if (cur && contiguous) {
        cur.last = r.t
        cur.n += 1
        cur.min = Math.min(cur.min, p)
      } else {
        cur = { start: r.t, last: r.t, n: 1, min: p }
        out.push(cur)
      }
    } else {
      cur = null
    }
  }
  return out
}

function ExtremeLabel({ cx, cy, text, anchor, below }: { cx: number; cy: number; text: string; anchor: 'start' | 'end'; below: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill="var(--chart-surface)" stroke="var(--chart-price)" strokeWidth={1.5} />
      <text
        x={cx + (anchor === 'start' ? 7 : -7)}
        y={cy + (below ? 15 : -9)}
        textAnchor={anchor}
        className="i-extreme"
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

export function NightPriceChart({ rows, height, nivHeight }: { rows: PriceRow[]; height?: number; nivHeight?: number }) {
  const { lang, tick, unit } = useAxis()
  const d0 = rows[0]?.t ?? 0
  const d1 = rows.at(-1)?.t ?? 0
  const domain: [number, number] = [d0, d1]
  const { ticks, format, midnights } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const runs = useMemo(() => negativeRuns(rows), [rows])
  const valid = rows.filter((r): r is PriceRow & { price: number } => r.price !== null)
  const lo = valid.reduce<(typeof valid)[number] | null>((m, r) => (!m || r.price < m.price ? r : m), null)
  const hi = valid.reduce<(typeof valid)[number] | null>((m, r) => (!m || r.price > m.price ? r : m), null)
  const yp = useMemo(() => {
    const v = valid.map((r) => r.price)
    return niceTicks(Math.min(0, ...v), Math.max(...v))
  }, [valid])
  const yn = useMemo(() => {
    const v = rows.map((r) => r.niv).filter((x): x is number => x !== null)
    return niceTicks(Math.min(0, ...v), Math.max(0, ...v), 3)
  }, [rows])
  const anchorFor = (t: number): 'start' | 'end' => ((t - d0) / Math.max(d1 - d0, 1) > 0.6 ? 'end' : 'start')

  const renderTip = ({ active, payload }: ActivePayload<PriceRow>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    const tipRows: TipRow[] = [{ key: 'p', color: 'var(--chart-price)', label: 'System price', value: row.price === null ? 'no value' : `${money(row.price, 2)}/MWh` }]
    if (row.niv !== null) {
      tipRows.push({
        key: 'n',
        color: row.niv >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)',
        label: row.niv >= 0 ? 'NIV, system short' : 'NIV, system long',
        value: `${fmt0(row.niv)} MWh`,
      })
    }
    return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows} note="Single imbalance price: sell = buy" />
  }

  const bands = runs.map((r) => (
    <ReferenceArea key={r.start} x1={r.start} x2={Math.min(r.last + HALF_HOUR, d1)} fill="var(--band)" fillOpacity={1} stroke="none" ifOverflow="hidden" />
  ))

  return (
    <div className="gf-chart-stack">
      <div className="gf-chart" style={{ height: height ?? lang.height * 0.7 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={MARGIN} syncId="i-prices">
            <CartesianGrid vertical={false} horizontal={lang.gridY} stroke="var(--chart-grid)" />
            {bands}
            <DayRules midnights={midnights} />
            <XAxis dataKey="t" type="number" scale="time" domain={domain} ticks={ticks} tick={false} stroke="var(--chart-axis)" tickLine={false} height={4} />
            <YAxis
              tick={tick}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={yp.domain}
              ticks={yp.ticks}
              tickFormatter={(v: number) => fmt0(v)}
              label={unit('£/MWh')}
            />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            <ReferenceLine y={0} stroke="var(--chart-axis)" />
            <Line
              dataKey="price"
              type="linear"
              stroke="var(--chart-price)"
              strokeWidth={lang.line}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: 'var(--chart-price)', stroke: 'var(--chart-surface)', strokeWidth: 2 }}
            />
            {hi && (
              <ReferenceDot
                x={hi.t}
                y={hi.price}
                r={0}
                ifOverflow="visible"
                shape={(p: { cx?: number; cy?: number }) => (
                  <ExtremeLabel cx={p.cx ?? 0} cy={p.cy ?? 0} anchor={anchorFor(hi.t)} below={false} text={`${money(hi.price, 2)}/MWh, highest, ${dayTick(hi.t)} at ${clock(hi.t)}`} />
                )}
              />
            )}
            {lo && (
              <ReferenceDot
                x={lo.t}
                y={lo.price}
                r={0}
                ifOverflow="visible"
                shape={(p: { cx?: number; cy?: number }) => (
                  <ExtremeLabel cx={p.cx ?? 0} cy={p.cy ?? 0} anchor={anchorFor(lo.t)} below text={`${money(lo.price, 2)}/MWh, lowest, ${dayTick(lo.t)} at ${clock(lo.t)}`} />
                )}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="gf-chart gf-chart-niv" style={{ height: nivHeight ?? lang.height * 0.34 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ ...MARGIN, top: 22 }} syncId="i-prices" barCategoryGap={0}>
            <CartesianGrid vertical={false} horizontal={lang.gridY} stroke="var(--chart-grid)" />
            {bands}
            <DayRules midnights={midnights} />
            <XAxis dataKey="t" type="number" scale="time" domain={domain} ticks={ticks} tickFormatter={format} tick={tick} stroke="var(--chart-axis)" tickLine={false} height={24} />
            <YAxis
              tick={tick}
              axisLine={false}
              tickLine={false}
              width={48}
              domain={yn.domain}
              ticks={yn.ticks}
              tickFormatter={(v: number) => fmt0(v)}
              label={unit('NIV, MWh')}
            />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
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

export function NightFanChart({ records, unit: unitName, height }: { records: ForecastDayRecord[]; unit: string; height?: number }) {
  const { lang, tick, unit } = useAxis()
  const rows = useMemo(() => toFanRows(records), [records])
  const d0 = rows[0]?.t ?? 0
  const d1 = (rows.at(-1)?.t ?? 0) + HALF_HOUR
  const domain: [number, number] = [d0, d1]
  const { ticks, format } = useMemo(() => ukTimeTicks(d0, d1), [d0, d1])
  const settled = rows.filter((r) => r.actual !== null).at(-1)
  const settledEnd = settled ? settled.t + HALF_HOUR : null
  const yf = useMemo(() => {
    const v = rows.flatMap((r) => [r.q05, r.q95, r.actual ?? r.q50])
    return niceTicks(Math.min(0, ...v), Math.max(...v))
  }, [rows])

  const renderTip = ({ active, payload }: ActivePayload<(typeof rows)[number]>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    return (
      <TooltipBox
        title={`SP ${row.sp}, ${halfHourWindow(row.t)}`}
        rows={[
          { key: 'a', color: 'var(--chart-actual)', label: 'Actual', value: row.actual === null ? 'not settled' : `${fmt0(row.actual)} ${unitName}`, strong: true },
          { key: 'm', color: 'var(--chart-fan)', label: 'Median forecast', value: `${fmt0(row.q50)} ${unitName}`, dashed: true },
          { key: '50', color: 'var(--chart-fan-soft)', label: '50% interval', value: `${fmt0(row.q25)}–${fmt0(row.q75)}` },
          { key: '90', color: 'var(--chart-fan-soft)', label: '90% interval', value: `${fmt0(row.q05)}–${fmt0(row.q95)}` },
        ]}
        note="Fixture data, synthetic"
      />
    )
  }

  return (
    <div className="gf-chart" style={{ height: height ?? lang.height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={MARGIN}>
          <CartesianGrid vertical={false} horizontal={lang.gridY} stroke="var(--chart-grid)" />
          <XAxis dataKey="t" type="number" scale="time" domain={domain} ticks={ticks} tickFormatter={format} tick={tick} stroke="var(--chart-axis)" tickLine={false} />
          <YAxis
            tick={tick}
            axisLine={false}
            tickLine={false}
            width={52}
            tickFormatter={(v: number) => fmt0(v)}
            label={unit(unitName)}
            domain={yf.domain}
            ticks={yf.ticks}
          />
          <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
          <Area dataKey="b90" type={lang.curve} fill="var(--chart-fan)" fillOpacity={0.13} stroke="none" isAnimationActive={false} activeDot={false} />
          <Area dataKey="b80" type={lang.curve} fill="var(--chart-fan)" fillOpacity={0.14} stroke="none" isAnimationActive={false} activeDot={false} />
          <Area dataKey="b50" type={lang.curve} fill="var(--chart-fan)" fillOpacity={0.2} stroke="none" isAnimationActive={false} activeDot={false} />
          {settledEnd !== null && settledEnd < d1 && (
            <ReferenceLine
              x={settledEnd}
              stroke="var(--chart-grid-strong)"
              strokeDasharray="2 3"
              label={{ value: `settled to ${clock(settledEnd)}`, position: 'insideTopLeft', fill: 'var(--chart-tick)', fontSize: lang.font, fontFamily: 'var(--chart-font)', dx: 4 }}
            />
          )}
          <Line
            dataKey="q50"
            type={lang.curve}
            stroke="var(--chart-fan)"
            strokeWidth={lang.line}
            strokeDasharray={lang.fixtureDash}
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
      <div className="gf-axis-caption">{axisClockCaption(domain[0], domain[1])}</div>
    </div>
  )
}

// ---------------------------------------------------------------- one-bar mix (the site's generation bar)

export interface MixMean {
  key: string
  label: string
  gw: number
}

export function meanMix(rows: MixRow[]): MixMean[] {
  const n = rows.length || 1
  return FUEL_BANDS.map((b) => ({ key: b.key, label: b.label, gw: rows.reduce((s, r) => s + (r[b.key] ?? 0), 0) / n }))
}

/**
 * One horizontal stacked bar of mean GW by fuel, labelled above in two
 * staggered rows like the site's "Great Britain's generation" bar. Fuels under
 * 6% of the total are named in the line beneath instead of labelled.
 */
export function MixBar({ means }: { means: MixMean[] }) {
  const pos = means.filter((m) => m.gw > 0.005)
  const total = pos.reduce((s, m) => s + m.gw, 0)
  const scale = total || 1
  const ticks = niceTicks(0, total, 5).ticks.filter((t) => t < total * 0.92)
  let acc = 0
  let row = 0
  const segs = pos.map((m) => {
    const start = acc
    acc += m.gw
    const share = m.gw / total
    const labelled = share >= 0.06
    const seg = { ...m, start, share, labelled, row: labelled ? row % 2 : -1 }
    if (labelled) row += 1
    return seg
  })
  const small = segs.filter((s) => !s.labelled)
  const negs = means.filter((m) => m.gw < -0.005)
  const pct = (v: number) => `${(v / scale) * 100}%`
  return (
    <figure className="i-mixbar">
      <div className="i-mixbar-labels">
        {segs
          .filter((s) => s.labelled)
          .map((s) => {
            const atEnd = s.start / scale > 0.72
            return (
              <span
                key={s.key}
                className={`i-mixbar-label is-row${s.row}${atEnd ? ' is-end' : ''}`}
                style={atEnd ? { right: `${(1 - (s.start + s.gw) / scale) * 100}%` } : { left: pct(s.start) }}
              >
                <b>{s.label}</b>
                {`${fmt1(s.gw)} GW, ${Math.round(s.share * 100)}%`}
              </span>
            )
          })}
      </div>
      <div className="i-mixbar-bar" role="img" aria-label={segs.map((s) => `${s.label} ${fmt1(s.gw)} GW`).join(', ')}>
        {segs.map((s) => (
          <span
            key={s.key}
            title={`${s.label}: ${fmt1(s.gw)} GW, ${Math.round(s.share * 100)}%`}
            style={{ left: pct(s.start), width: pct(s.gw), background: fuelVar(s.key) }}
          />
        ))}
      </div>
      <div className="i-mixbar-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: pct(t) }}>
            {fmt0(t)}
          </span>
        ))}
        <span className="is-total" style={{ left: '100%' }}>
          {fmt1(total)} GW
        </span>
      </div>
      <figcaption className="i-mixbar-rest">
        {small.length > 0 && <>Also {small.map((s) => `${s.label} ${fmt1(s.gw)} GW`).join(', ')}. </>}
        {negs.map((m) => `${m.label} averaged ${fmt1(m.gw).replace('-', '−')} GW, below zero and not drawn. `)}
        Positive parts sum to {fmt1(total)} GW.
      </figcaption>
    </figure>
  )
}
