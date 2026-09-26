import { useMemo, useState, type ReactNode } from 'react'
import { TooltipBox, fmt0, fmt1, niceTicks } from '../../../design/charts'
import { FUEL_BANDS, fuelVar, totalGeneration, type MixRow } from '../../../design/fuels'
import { HALF_HOUR, clock, dayLabel, halfHourWindow, londonMidnight } from '../../../design/time'
import { gutOf, plOf, prOf, rowAt, runsOf, scaleX, scaleY, spread, type Interval } from './geo'

/**
 * Above ground. Hand-drawn SVG charts on the same x-scale as the strata, so
 * the plot's bottom edge is the hatched ground line and a gap in the rows is
 * blank paper directly over a void. Each half-hourly row covers [t, t+30):
 * interior points sit at the half-hour's middle and every run is extended to
 * its outer edges, so the drawing ends exactly where the rows end.
 */

export const TOP = 30
export type TipRow = Parameters<typeof TooltipBox>[0]['rows'][number]
const HALF = HALF_HOUR / 2

export interface Hover {
  px: number
  t: number
}

/** Points for one run: interval edges at both ends, midpoints inside. */
function runXs<T extends { t: number }>(run: T[]): { t: number; row: T }[] {
  const first = run[0]
  const last = run[run.length - 1]
  return [{ t: first.t, row: first }, ...run.map((r) => ({ t: r.t + HALF, row: r })), { t: last.t + HALF_HOUR, row: last }]
}

function linePath(pts: [number, number][]): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
}

function areaPath(top: [number, number][], bottom: [number, number][]): string {
  return `${linePath(top)} ${[...bottom].reverse().map(([x, y]) => `L${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')} Z`
}

export function YAxis({ ticks, y, width, unit, fmt = fmt0, top = TOP, bottom }: { ticks: number[]; y: (v: number) => number; width: number; unit: string; fmt?: (v: number) => string; top?: number; bottom?: number }) {
  const hi = width - prOf(width)
  const PL = plOf(width)
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PL} x2={hi} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
          <text x={PL - 10} y={bottom !== undefined && y(t) > bottom - 8 ? y(t) - 3 : y(t) + 4} textAnchor="end" className="g-tick">
            {fmt(t)}
          </text>
        </g>
      ))}
      <text x={PL - 10} y={top - 14} textAnchor="end" className="g-unit">
        {unit}
      </text>
    </g>
  )
}

export function DayRules({ domain, width, top, bottom }: { domain: Interval; width: number; top: number; bottom: number }) {
  const { x } = scaleX(width, domain)
  const lines: number[] = []
  for (let m = londonMidnight(domain[0] + HALF_HOUR); m < domain[1]; m = londonMidnight(m + 26 * 3600e3)) if (m > domain[0]) lines.push(m)
  return (
    <g>
      {lines.map((m) => (
        <line key={m} x1={x(m)} x2={x(m)} y1={top} y2={bottom} stroke="var(--chart-grid)" strokeWidth="1" />
      ))}
    </g>
  )
}

/** Pointer layer: bisects the rows and reports the hovered half-hour. */
export function useHover<T extends { t: number }>(rows: T[], width: number, domain: Interval, onCursor?: (t: number | null) => void) {
  const [hover, setHover] = useState<(Hover & { row?: T }) | null>(null)
  const { x, t: tOf } = scaleX(width, domain)
  const move = (e: React.PointerEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const px = e.clientX - box.left
    const t = tOf(px)
    const row = rowAt(rows, t)
    const slot = row ? row.t : domain[0] + Math.floor((t - domain[0]) / HALF_HOUR) * HALF_HOUR
    setHover({ px: x(slot + HALF), t: slot, row })
    onCursor?.(slot + HALF)
  }
  const leave = () => {
    setHover(null)
    onCursor?.(null)
  }
  return { hover, move, leave }
}

