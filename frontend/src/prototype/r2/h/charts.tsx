/**
 * Slot h chart kit: the site's paper-ground chart language (petrol line,
 * rule-coloured grid, ink zero line, chartreuse highlight bands, ring markers
 * with labelled extremes). Annotations are drawn in the chart's own
 * coordinate space through Recharts' scale hooks, so they stay on the data at
 * any width.
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
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ZIndexLayer,
  usePlotArea,
  useXAxisScale,
  useYAxisScale,
} from 'recharts'
import { TooltipBox, niceTicks, type PriceRow } from '../../../design/charts'
import { FUEL_BANDS, fuelVar, totalGeneration, type MixRow } from '../../../design/fuels'
import { HALF_HOUR, axisClockCaption, clock, dayLabel, halfHourWindow, londonMidnight, ukTimeTicks } from '../../../design/time'
import {
  clocker,
  gw,
  mw,
  mwh,
  pct,
  plain,
  price,
  shareOf,
  stackTop,
  windowShares,
  withGaps,
  type FanPoint,
  type MixStory,
  type PriceStory,
  type WindStory,
} from './annotate'

const QH = HALF_HOUR / 2
const DAY = 86400e3
const FONT = { fill: 'var(--chart-tick)', fontSize: 12.5, fontFamily: 'var(--font-ui)' }

interface ActivePayload<T> {
  active?: boolean
  payload?: readonly { payload?: T }[]
}

// ---------------------------------------------------------------- day axis

/**
 * Multi-day windows label each London day at its midpoint (the site's
 * centred day labels) and mark midnights with ink ticks; a day or less uses
 * the shared three-hourly clock ticks.
 */
function useDayAxis(d0: number, d1: number) {
  return useMemo(() => {
    const base = ukTimeTicks(d0, d1)
    const spanDays = (d1 - d0) / DAY
    if (spanDays <= 1.5) return { ticks: base.ticks, format: base.format, midnights: base.midnights }
    const noons: number[] = []
    for (let m = londonMidnight(d0); m <= d1; ) {
      const next = londonMidnight(m + 26 * 3600e3)
      const noon = (m + next) / 2
      if (noon >= d0 && noon <= d1) noons.push(noon)
      m = next
    }
    const step = spanDays > 45 ? 7 : spanDays > 16 ? 3 : 1
    return { ticks: noons.filter((_, i) => i % step === 0), format: dayLabel, midnights: base.midnights }
  }, [d0, d1])
}

function DayMarks({ midnights, ticks }: { midnights: number[]; ticks: boolean }) {
  const xs = useXAxisScale()
  const plot = usePlotArea()
  if (!xs || !plot) return null
  const xsIn = midnights
    .map((m) => xs(m))
    .filter((x): x is number => x !== undefined && x > plot.x + 1 && x < plot.x + plot.width - 1)
  const bottom = plot.y + plot.height
  return (
    <>
      <ZIndexLayer zIndex={-90}>
        <g aria-hidden="true">
          {xsIn.map((x) => (
            <line key={x} x1={x} x2={x} y1={plot.y} y2={bottom} stroke="var(--chart-grid-strong)" strokeDasharray="2 3" />
          ))}
        </g>
      </ZIndexLayer>
      {ticks && (
        <ZIndexLayer zIndex={500}>
          <g aria-hidden="true">
            {xsIn.map((x) => (
              <line key={x} x1={x} x2={x} y1={bottom} y2={bottom + 7} stroke="var(--chart-baseline)" />
            ))}
          </g>
        </ZIndexLayer>
      )}
    </>
  )
}

function UnitLabel({ text }: { text: string }) {
  const plot = usePlotArea()
  if (!plot) return null
  return (
    <ZIndexLayer zIndex={500}>
      <text x={plot.x - 8} y={plot.y - 12} textAnchor="end" className="h-unit">
        {text}
      </text>
    </ZIndexLayer>
  )
}

// ---------------------------------------------------------------- annotations

