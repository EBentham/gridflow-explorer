import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ukTimeTicks } from '../../../design/time'
import { when, type HPoint, type HSeries } from './series'

/**
 * The masthead landscape. Everything is drawn in pixel space at the
 * measured width, so the line art never stretches. Only the ridge of the
 * chartreuse land is data; hills, pylons, turbines and solar rows are
 * drawing, placed so they never cover the labelled extremes.
 */

export interface MastSpec {
  series: HSeries | null
  /** Formats a horizon value for the extreme labels. */
  fmt: (v: number) => string
  /** Fixture data draws its ridge dashed. */
  dashed?: boolean
  /** Accessible summary of what the horizon is. */
  label: string
}

const H = 184
const GROUND = 160
const TOP = 88
const BOT = 144
const LABEL_Y = 76
const PYLON_S = 0.38

const PYLON =
  'M-18 0 L-5 -96 M18 0 L5 -96 M-5 -96 L-5 -118 M5 -96 L5 -118 M-5 -118 H5 M-14 -28 H14 M-11 -56 H11 M-8 -80 H8 M-30 -66 H30 M-24 -92 H24 M-14 -112 H14'

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(1200)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    setW(el.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

interface Label {
  x: number
  y: number
  value: string
  desc: string
  anchor: 'start' | 'end'
  width: number
}

const estWidth = (value: string, desc: string) => value.length * 10 + 8 + desc.length * 6.6

function frontHills(w: number): string {
  let d = `M0 ${GROUND}`
  for (let x = 0; x <= w + 8; x += 8) {
    const y = 151 - 5 * Math.sin(x / 97) - 3.5 * Math.sin(x / 41 + 1.3)
    d += ` L${x} ${Math.min(y, GROUND - 1).toFixed(1)}`
  }
  return `${d} L${w + 8} ${GROUND} Z`
}

function Turbine({ x, base, turn }: { x: number; base: number; turn: number }) {
  const hub = base - 24
  const blades = [0, 120, 240].map((a) => {
    const r = ((a + turn) * Math.PI) / 180
    return `M${x} ${hub} L${(x + 10.5 * Math.cos(r)).toFixed(1)} ${(hub + 10.5 * Math.sin(r)).toFixed(1)}`
  })
  return (
    <g className="f-turbine">
      <path d={`M${x - 1.3} ${base} L${x - 0.4} ${hub} L${x + 0.4} ${hub} L${x + 1.3} ${base} Z`} className="f-art-fill" />
      <path d={blades.join(' ')} className="f-art-line" strokeWidth={1.4} />
      <circle cx={x} cy={hub} r={1.8} className="f-art-fill" />
    </g>
  )
}

function Wires({ xs }: { xs: number[] }) {
  const s = PYLON_S
  const arms = [
    { y: GROUND - 66 * s, half: 30 * s, sag: 9 },
    { y: GROUND - 92 * s, half: 24 * s, sag: 7 },
  ]
  const d: string[] = []
  for (let i = 0; i < xs.length - 1; i++) {
    for (const a of arms) {
      const x1 = xs[i] + a.half
      const x2 = xs[i + 1] - a.half
      d.push(`M${x1.toFixed(1)} ${a.y.toFixed(1)} Q${((x1 + x2) / 2).toFixed(1)} ${(a.y + a.sag * 2).toFixed(1)} ${x2.toFixed(1)} ${a.y.toFixed(1)}`)
    }
  }
  return <path d={d.join(' ')} fill="none" strokeWidth={0.8} />
}

function Pylons({ xs }: { xs: number[] }) {
  return (
    <>
      {xs.map((x) => (
        <g key={x} transform={`translate(${x.toFixed(1)},${GROUND}) scale(${PYLON_S})`}>
          <path vectorEffect="non-scaling-stroke" d={PYLON} fill="none" strokeWidth={1.2} strokeLinecap="round" />
        </g>
      ))}
    </>
  )
}

function Solar({ x0, n }: { x0: number; n: number }) {
  return (
    <g className="f-solar">
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + i * 17
        return <path key={i} d={`M${x} ${GROUND - 3} L${x + 14} ${GROUND - 3} L${x + 16.5} ${GROUND - 10} L${x + 2.5} ${GROUND - 10} Z`} />
      })}
    </g>
  )
}

