/**
 * Series on the UK clock, in the chart language of DESIGN §6, composed only
 * from the shared theme (`design/chartTheme.ts`, `design/charts.tsx`): one or
 * more panels stacked on a shared clock, each with its unit caption above
 * the value axis, day rules at London midnights, a horizontal grid, the
 * compact tooltip naming the period, labelled extremes, and the chartreuse
 * band on a picked day. Only the lowest panel carries the time labels and
 * the clock caption.
 *
 * Gaps stay gaps: the rows endpoint sends a null for every missing step, and
 * lines and stacks break there (`connectNulls: false`). A series on a coarser
 * or irregular clock than the panel's other series (an hourly area among
 * quarter-hourly ones) has no field at the other times; so that its line
 * doesn't break at every one of them, it is drawn through a display-only
 * field that runs straight between its own consecutive held points, which is
 * the segment the chart would draw anyway. Tooltips and tables read its own
 * points only; that field never leaves this file.
 */
import { useMemo } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartFrame, DayRules, Extreme, HighlightBand, SelectionEdges, TooltipBox, ZeroLine, type TipRow } from '../../design/charts'
import { CHART, CURSOR, GRID, bandProps, extremeAnchor, lineProps, timeAxis, valueAxis } from '../../design/chartTheme'
import { fmtN, niceTicks, stepDigits } from '../../design/format'
import { DAY_MS, axisClockCaption, clock, dayTick, londonMidnight, nextLondonMidnight, ukTimeTicks } from '../../design/time'
import type { Mark } from '../define'
import { extremesOf, periodName, runsBelowZero, seriesId, type SeriesDef, type Settlement, type WideRow } from './seriesModel'
import type { DisplayUnit } from './units'

export interface ChartPanel {
  rows: WideRow[]
  /** Drawn in this order: for a stack, bottom first. */
  series: SeriesDef[]
  mark: Mark
  unit: DisplayUnit
  /** The step between this panel's rows, for tooltip titles; null when irregular. */
  stepMs: number | null
  height?: number
  zero?: boolean
  /** Label this series' highest and lowest values. */
  extremes?: SeriesDef | null
  /** The rows are time-bucket means: the tooltip says so. */
  bucketed?: boolean
  /** Settlement periods by time, where the rows carry them: the tooltip names the period with its number. */
  settlement?: Map<number, Settlement> | null
  /** Band this series' runs below zero with the highlight band. */
  belowZero?: SeriesDef | null
  /** A fixed width for the value axis, so stacked charts in different panels line up. */
  axisWidth?: number
}

type PanelRow = WideRow

interface TipProps {
  active?: boolean
  label?: string | number
  payload?: readonly { payload?: PanelRow }[]
}

interface ClickState {
  activeTooltipIndex?: number | string | null
}

const drawField = (d: SeriesDef) => `${d.field}__d`
const posField = (d: SeriesDef) => `${d.field}__p`
const negField = (d: SeriesDef) => `${d.field}__n`

/** A series is sparse in these rows when some row doesn't carry its field at all. */
function isSparse(rows: WideRow[], d: SeriesDef): boolean {
  return rows.some((r) => !(d.field in r))
}

/**
 * The panel's rows with the display fields it draws: a sparse series' straight
 * runs between its own held points, and a signed stack's parts above and
 * below zero.
 */
function prepare(rows: WideRow[], series: SeriesDef[], mark: Mark): PanelRow[] {
  const out = rows.map((r) => ({ ...r }))
  for (const d of series) {
    if (isSparse(rows, d)) {
      let prev: { i: number; v: number } | null = null
      out.forEach((r, i) => {
        const v = r[d.field]
        if (v === undefined) return
        if (typeof v === 'number') {
          if (prev) {
            for (let j = prev.i + 1; j < i; j += 1) {
              const frac = (out[j].t - out[prev.i].t) / (r.t - out[prev.i].t)
              out[j][drawField(d)] = prev.v + (v - prev.v) * frac
            }
          }
          r[drawField(d)] = v
          prev = { i, v }
        } else {
          r[drawField(d)] = null
          prev = null
        }
      })
    }
    if (mark === 'stacked' && d.signed) {
      for (const r of out) {
        const v = r[d.field]
        r[posField(d)] = typeof v === 'number' ? Math.max(v, 0) : v
        r[negField(d)] = typeof v === 'number' ? Math.min(v, 0) : v
      }
    }
  }
  return out
}

/** A series' own points: the rows that carry its field, as (time, value). */
function ownPoints(rows: WideRow[], d: SeriesDef): { t: number; v: number | null }[] {
  const out: { t: number; v: number | null }[] = []
  for (const r of rows) {
    if (!(d.field in r)) continue
    const v = r[d.field]
    out.push({ t: r.t, v: typeof v === 'number' ? v : null })
  }
  return out
}