export interface Note {
  t: number
  /** Value in the chart's y units; omitted for a band note (no ring). */
  y?: number
  text: string
  /** Beside notes: lift (negative) or drop the label off the ring's level, px. */
  dy?: number
}

const textWidth = (s: string) => s.length * 7.1

/**
 * Rail notes: each ring gets a leader up into a label rail above the plot. A
 * note without `y` names a highlight band and carries a band swatch instead.
 * Placement is a small exhaustive search (there are at most a handful of
 * notes): no two labels in a row overlap, and no leader crosses a label.
 */
interface Slot {
  row: number
  ext: [number, number]
  leader: number | null
  end: boolean
  cost: number
}

function railSlots(n: Note, x: number, plot: { x: number; width: number }): Slot[] {
  const w = textWidth(n.text) + (n.y === undefined ? 14 : 0)
  const preferEnd = x > plot.x + plot.width * 0.6
  const out: Slot[] = []
  for (let row = 0; row < 3; row++) {
    for (const end of [preferEnd, !preferEnd]) {
      const ext: [number, number] = n.y === undefined ? (end ? [x - 6 - w, x - 6] : [x, x + w]) : end ? [x - 8 - w, x + 2] : [x - 2, x + 8 + w]
      if (ext[0] < plot.x - 40 || ext[1] > plot.x + plot.width + 16) continue
      out.push({ row, ext, leader: n.y === undefined ? null : x, end, cost: row * 10 + (end === preferEnd ? 0 : 3) })
    }
  }
  return out
}

function compatible(a: Slot, b: Slot): boolean {
  if (a.row === b.row && a.ext[0] < b.ext[1] + 12 && a.ext[1] > b.ext[0] - 12) return false
  const crosses = (lead: Slot, label: Slot) => lead.leader !== null && label.row < lead.row && lead.leader > label.ext[0] - 5 && lead.leader < label.ext[1] + 5
  return !crosses(a, b) && !crosses(b, a)
}

function placeRail(options: Slot[][]): Slot[] | null {
  let best: Slot[] | null = null
  let bestCost = Infinity
  const walk = (i: number, chosen: Slot[], cost: number) => {
    if (cost >= bestCost) return
    if (i === options.length) {
      best = [...chosen]
      bestCost = cost
      return
    }
    for (const o of options[i]) if (chosen.every((c) => compatible(c, o))) walk(i + 1, [...chosen, o], cost + o.cost)
  }
  walk(0, [], 0)
  return best
}

function RailNotes({ notes }: { notes: Note[] }) {
  const xs = useXAxisScale()
  const ys = useYAxisScale()
  const plot = usePlotArea()
  if (!xs || !ys || !plot) return null
  const rowY = (i: number) => plot.y - 12 - i * 18
  const located = notes.map((n) => ({ n, x: xs(n.t) })).filter((p): p is { n: Note; x: number } => p.x !== undefined)
  // Drop the least important notes (listed last) until the rail can hold the rest.
  let kept = located
  let slots = placeRail(kept.map(({ n, x }) => railSlots(n, x, plot)))
  while (!slots && kept.length > 1) {
    kept = kept.slice(0, -1)
    slots = placeRail(kept.map(({ n, x }) => railSlots(n, x, plot)))
  }
  if (!slots) return null
  const placed = slots
  return (
    <ZIndexLayer zIndex={700}>
      <g className="h-note">
        {kept.map(({ n, x }, i) => {
          const { row, end, ext } = placed[i]
          const ty = rowY(row)
          if (n.y === undefined)
            return (
              <g key={`${n.t}-${n.text}`}>
                <rect x={ext[0]} y={ty - 10} width={10} height={10} fill="var(--band-solid)" />
                <text x={ext[0] + 14} y={ty}>
                  {n.text}
                </text>
              </g>
            )
          const ry = ys(n.y) ?? plot.y
          return (
            <g key={`${n.t}-${n.text}`}>
              <line x1={x} x2={x} y1={ry - 4} y2={ty + 4} className="h-leader" />
              <circle cx={x} cy={ry} r={4} className="h-ring" />
              <text x={end ? x - 7 : x + 7} y={ty} textAnchor={end ? 'end' : 'start'}>
                {n.text}
              </text>
            </g>
          )
        })}
      </g>
    </ZIndexLayer>
  )
}