export function TipAt({ hover, width, top, children }: { hover: Hover | null; width: number; top: number; children: ReactNode }) {
  if (!hover) return null
  const hi = width - prOf(width)
  const left = hover.px > hi - 250 ? hover.px - 16 - 236 : hover.px + 16
  return (
    <div className="g-tip-at" style={{ left, top }}>
      {children}
    </div>
  )
}

export function VoidTip({ t }: { t: number }) {
  return <TooltipBox title={halfHourWindow(t)} rows={[]} note="No rows in the local catalogue for this half-hour." />
}

// ---------------------------------------------------------------- generation

const TEXTURED = new Set(['wind', 'gas', 'imports', 'biomass'])

export function MixChart({
  rows,
  domain,
  width,
  height,
  focus,
  onFocus,
  onCursor,
}: {
  rows: MixRow[]
  domain: Interval
  width: number
  height: number
  focus?: string
  onFocus: (k: string | undefined) => void
  onCursor?: (t: number | null) => void
}) {
  const pr = prOf(width)
  const hi = width - pr
  const PL = plOf(width)
  const colW = pr - gutOf(width) - 26
  const { x } = scaleX(width, domain)
  const bottom = height - 3
  const bands = focus ? FUEL_BANDS.filter((b) => b.key === focus) : FUEL_BANDS

  /** Positive parts stack up from zero, negative parts stack down from it, so a band that
   *  changes sign between half-hours never sweeps across the stack. */
  const stackOf = (row: MixRow, set: typeof FUEL_BANDS) => {
    let pos = 0
    let neg = 0
    const up: Record<string, [number, number]> = {}
    const down: Record<string, [number, number]> = {}
    for (const b of set) {
      const v = row[b.key] ?? 0
      const p = Math.max(v, 0)
      const n = Math.min(v, 0)
      up[b.key] = [pos, pos + p]
      down[b.key] = [neg + n, neg]
      pos += p
      neg += n
    }
    return { up, down, pos, neg }
  }

  const fullScale = useMemo(() => {
    let lo = 0
    let top = 0
    for (const r of rows) {
      const s = stackOf(r, FUEL_BANDS)
      top = Math.max(top, s.pos)
      lo = Math.min(lo, s.neg)
    }
    return niceTicks(lo, top)
  }, [rows])
  const scale = useMemo(() => {
    if (!focus) return fullScale
    let lo = 0
    let top = 0
    for (const r of rows) {
      top = Math.max(top, r[focus] ?? 0)
      lo = Math.min(lo, r[focus] ?? 0)
    }
    return niceTicks(lo, top)
  }, [rows, focus, fullScale])
  const y = scaleY(scale.domain, TOP, bottom)
  const yFull = scaleY(fullScale.domain, TOP, bottom)

  const runs = useMemo(() => runsOf(rows), [rows])
  const paths = useMemo(
    () =>
      runs.flatMap((run, ri) => {
        const pts = runXs(run).map((p) => ({ px: x(p.t), s: stackOf(p.row, bands) }))
        return bands.flatMap((b) =>
          (['up', 'down'] as const)
            .filter((side) => run.some((r) => (side === 'up' ? (r[b.key] ?? 0) > 0.0005 : (r[b.key] ?? 0) < -0.0005)))
            .map((side) => {
              const top = pts.map((p): [number, number] => [p.px, y(p.s[side][b.key][1])])
              const base = pts.map((p): [number, number] => [p.px, y(p.s[side][b.key][0])])
              return { key: `${ri}-${b.key}-${side}`, band: b.key, d: areaPath(top, base) }
            }),
        )
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runs, width, domain[0], domain[1], focus, scale.domain[0], scale.domain[1]],
  )
  const focusLines = useMemo(
    () =>
      focus
        ? runs.map((run, ri) => ({
            key: ri,
            d: linePath(runXs(run).map((p): [number, number] => [x(p.t), y(p.row[focus] ?? 0)])),
          }))
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runs, focus, width, domain[0], domain[1], scale.domain[0], scale.domain[1]],
  )
  const hasNeg = scale.domain[0] < 0

  const latest = rows.at(-1)
  const labels = useMemo(() => {
    if (!latest) return []
    const s = stackOf(latest, FUEL_BANDS)
    const order = [...FUEL_BANDS].reverse()
    const targets = order.map((b) => {
      const seg = (latest[b.key] ?? 0) < 0 ? s.down[b.key] : s.up[b.key]
      return yFull((seg[0] + seg[1]) / 2)
    })
    const placed = spread(targets, 18, TOP + 26, height - 10)
    return order.map((b, i) => ({ band: b, target: targets[i], y: placed[i], value: latest[b.key] ?? 0 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latest, height, fullScale.domain[0], fullScale.domain[1]])
  const endX = latest ? x(latest.t + HALF_HOUR) : hi

  const { hover, move, leave } = useHover(rows, width, domain, onCursor)
  const tip = hover?.row
    ? (() => {
        const row = hover.row
        const tipRows: TipRow[] = [...bands].reverse().flatMap((b): TipRow[] => {
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
      })()
    : hover
      ? <VoidTip t={hover.t} />
      : null

  return (
    <div className="g-plot" style={{ height }}>
      <svg width={width} height={height} className="g-plot-svg" aria-hidden="true">
        <YAxis ticks={scale.ticks} y={y} width={width} unit="GW" fmt={(v) => fmt0(v)} bottom={bottom} />
        <DayRules domain={domain} width={width} top={TOP} bottom={height} />
        {paths.map((p) => (
          <g key={p.key}>
            <path
              d={p.d}
              fill={fuelVar(p.band)}
              fillOpacity={focus ? 0.2 : 1}
              stroke={focus ? 'none' : 'var(--chart-surface)'}
              strokeWidth={0.6}
              strokeLinejoin="round"
            />
            {!focus && TEXTURED.has(p.band) && <path d={p.d} fill={`url(#g-f-${p.band})`} opacity="0.45" />}
          </g>
        ))}
        {focusLines.map((l) => (
          <path key={l.key} d={l.d} fill="none" stroke={fuelVar(focus ?? '')} strokeWidth="2" strokeLinejoin="round" />
        ))}
        {hasNeg && <line x1={PL} x2={hi} y1={y(0)} y2={y(0)} stroke="var(--g-ground)" strokeWidth="1" />}
        {!focus &&
          labels.map((l) => (
            <path
              key={l.band.key}
              d={`M${endX + 3} ${l.target.toFixed(1)} H${hi + 4} L${hi + 14} ${l.y.toFixed(1)}`}
              fill="none"
              stroke="var(--g-leader)"
              strokeWidth="0.8"
            />
          ))}
        {hover && <line x1={hover.px} x2={hover.px} y1={TOP} y2={height} stroke="var(--chart-cursor)" strokeWidth="1" />}
        <rect x={PL} y={TOP} width={Math.max(0, hi - PL)} height={height - TOP} fill="transparent" onPointerMove={move} onPointerLeave={leave} />
      </svg>
      {latest && (
        <p className="g-col-title" style={{ left: hi + 18, top: TOP - 24 }}>
          GW at {clock(latest.t)}, {dayLabel(latest.t)}
        </p>
      )}
      <ul className="g-fuel-labels" aria-label="Fuel key: select a fuel to see it on its own">
        {labels.map((l) => (
          <li key={l.band.key} style={{ top: l.y - 9, left: hi + 18, width: colW }}>
            <button
              type="button"
              className={focus === l.band.key ? 'is-focus' : focus ? 'is-muted' : undefined}
              aria-pressed={focus === l.band.key}
              onClick={() => onFocus(focus === l.band.key ? undefined : l.band.key)}
            >
              <span className="g-swatch" style={{ background: fuelVar(l.band.key) }} />
              <span className="g-fuel-name">{l.band.label}</span>
              <span className="g-fuel-value">{fmt1(l.value)}</span>
            </button>
          </li>
        ))}
      </ul>
      <TipAt hover={hover} width={width} top={TOP + 6}>
        {tip}
      </TipAt>
    </div>
  )
}