/** The usual spacing of a series' own points (the median), which bounds how long one point's value holds. */
function typicalStep(points: { t: number }[]): number {
  const diffs = points.slice(1).map((p, i) => p.t - points[i].t).filter((d) => d > 0).sort((a, b) => a - b)
  return diffs.length ? diffs[Math.floor(diffs.length / 2)] : Infinity
}

/**
 * The value of the latest own point at or before `t`, by binary search, if
 * `t` falls within that point's usual step; otherwise there is no reading.
 */
function valueAt(points: { t: number; v: number | null }[], t: number, step: number): number | null {
  let lo = 0
  let hi = points.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].t <= t) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  if (found < 0 || t - points[found].t >= step) return null
  return points[found].v
}

function scaleOf(rows: WideRow[], series: SeriesDef[], mark: Mark, zero: boolean) {
  let lo = Infinity
  let hi = -Infinity
  for (const r of rows) {
    if (mark === 'stacked') {
      let pos = 0
      let neg = 0
      for (const d of series) {
        const v = r[d.field]
        if (typeof v !== 'number') continue
        if (v >= 0) pos += v
        else neg += v
      }
      lo = Math.min(lo, neg)
      hi = Math.max(hi, pos)
    } else {
      for (const d of series) {
        const v = r[d.field]
        if (typeof v !== 'number') continue
        lo = Math.min(lo, v)
        hi = Math.max(hi, v)
      }
    }
  }
  if (!Number.isFinite(lo)) return niceTicks(0, 1)
  if (zero || mark !== 'line') {
    lo = Math.min(lo, 0)
    hi = Math.max(hi, 0)
  }
  return niceTicks(lo, hi)
}

function whenText(t: number, stepMs: number | null): string {
  return stepMs !== null && stepMs >= DAY_MS ? dayTick(t) : `${dayTick(t)} at ${clock(t)}`
}