/** Beside notes: ring on the point, label on the same level, on the roomier side. */
function BesideNotes({ notes }: { notes: Note[] }) {
  const xs = useXAxisScale()
  const ys = useYAxisScale()
  const plot = usePlotArea()
  if (!xs || !ys || !plot) return null
  const boxes: { x0: number; x1: number; y: number }[] = []
  return (
    <ZIndexLayer zIndex={700}>
      <g className="h-note">
        {notes.map((n) => {
          const x = xs(n.t)
          const y = n.y === undefined ? undefined : ys(n.y)
          if (x === undefined || y === undefined) return null
          const end = x > plot.x + plot.width * 0.6
          const w = textWidth(n.text)
          const x0 = end ? x - 10 - w : x + 10
          let ty = Math.min(Math.max(y + 4.5 + (n.dy ?? 0), plot.y + 11), plot.y + plot.height - 4)
          for (const b of boxes) if (x0 < b.x1 && x0 + w > b.x0 && Math.abs(ty - b.y) < 16) ty = b.y + (ty > plot.y + plot.height / 2 ? -17 : 17)
          boxes.push({ x0, x1: x0 + w, y: ty })
          return (
            <g key={`${n.t}-${n.text}`}>
              <circle cx={x} cy={y} r={4} className="h-ring" />
              <text x={end ? x - 10 : x + 10} y={ty} textAnchor={end ? 'end' : 'start'}>
                {n.text}
              </text>
            </g>
          )
        })}
      </g>
    </ZIndexLayer>
  )
}

function HighlightBands({ runs }: { runs: { start: number; last: number }[] }) {
  return (
    <>
      {runs.map((r) => (
        <ReferenceArea key={r.start} x1={r.start - QH} x2={r.last + QH} fill="var(--band)" fillOpacity={1} stroke="none" zIndex={-50} ifOverflow="hidden" />
      ))}
    </>
  )
}

// ---------------------------------------------------------------- share of window

export function ShareBar({ rows, onPick, focus }: { rows: MixRow[]; onPick: (k: string | undefined) => void; focus?: string }) {
  const { items, total } = useMemo(() => windowShares(rows), [rows])
  const segs = items.filter((i) => i.share > 0.0005).sort((a, b) => b.mean - a.mean)
  const below = items.filter((i) => i.mean <= -0.05)
  const { ticks } = niceTicks(0, total, 5)
  const step = ticks[1] - ticks[0]
  const axis = ticks.filter((t) => t <= total - step * 0.4)
  return (
    <div className="h-share">
      <div className="h-share-labels" aria-hidden="true">
        {segs.map((s, i) => (
          <span key={s.key} style={{ flexBasis: `${s.share * 100}%` }} className={i === segs.length - 1 ? 'is-last' : undefined}>
            {s.share >= 0.075 && (
              <>
                <b>{s.label}</b>
                <span>
                  {gw(s.mean)}, {pct(s.share)}
                </span>
              </>
            )}
          </span>
        ))}
      </div>
      <div className="h-share-bar">
        {segs.map((s) => (
          <button
            key={s.key}
            type="button"
            style={{ flexBasis: `${s.share * 100}%`, background: fuelVar(s.key) }}
            className={focus === s.key ? 'is-focus' : focus ? 'is-muted' : undefined}
            aria-label={`${s.label}, mean ${gw(s.mean)}, ${pct(s.share)} of the window. Select to chart it on its own.`}
            title={`${s.label}: ${gw(s.mean)}, ${pct(s.share)}`}
            onClick={() => onPick(focus === s.key ? undefined : s.key)}
          />
        ))}
      </div>
      <div className="h-share-axis" aria-hidden="true">
        {axis.map((t) => (
          <span key={t} style={{ left: `${(t / total) * 100}%` }}>
            {plain(t)}
          </span>
        ))}
        <span className="is-total" style={{ left: '100%' }}>
          {gw(total)}
        </span>
      </div>
      {below.length > 0 && (
        <p className="h-share-below">
          Below zero on average, so not in the bar:{' '}
          {below.map((b, i) => (
            <span key={b.key}>
              {i > 0 && ', '}
              {b.label.toLowerCase()} {gw(b.mean)} ({b.key === 'imports' ? 'net export' : 'net pumping'})
            </span>
          ))}
          .
        </p>
      )}
    </div>
  )
}