export function Mast({ spec, children }: { spec: MastSpec; children: ReactNode }) {
  const [ref, w] = useWidth<HTMLElement>()
  const uid = useId().replace(/:/g, '')
  const { series } = spec

  const geo = useMemo(() => {
    const flat = BOT - 12
    if (!series) {
      return { ridge: [[0, flat] as [number, number], [w, flat] as [number, number]], x: () => 0, y: () => flat, labels: [] as Label[], zeroY: null as number | null, ticks: [] as { x: number; text: string }[] }
    }
    const [d0, d1] = series.domain
    // A skyline, not a bar: the land spans the data's own range, with a
    // floor so the lowest point still reads as ground rather than a gap.
    const span = series.max.v - series.min.v || Math.abs(series.max.v) || 1
    const lo = series.min.v - span * 0.14
    const hi = series.max.v
    const x = (t: number) => ((t - d0) / (d1 - d0)) * w
    const y = (v: number) => BOT - ((v - lo) / (hi - lo)) * (BOT - TOP)
    const mid = (p: HPoint) => x((p.t0 + p.t1) / 2)
    const pts = series.pts.map((p) => [mid(p), y(p.v)] as [number, number])
    const ridge: [number, number][] = [[0, pts[0][1]], ...pts, [w, pts[pts.length - 1][1]]]

    const labels: Label[] = []
    const make = (p: HPoint, kind: string): Label => {
      const value = spec.fmt(p.v)
      const desc = `${kind}, ${when(p.t0, series.domain)}`
      const lx = mid(p)
      const width = estWidth(value, desc)
      return { x: lx, y: y(p.v), value, desc, width, anchor: lx + 8 + width < w - 16 ? 'start' : 'end' }
    }
    if (series.pts.length > 2 && series.max.v !== series.min.v) {
      const a = make(series.max, 'highest')
      const b = make(series.min, 'lowest')
      const [left, right] = a.x <= b.x ? [a, b] : [b, a]
      const span = (l: Label) => (l.anchor === 'start' ? [l.x, l.x + 8 + l.width] : [l.x - 8 - l.width, l.x])
      if (span(left)[1] > span(right)[0] - 16) {
        // Too close: open them away from each other, or keep only the value on the lower one.
        if (left.x - 8 - left.width > 12) left.anchor = 'end'
        if (span(left)[1] > span(right)[0] - 16) {
          const lower = a.y > b.y ? a : b
          lower.desc = ''
          lower.width = estWidth(lower.value, '')
        }
      }
      labels.push(a, b)
    }

    const tk = ukTimeTicks(d0, d1)
    const ticks = tk.ticks.map((t) => ({ x: x(t), text: tk.format(t) }))
    return { ridge, x, y, labels, zeroY: series.min.v < 0 && series.max.v > 0 ? y(0) : null, ticks }
  }, [series, spec, w])

  const ridgeAt = (px: number) => {
    const r = geo.ridge
    for (let i = 1; i < r.length; i++) {
      if (r[i][0] >= px) {
        const [x0, y0] = r[i - 1]
        const [x1, y1] = r[i]
        return x1 === x0 ? y1 : y0 + ((px - x0) / (x1 - x0)) * (y1 - y0)
      }
    }
    return r[r.length - 1][1]
  }

  const ridgePath = geo.ridge.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const landPath = `M0 ${GROUND} L${ridgePath.slice(1)} L${w} ${GROUND} Z`
  const hills = frontHills(w)

  // Keep the drawing clear of the labelled extremes and their leaders.
  const clear = (px: number, pad: number) =>
    geo.labels.every((l) => {
      const [a, b] = l.anchor === 'start' ? [l.x - 6, l.x + 8 + l.width] : [l.x - 8 - l.width, l.x + 6]
      return px < a - pad || px > b + pad
    })
  const pylonXs = [0.12, 0.37, 0.63, 0.88].map((f) => Math.round(f * w))
  const wireXs = [Math.round(-0.13 * w), ...pylonXs, Math.round(1.13 * w)]
  const turbineXs = [0.05, 0.2, 0.28, 0.45, 0.53, 0.7, 0.78, 0.95]
    .map((f) => Math.round(f * w))
    .filter((px) => clear(px, 14) && pylonXs.every((p) => Math.abs(p - px) > 22))

  return (
    <header className="f-mast" ref={ref}>
      <svg className="f-mast-art" width={w} height={H} viewBox={`0 0 ${w} ${H}`} role="img" aria-label={spec.label}>
        <defs>
          <clipPath id={`${uid}-land`}>
            <path d={landPath} />
            <path d={hills} />
            <rect x="0" y={GROUND} width={w} height={H - GROUND} />
          </clipPath>
        </defs>
        <rect x="0" y="0" width={w} height={H} className="f-sky" />
        <path d={landPath} className="f-land" />
        <path d={ridgePath} className={`f-ridge${spec.dashed ? ' is-dashed' : ''}`} fill="none" />
        <path d={hills} className="f-hills" />
        <Solar x0={Math.round(0.23 * w)} n={3} />
        <Solar x0={Math.round(0.47 * w)} n={4} />
        <g aria-hidden="true">
          {turbineXs.map((px, i) => (
            <Turbine key={px} x={px} base={ridgeAt(px)} turn={(i * 47) % 120} />
          ))}
        </g>
        {/* Two-tone line art: pale where it stands against the sky, ink where it crosses land. */}
        <g aria-hidden="true" className="f-art-sky">
          <Wires xs={wireXs} />
          <Pylons xs={pylonXs} />
          {geo.zeroY !== null && <path d={`M0 ${geo.zeroY.toFixed(1)} H${w}`} strokeWidth={1} strokeDasharray="3 4" />}
        </g>
        <g aria-hidden="true" className="f-art-land" clipPath={`url(#${uid}-land)`}>
          <Wires xs={wireXs} />
          <Pylons xs={pylonXs} />
          {geo.zeroY !== null && <path d={`M0 ${geo.zeroY.toFixed(1)} H${w}`} strokeWidth={1} strokeDasharray="3 4" />}
        </g>
        <rect x="0" y={GROUND} width={w} height={H - GROUND} className="f-ground" />
        <path d={`M0 ${GROUND} H${w}`} className="f-ground-line" />
        <g className="f-ground-ticks" aria-hidden="true">
          {geo.ticks.map((t) => (
            <g key={t.x}>
              <path d={`M${t.x.toFixed(1)} ${GROUND} V${GROUND + 6}`} />
              {t.x > 4 && t.x < w - 4 && (
                <text x={t.x} y={GROUND + 18} textAnchor={t.x < 26 ? 'start' : t.x > w - 26 ? 'end' : 'middle'}>
                  {t.text}
                </text>
              )}
            </g>
          ))}
        </g>
        <g className="f-extremes" aria-hidden="true">
          {geo.labels.map((l) => {
            const tx = l.anchor === 'start' ? l.x + 8 : l.x - 8
            return (
              <g key={l.desc + l.value}>
                <path d={`M${l.x.toFixed(1)} ${(l.y - 5).toFixed(1)} V${LABEL_Y - 11}`} className="f-leader" />
                <circle cx={l.x} cy={l.y} r={3.5} className="f-ring-dot" />
                <text x={tx} y={LABEL_Y} textAnchor={l.anchor}>
                  <tspan className="f-ext-v">{l.value}</tspan>
                  {l.desc && (
                    <tspan className="f-ext-d" dx={7}>
                      {l.desc}
                    </tspan>
                  )}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
      {children}
    </header>
  )
}