function PanelChart({
  panel,
  domain,
  labels,
  focus,
  picked,
  onPick,
  fixture,
  syncId,
}: {
  panel: ChartPanel
  domain: [number, number]
  labels: boolean
  focus?: string
  picked?: number
  onPick?: (midnight: number) => void
  fixture: boolean
  syncId: string
}) {
  const { mark, unit, stepMs } = panel
  const shown = useMemo(() => {
    const only = panel.series.filter((d) => seriesId(d) === focus)
    return only.length ? only : panel.series
  }, [panel.series, focus])
  const focused = shown.length === 1 && panel.series.length > 1
  const stacked = mark === 'stacked' && !focused
  const rows = useMemo(() => prepare(panel.rows, shown, stacked ? 'stacked' : mark), [panel.rows, shown, stacked, mark])
  const sparse = useMemo(() => new Map(shown.map((d) => [d.key, isSparse(panel.rows, d)])), [panel.rows, shown])
  const points = useMemo(
    () =>
      new Map(
        shown.map((d) => {
          const own = ownPoints(panel.rows, d)
          return [d.key, { own, step: typicalStep(own) }] as const
        }),
      ),
    [panel.rows, shown],
  )
  const rowAt = useMemo(() => new Map(panel.rows.map((r) => [r.t, r])), [panel.rows])
  const ticks = useMemo(() => ukTimeTicks(domain[0], domain[1]), [domain])
  const scale = useMemo(() => scaleOf(panel.rows, shown, stacked ? 'stacked' : mark, Boolean(panel.zero)), [panel.rows, shown, stacked, mark, panel.zero])
  const digits = stepDigits(scale.ticks[1] - scale.ticks[0])
  const tickText = (v: number) => fmtN(v, digits)
  const width = panel.axisWidth ?? Math.max(40, 10 + 7 * Math.max(...scale.ticks.map((v) => tickText(v).length)))
  const multiDay = domain[1] - domain[0] > 30 * 3600e3
  const pickable = Boolean(onPick && multiDay)
  const extremesFor = panel.extremes && shown.includes(panel.extremes) ? panel.extremes : null
  const ex = useMemo(() => (extremesFor ? extremesOf(panel.rows, extremesFor) : null), [panel.rows, extremesFor])
  const band = multiDay && picked !== undefined ? ([Math.max(picked, domain[0]), Math.min(nextLondonMidnight(picked), domain[1])] as const) : null
  const belowFor = panel.belowZero && shown.includes(panel.belowZero) ? panel.belowZero : null
  const runs = useMemo(() => (belowFor ? runsBelowZero(panel.rows, belowFor, stepMs) : []), [panel.rows, belowFor, stepMs])
  const dots = stepMs !== null && stepMs >= DAY_MS

  const renderTip = ({ active, label, payload }: TipProps) => {
    const t = typeof label === 'number' ? label : payload?.[0]?.payload?.t
    if (!active || t === undefined) return null
    const order = stacked ? [...shown].reverse() : shown
    const own = (d: SeriesDef) => {
      const p = points.get(d.key)
      if (sparse.get(d.key) && p) return valueAt(p.own, t, p.step)
      const v = rowAt.get(t)?.[d.field]
      return typeof v === 'number' ? v : null
    }
    const values = order.map((d) => ({ d, v: own(d) }))
    const tipRows: TipRow[] = values.map(({ d, v }) => ({ key: d.key, color: d.color, label: d.label, value: v === null ? 'no value' : d.unit.format(v), dashed: fixture && mark === 'line' }))
    const held = values.filter((x) => x.v !== null)
    if (stacked && held.length > 1) {
      const total = held.reduce((s, x) => s + (x.v ?? 0), 0)
      tipRows.push({ key: '__total', color: 'transparent', label: held.some((x) => (x.v ?? 0) < 0) ? 'Net total' : 'Total', value: unit.format(total), strong: true })
    }
    const note = !held.length ? 'Not held locally' : panel.bucketed ? 'Mean over the period' : pickable ? 'Click to select this day' : undefined
    return <TooltipBox title={periodName(t, stepMs, panel.settlement)} rows={held.length ? tipRows : []} note={note} />
  }

  const pick = (s: ClickState | null | undefined) => {
    const i = Number(s?.activeTooltipIndex)
    const row = Number.isInteger(i) ? rows[i] : undefined
    if (onPick && multiDay && row) onPick(londonMidnight(row.t))
  }

  const hasNegative = scale.domain[0] < 0

  return (
    <ChartFrame height={panel.height ?? CHART.height} caption={labels ? axisClockCaption(domain[0], domain[1]) : undefined} pickable={pickable}>
      <ComposedChart data={rows} margin={labels ? CHART.margin : { ...CHART.margin, bottom: 2 }} onClick={pick} syncId={syncId} syncMethod="value" barCategoryGap={0}>
        <CartesianGrid {...GRID} />
        {runs.map((r) => (
          <HighlightBand key={r.start} x1={r.start} x2={Math.min(r.last + (stepMs ?? 0), domain[1])} />
        ))}
        {band && <HighlightBand x1={band[0]} x2={band[1]} />}
        <DayRules midnights={ticks.midnights} />
        <XAxis {...timeAxis(domain, ticks, { labels })} />
        <YAxis {...valueAxis(unit.caption, scale, { width, format: tickText })} />
        <Tooltip content={renderTip} cursor={CURSOR} isAnimationActive={false} />
        {hasNegative && <ZeroLine />}
        {shown.map((d) => {
          const key = sparse.get(d.key) ? drawField(d) : d.field
          if (mark === 'bars') return <Bar key={d.key} dataKey={key} fill={d.color} stackId={stacked ? 'bars' : undefined} isAnimationActive={false} maxBarSize={14} />
          if (mark === 'line' || !stacked) {
            if (mark === 'stacked') return <Area key={d.key} dataKey={key} {...bandProps(d.color, { focused: true })} />
            return <Line key={d.key} dataKey={key} {...lineProps(d.color, { fixture })} dot={dots ? { r: 2.5, fill: d.color, stroke: 'none' } : false} />
          }
          if (d.signed) {
            return [
              <Area key={`${d.key}+`} dataKey={posField(d)} stackId="pos" {...bandProps(d.color)} />,
              <Area key={`${d.key}-`} dataKey={negField(d)} stackId="neg" {...bandProps(d.color)} />,
            ]
          }
          return <Area key={d.key} dataKey={key} stackId="pos" {...bandProps(d.color)} />
        })}
        {band && <SelectionEdges x1={band[0]} x2={band[1]} />}
        {ex && extremesFor && (
          <Extreme x={ex.high.t} y={ex.high.v} anchor={extremeAnchor(ex.high.t, domain)} color={extremesFor.color} text={`${extremesFor.unit.format(ex.high.v)}, highest, ${whenText(ex.high.t, stepMs)}`} />
        )}
        {ex && extremesFor && ex.low.t !== ex.high.t && (
          <Extreme x={ex.low.t} y={ex.low.v} anchor={extremeAnchor(ex.low.t, domain)} below color={extremesFor.color} text={`${extremesFor.unit.format(ex.low.v)}, lowest, ${whenText(ex.low.t, stepMs)}`} />
        )}
      </ComposedChart>
    </ChartFrame>
  )
}

/**
 * Panels top to bottom on one clock (`domain`, from `windowDomain`). Each
 * panel's series share its unit. `focus` draws one series alone where it is
 * found; `picked` marks a day; `onPick` makes a click pick the day under it.
 */
export function SeriesChart({
  panels,
  domain,
  focus,
  picked,
  onPick,
  fixture = false,
  syncId = 'gf-series',
}: {
  panels: ChartPanel[]
  domain: [number, number]
  focus?: string
  picked?: number
  onPick?: (midnight: number) => void
  fixture?: boolean
  syncId?: string
}) {
  const shown = panels.filter((p) => p.series.length > 0)
  return (
    <div className="gf-chart-stack">
      {shown.map((p, i) => (
        <PanelChart key={i} panel={p} domain={domain} labels={i === shown.length - 1} focus={focus} picked={picked} onPick={onPick} fixture={fixture} syncId={syncId} />
      ))}
    </div>
  )
}