export function FuelKeyRow({ focus, onPick }: { focus?: string; onPick: (k: string | undefined) => void }) {
  return (
    <ul className="h-key" aria-label="Fuel key, stacked bottom to top. Select a fuel to chart it on its own.">
      {FUEL_BANDS.map((b) => (
        <li key={b.key}>
          <button
            type="button"
            aria-pressed={focus === b.key}
            className={focus === b.key ? 'is-focus' : focus ? 'is-muted' : undefined}
            onClick={() => onPick(focus === b.key ? undefined : b.key)}
          >
            <span className="h-swatch" style={{ background: fuelVar(b.key) }} />
            {b.label}
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------- generation

type Gappy = { t: number } & Record<string, number | null>

export function MixChart({ rows, focus, story, oneDay }: { rows: MixRow[]; focus?: string; story: MixStory; oneDay: boolean }) {
  const data = useMemo(() => withGaps(rows as unknown as Gappy[], (t) => ({ t }) as Gappy), [rows])
  const d0 = rows[0].t
  const d1 = rows[rows.length - 1].t
  const axis = useDayAxis(d0, d1)
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
    return niceTicks(lo, hi * 1.04)
  }, [rows, bands])
  const c = clocker(oneDay)
  const notes: Note[] = []
  const ext = story.fuelExt
  const label = story.fuelLabel
  const ringY = (t: number) => {
    const r = rows.find((x) => x.t === t)
    return r ? (focus ? r[story.fuel] : stackTop(r, story.fuel)) : 0
  }
  if (ext) {
    notes.push({ t: ext.max.t, y: ringY(ext.max.t), text: `${label} peaked at ${gw(ext.max.v)}, ${c.short(ext.max.t)}` })
    notes.push({ t: ext.min.t, y: ringY(ext.min.t), text: `${label} lowest at ${gw(ext.min.v)}, ${c.short(ext.min.t)}` })
  }
  if (story.window) notes.push({ t: story.window.start - QH, text: `Highest ${label.toLowerCase()} share, ${pct(story.window.mean)} over three hours` })

  const renderTip = ({ active, payload }: ActivePayload<Gappy>) => {
    const row = payload?.[0]?.payload as MixRow | undefined
    if (!active || !row || row.nuclear === undefined) return null
    const tipRows = [...bands].reverse().map((b) => ({ key: b.key, color: fuelVar(b.key), label: b.label, value: gw(row[b.key]) }))
    if (focus) {
      const s = shareOf(row, focus)
      if (s !== null) tipRows.push({ key: 'share', color: 'transparent', label: 'Share of generation', value: pct(s) })
    } else tipRows.push({ key: 'total', color: 'transparent', label: 'Total generation', value: gw(totalGeneration(row)) })
    return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows.map((r) => ({ ...r, strong: r.key === 'total' || r.key === 'share' }))} />
  }

  return (
    <div className="h-chart" style={{ height: 420 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 64, right: 16, bottom: 6, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          {story.window && <HighlightBands runs={[story.window]} />}
          <DayMarks midnights={axis.midnights} ticks />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[d0 - QH, d1 + QH]}
            ticks={axis.ticks}
            interval={0}
            tickFormatter={axis.format}
            tick={{ ...FONT, fill: 'var(--ink)', fontSize: 13 }}
            stroke="var(--chart-grid-strong)"
            tickLine={false}
            tickMargin={10}
          />
          <YAxis
            tick={FONT}
            axisLine={false}
            tickLine={false}
            width={48}
            domain={y.domain}
            ticks={y.ticks}
            tickFormatter={(v: number) => plain(v)}
          />
          <UnitLabel text="GW" />
          <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
          {bands.map((b) => (
            <Area
              key={b.key}
              dataKey={focus || !b.signed ? b.key : `${b.key}__pos`}
              stackId={focus ? undefined : 'pos'}
              type="linear"
              fill={fuelVar(b.key)}
              fillOpacity={focus ? 0.3 : 1}
              stroke={focus ? fuelVar(b.key) : 'var(--bg)'}
              strokeWidth={focus ? 2 : 0.75}
              isAnimationActive={false}
              activeDot={false}
            />
          ))}
          {!focus &&
            bands
              .filter((b) => b.signed)
              .map((b) => (
                <Area
                  key={`${b.key}-neg`}
                  dataKey={`${b.key}__neg`}
                  stackId="neg"
                  type="linear"
                  fill={fuelVar(b.key)}
                  fillOpacity={1}
                  stroke="var(--bg)"
                  strokeWidth={0.75}
                  isAnimationActive={false}
                  activeDot={false}
                />
              ))}
          <ReferenceLine y={0} stroke="var(--ink)" strokeWidth={1} zIndex={450} />
          <RailNotes notes={notes} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="h-clock">{axisClockCaption(d0, d1)}</p>
    </div>
  )
}

// ---------------------------------------------------------------- prices

export function PriceNivChart({ rows, story, oneDay }: { rows: PriceRow[]; story: PriceStory; oneDay: boolean }) {
  const data = useMemo(() => withGaps(rows, (t) => ({ t, price: null, sell: null, buy: null, niv: null })), [rows])
  const d0 = rows[0].t
  const d1 = rows[rows.length - 1].t
  const domain: [number, number] = [d0 - QH, d1 + QH]
  const axis = useDayAxis(d0, d1)
  const c = clocker(oneDay)
  const yp = useMemo(() => {
    const v = rows.map((r) => r.price).filter((x): x is number => x !== null)
    return niceTicks(Math.min(0, ...v), Math.max(...v))
  }, [rows])
  const yn = useMemo(() => {
    const v = rows.map((r) => r.niv).filter((x): x is number => x !== null)
    return niceTicks(Math.min(0, ...v), Math.max(0, ...v), 3)
  }, [rows])
  const p = story.price
  const priceNotes: Note[] = p
    ? [
        { t: p.max.t, y: p.max.v, text: `Highest ${price(p.max.v)}, ${c.short(p.max.t)}` },
        { t: p.min.t, y: p.min.v, text: `Lowest ${price(p.min.v)}, ${c.short(p.min.t)}` },
      ]
    : []
  const n = story.niv
  const nivNotes: Note[] = n
    ? [
        ...(n.max.v > 0 ? [{ t: n.max.t, y: n.max.v, text: `${mwh(n.max.v)} short, ${c.short(n.max.t)}` }] : []),
        ...(n.min.v < 0 ? [{ t: n.min.t, y: n.min.v, text: `${mwh(-n.min.v)} long, ${c.short(n.min.t)}` }] : []),
      ]
    : []

  const renderTip = ({ active, payload }: ActivePayload<PriceRow>) => {
    const row = payload?.[0]?.payload
    if (!active || !row || row.price === null) return null
    const tipRows = [{ key: 'p', color: 'var(--chart-price)', label: 'System price', value: price(row.price) }]
    if (row.niv !== null)
      tipRows.push({
        key: 'n',
        color: row.niv >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)',
        label: row.niv >= 0 ? 'NIV, system short' : 'NIV, system long',
        value: mwh(row.niv),
      })
    return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows} />
  }
  const x = (showTicks: boolean) => (
    <XAxis
      dataKey="t"
      type="number"
      scale="time"
      domain={domain}
      ticks={axis.ticks}
      interval={0}
      tickFormatter={axis.format}
      tick={showTicks ? { ...FONT, fill: 'var(--ink)', fontSize: 13 } : false}
      stroke="var(--chart-grid-strong)"
      tickLine={false}
      tickMargin={10}
      height={showTicks ? 30 : 2}
    />
  )

  return (
    <div className="h-chart-stack">
      <div className="h-chart" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 30, right: 16, bottom: 4, left: 0 }} syncId="h-prices">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <HighlightBands runs={story.negative} />
            <DayMarks midnights={axis.midnights} ticks={false} />
            {x(false)}
            <YAxis tick={FONT} axisLine={false} tickLine={false} width={56} domain={yp.domain} ticks={yp.ticks} tickFormatter={(v: number) => plain(v)} />
            <UnitLabel text="£/MWh" />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            <ReferenceLine y={0} stroke="var(--ink)" zIndex={450} />
            <Line
              dataKey="price"
              type="linear"
              stroke="var(--chart-price)"
              strokeWidth={2}
              strokeLinejoin="round"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, fill: 'var(--chart-price)', stroke: 'var(--bg)', strokeWidth: 2 }}
            />
            <BesideNotes notes={priceNotes} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="h-niv-key">
        <span>Net imbalance volume</span>
        <span>
          <i style={{ background: 'var(--chart-niv-short)' }} />
          System short, above zero
        </span>
        <span>
          <i style={{ background: 'var(--chart-niv-long)' }} />
          System long, below zero
        </span>
      </div>
      <div className="h-chart" style={{ height: 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 26, right: 16, bottom: 6, left: 0 }} syncId="h-prices" barCategoryGap={0}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <HighlightBands runs={story.negative} />
            <DayMarks midnights={axis.midnights} ticks />
            {x(true)}
            <YAxis tick={FONT} axisLine={false} tickLine={false} width={56} domain={yn.domain} ticks={yn.ticks} tickFormatter={(v: number) => plain(v)} />
            <UnitLabel text="MWh" />
            <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
            <ReferenceLine y={0} stroke="var(--ink)" zIndex={450} />
            <Bar dataKey="niv" isAnimationActive={false} maxBarSize={5}>
              {data.map((r) => (
                <Cell key={r.t} fill={(r.niv ?? 0) >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)'} />
              ))}
            </Bar>
            <BesideNotes notes={nivNotes} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="h-clock">{axisClockCaption(d0, d1)}</p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- wind fan

type FanRow = FanPoint & { q25: number; q75: number; b90: [number, number]; b80: [number, number]; b50: [number, number] }

function EndLabels({ row, keys }: { row: FanRow; keys: { k: 'q10' | 'q50' | 'q90'; label: string }[] }) {
  const xs = useXAxisScale()
  const ys = useYAxisScale()
  if (!xs || !ys) return null
  const x = xs(row.t)
  if (x === undefined) return null
  return (
    <ZIndexLayer zIndex={700}>
      <g className="h-endlabel">
        {keys.map(({ k, label }) => {
          const y = ys(row[k])
          return y === undefined ? null : (
            <text key={k} x={x + 10} y={y + 4}>
              {label}
            </text>
          )
        })}
      </g>
    </ZIndexLayer>
  )
}

export function WindFan({ rows, story }: { rows: FanRow[]; story: WindStory }) {
  const d0 = rows[0].t
  const d1 = rows[rows.length - 1].t
  const axis = useDayAxis(d0, d1 + HALF_HOUR)
  const yf = useMemo(() => {
    const v = rows.flatMap((r) => [r.q05, r.q95, r.actual ?? r.q50])
    return niceTicks(Math.min(0, ...v), Math.max(...v))
  }, [rows])
  const notes: Note[] = []
  const worst = [...story.excursions].sort((a, b) => b.worst.v - a.worst.v).slice(0, 2)
  for (const e of worst) {
    const r = rows.find((x) => x.t === e.worst.t)
    if (r?.actual != null) notes.push({ t: r.t, y: r.actual, text: `Actual ${mw(e.worst.v)} ${e.side} the band, ${clock(r.t)}` })
  }
  if (story.lastActual && !notes.some((n) => n.t === story.lastActual!.t))
    notes.push({ t: story.lastActual.t, y: story.lastActual.v, dy: -18, text: `Last settled actual ${mw(story.lastActual.v)}, ${clock(story.lastActual.t)}` })

  const renderTip = ({ active, payload }: ActivePayload<FanRow>) => {
    const row = payload?.[0]?.payload
    if (!active || !row) return null
    return (
      <TooltipBox
        title={`SP ${row.sp}, ${halfHourWindow(row.t)}`}
        rows={[
          { key: 'a', color: 'var(--chart-actual)', label: 'Actual', value: row.actual === null ? 'pending' : mw(row.actual), strong: false },
          { key: 'm', color: 'var(--chart-fan)', label: 'Median forecast', value: mw(row.q50), dashed: true },
          { key: '80', color: 'var(--chart-fan-soft)', label: '80% band', value: `${plain(row.q10)} to ${plain(row.q90)}` },
          { key: '90', color: 'var(--chart-fan-soft)', label: '90% band', value: `${plain(row.q05)} to ${plain(row.q95)}` },
        ]}
      />
    )
  }
  return (
    <div className="h-chart" style={{ height: 420 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 30, right: 64, bottom: 6, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <HighlightBands runs={story.excursions} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[d0 - QH, d1 + QH]}
            ticks={axis.ticks}
            interval={0}
            tickFormatter={axis.format}
            tick={{ ...FONT, fill: 'var(--ink)', fontSize: 13 }}
            stroke="var(--chart-grid-strong)"
            tickLine={false}
            tickMargin={10}
          />
          <YAxis tick={FONT} axisLine={false} tickLine={false} width={56} domain={yf.domain} ticks={yf.ticks} tickFormatter={(v: number) => plain(v)} />
          <UnitLabel text="MW" />
          <Tooltip content={renderTip} cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }} isAnimationActive={false} />
          <Area dataKey="b90" type="linear" fill="var(--chart-fan)" fillOpacity={0.1} stroke="none" isAnimationActive={false} activeDot={false} />
          <Area dataKey="b80" type="linear" fill="var(--chart-fan)" fillOpacity={0.13} stroke="none" isAnimationActive={false} activeDot={false} />
          <Area dataKey="b50" type="linear" fill="var(--chart-fan)" fillOpacity={0.16} stroke="none" isAnimationActive={false} activeDot={false} />
          {(['q10', 'q90'] as const).map((k) => (
            <Line key={k} dataKey={k} type="linear" stroke="var(--chart-fan)" strokeOpacity={0.6} strokeWidth={1} dot={false} activeDot={false} isAnimationActive={false} />
          ))}
          <Line dataKey="q50" type="linear" stroke="var(--chart-fan)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} activeDot={false} />
          <Line
            dataKey="actual"
            type="linear"
            stroke="var(--chart-actual)"
            strokeWidth={2}
            strokeLinejoin="round"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: 'var(--chart-actual)', stroke: 'var(--bg)', strokeWidth: 2 }}
          />
          <EndLabels
            row={rows[rows.length - 1]}
            keys={[
              { k: 'q90', label: 'p90' },
              { k: 'q50', label: 'median' },
              { k: 'q10', label: 'p10' },
            ]}
          />
          <BesideNotes notes={notes} />
        </ComposedChart>
      </ResponsiveContainer>
      <p className="h-clock">{axisClockCaption(d0, d1)}, settlement periods in the tooltip</p>
    </div>
  )
}

export type { FanRow }
