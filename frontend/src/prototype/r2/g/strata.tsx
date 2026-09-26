import { Fragment, useId, type ReactNode } from 'react'
import { ukTimeTicks } from '../../../design/time'
import { TRUNK, gutOf, plOf, prOf, scaleX, voidWords, wave, type Interval } from './geo'

/**
 * Below ground. Every screen ends in a geological section: bronze, silver and
 * gold strata (R3-3's textures and wavy boundaries) sharing the chart's time
 * axis, so a missing day is a void directly under the time it affects. Cables
 * run from the chart's corner down to a terminal in each stratum that names
 * the file, table or endpoint behind the chart.
 */

export type LayerKind = 'bronze' | 'silver' | 'gold' | 'made'

export interface Terminal {
  ids: string[]
  body?: ReactNode
  /** Drawn dashed: the connection exists only as a plan. */
  planned?: boolean
  /** No terminal ring: nothing to connect to in this layer. */
  none?: boolean
}

export type Track = { voids: Interval[] } | 'unknown' | 'checking'

export interface Layer {
  kind: LayerKind
  name: string
  height: number
  /** An empty stratum, outlined dashed: this layer doesn't exist for the dataset yet. */
  empty?: boolean
  track?: Track
  terminal: Terminal
}

const SOIL = 38
const BED = 30
const RING_X = 30
const SEEDS = [0.4, 2.1, 3.7, 5.2, 1.3]
const TEXTURE: Record<LayerKind, { id: string; opacity: number }> = {
  bronze: { id: 'g-brick', opacity: 0.2 },
  silver: { id: 'g-diag', opacity: 0.26 },
  gold: { id: 'g-stip', opacity: 0.32 },
  made: { id: 'g-made', opacity: 0.5 },
}

/** Shared pattern defs, mounted once by the shell. Colours are tokens, so they follow the theme. */
export function GeoDefs() {
  return (
    <svg className="g-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="g-brick" width="24" height="12" patternUnits="userSpaceOnUse">
          <path d="M0 11.5 H24 M12 0 V6 M0 6 H24 M0 6 V12" stroke="var(--g-bronze-tex)" strokeWidth="0.8" fill="none" />
        </pattern>
        <pattern id="g-diag" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8 L8 0" stroke="var(--g-silver-tex)" strokeWidth="0.8" />
        </pattern>
        <pattern id="g-stip" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="3" r="1" fill="var(--g-gold-tex)" />
          <circle cx="6.5" cy="7.5" r="0.8" fill="var(--g-gold-tex)" />
        </pattern>
        <pattern id="g-soil" width="23" height="17" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="5" r="0.9" fill="var(--g-soil-tex)" />
          <circle cx="15" cy="12" r="1.1" fill="var(--g-soil-tex)" />
          <path d="M17 3 h3" stroke="var(--g-soil-tex)" strokeWidth="0.9" />
        </pattern>
        <pattern id="g-granite" width="46" height="40" patternUnits="userSpaceOnUse">
          <path d="M8 8 h8 M12 4 v8 M30 26 h8 M34 22 v8 M20 34 h6 M23 31 v6 M40 6 h5 M42.5 3.5 v5" stroke="var(--g-bed-tex)" strokeWidth="1.1" />
        </pattern>
        <pattern id="g-made" width="16" height="14" patternUnits="userSpaceOnUse">
          <path d="M1 12 l5 -3 l4 2 M9 4 l4 -2 l2 3" stroke="var(--g-made-tex)" strokeWidth="0.9" fill="none" />
          <circle cx="4" cy="4" r="1" fill="var(--g-made-tex)" />
        </pattern>
        <pattern id="g-unknown" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M0 0 L7 7" stroke="var(--g-line)" strokeWidth="0.7" opacity="0.5" />
        </pattern>
        <pattern id="g-f-wind" width="14" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 3 h8" stroke="var(--g-tex-light)" strokeWidth="0.8" />
        </pattern>
        <pattern id="g-f-gas" width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.8" fill="var(--g-tex-dark)" />
          <circle cx="5.5" cy="5.5" r="0.6" fill="var(--g-tex-dark)" />
        </pattern>
        <pattern id="g-f-imports" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M0 7 L7 0" stroke="var(--g-tex-light)" strokeWidth="0.8" />
        </pattern>
        <pattern id="g-f-biomass" width="10" height="8" patternUnits="userSpaceOnUse">
          <path d="M1 2 l3 1 M6 6 l3 -1" stroke="var(--g-tex-dark)" strokeWidth="0.8" />
        </pattern>
      </defs>
    </svg>
  )
}

/** Identifier in Red Hat Mono, breakable after `_`, `/` and `.` so long table names wrap cleanly. */
export function Id({ children }: { children: string }) {
  const parts = children.split(/(?<=[_/.])/)
  return (
    <code className="g-id">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 && <wbr />}
        </Fragment>
      ))}
    </code>
  )
}

/** A jagged vertical fracture, the edge of a void. */
function fracture(x: number, y0: number, y1: number, seed: number): string {
  let d = `M${x} ${y0}`
  let k = 0
  for (let y = y0 + 5; y < y1; y += 5) {
    k++
    d += ` L${x + Math.sin(k * 2.7 + seed) * 1.8} ${y}`
  }
  return `${d} L${x} ${y1}`
}

function Voids({
  voids,
  x,
  lo,
  hi,
  top,
  bottom,
  domain,
  halo,
}: {
  voids: Interval[]
  x: (t: number) => number
  lo: number
  hi: number
  top: number
  bottom: number
  domain: Interval
  halo: string
}) {
  const mid = (top + bottom) / 2 + 4
  return (
    <>
      {voids.map((v, i) => {
        const x0 = Math.max(lo, x(v[0]))
        const x1 = Math.min(hi, x(v[1]))
        const w = Math.max(1.5, x1 - x0)
        const words = voidWords(v, domain)
        const tw = words.length * 6.1 + 12
        let lx = (x0 + x1) / 2
        let anchor: 'middle' | 'end' | 'start' = 'middle'
        if (w < tw + 10) {
          if (x0 - lo >= tw) {
            lx = x0 - 8
            anchor = 'end'
          } else {
            lx = x1 + 8
            anchor = 'start'
          }
        }
        return (
          <g key={`${v[0]}`}>
            <rect x={x0} y={top - 8} width={w} height={bottom - top + 16} fill="var(--g-void)" />
            <path d={fracture(x0, top - 8, bottom + 8, i)} stroke="var(--g-line)" strokeWidth="1.2" fill="none" />
            <path d={fracture(x0 + w, top - 8, bottom + 8, i + 3)} stroke="var(--g-line)" strokeWidth="1.2" fill="none" />
            <text x={lx} y={mid} textAnchor={anchor} className="g-void-label" stroke={anchor === 'middle' ? 'var(--g-void)' : halo}>
              {words}
            </text>
          </g>
        )
      })}
    </>
  )
}

export interface StrataProps {
  width: number
  domain: Interval
  layers: Layer[]
  cursor?: number | null
  /** `fixture`: the cable stops in made ground; anything lower is a dashed plan. */
  cable?: 'live' | 'fixture'
  /** The plot's right edge already carries a cable down to the ground (the prices screen). */
  joinFromAbove?: boolean
}

export function Strata({ width, domain, layers, cursor, cable = 'live', joinFromAbove }: StrataProps) {
  const uid = useId().replace(/:/g, '')
  if (width <= 0) return <div className="g-strata" style={{ height: 300 }} />
  const pr = prOf(width)
  const { x } = scaleX(width, domain)
  const lo = plOf(width)
  const hi = width - pr
  const tx = width - pr + TRUNK

  const bases: number[] = [SOIL]
  for (const l of layers) bases.push(bases[bases.length - 1] + l.height)
  const H = bases[bases.length - 1] + BED
  const waves = bases.map((b, i) => wave(width, b, SEEDS[i % SEEDS.length], i === 0 ? 2.2 : 3.2))
  const bandPath = (i: number) => {
    const top = waves[i].pts
    const bottom = [...waves[i + 1].pts].reverse()
    return `${top.map(([px, py], k) => `${k ? 'L' : 'M'}${px} ${py}`).join(' ')} ${bottom.map(([px, py]) => `L${px} ${py}`).join(' ')} Z`
  }
  const bedPath = `${waves[layers.length].d} L${width + 12} ${H} L-12 ${H} Z`

  const { ticks, format, midnights } = ukTimeTicks(domain[0], domain[1])
  const spanDays = (domain[1] - domain[0]) / 86400e3
  const labels =
    spanDays > 1.5 && spanDays <= 16
      ? midnights
          .filter((m) => m < domain[1])
          .map((m, i, arr) => ({ at: ((arr[i + 1] ?? domain[1]) + m) / 2, text: format(m), anchor: 'middle' as const }))
      : ticks.map((t) => ({ at: t, text: format(t), anchor: spanDays > 16 ? ('start' as const) : ('middle' as const) }))
  const joints = midnights.filter((m) => m > domain[0] && m < domain[1])

  // terminals and the cable
  const ringY = layers.map((_, i) => bases[i] + 24)
  const liveUntil = cable === 'fixture' ? layers.findIndex((l) => l.kind === 'made') : layers.length - 1
  const connected = layers.map((l, i) => i <= liveUntil && !l.terminal.none && !l.terminal.planned)
  const lastLive = connected.lastIndexOf(true)
  const planned = layers.map((l) => !!l.terminal.planned)
  const lastPlanned = planned.lastIndexOf(true)
  const trunkEnd = lastLive >= 0 ? ringY[lastLive] - 14 : 13
  const coreFor = (y: number) => {
    for (let i = layers.length - 1; i >= 0; i--) if (y >= bases[i]) return `var(--g-core-${layers[i].kind})`
    return 'var(--g-core-soil)'
  }
  const trunkSegs: { y0: number; y1: number }[] = []
  {
    const stops = [13, ...bases.filter((b) => b > 13 && b < trunkEnd), trunkEnd]
    for (let k = 0; k < stops.length - 1; k++) trunkSegs.push({ y0: stops[k], y1: stops[k + 1] })
  }
  const head = joinFromAbove ? `M${hi} 1.5 H${tx - 12} Q${tx} 1.5 ${tx} 13` : `M${hi} 1.5 H${tx - 12} Q${tx} 1.5 ${tx} 13`

  return (
    <div className="g-strata" style={{ height: H }}>
      <svg width={width} height={H} className="g-strata-svg" role="img" aria-label={`Provenance section: ${layers.map((l) => `${l.name}, ${l.terminal.ids.join(' and ') || 'none'}`).join('; ')}`}>
        <defs>
          {layers.map((_, i) => (
            <clipPath id={`${uid}-c${i}`} key={i}>
              <path d={bandPath(i)} />
            </clipPath>
          ))}
          <clipPath id={`${uid}-plot`}>
            <rect x={lo} y={0} width={Math.max(0, hi - lo)} height={H} />
          </clipPath>
        </defs>

        <rect x="0" y="0" width={width} height={H} fill="var(--g-soil)" />
        <rect x="0" y="0" width={width} height={H} fill="url(#g-soil)" opacity="0.55" />

        {layers.map((l, i) => {
          const tex = TEXTURE[l.kind]
          return (
            <g key={`band${i}`}>
              {!l.empty && <path d={bandPath(i)} fill={`var(--g-${l.kind})`} />}
              {!l.empty && <path d={bandPath(i)} fill={`url(#${tex.id})`} opacity={tex.opacity} />}
            </g>
          )
        })}
        <path d={bedPath} fill="var(--g-bed)" />
        <path d={bedPath} fill="url(#g-granite)" />

        {/* time track: joints, voids, unknown coverage, clipped to the band and the plot's x-range */}
        {layers.map((l, i) => {
          if (!l.track) return null
          const top = bases[i]
          const bottom = bases[i + 1]
          return (
            <g key={`track${i}`} clipPath={`url(#${uid}-c${i})`}>
              <g clipPath={`url(#${uid}-plot)`}>
                {joints.map((m) => (
                  <line key={m} x1={x(m)} x2={x(m)} y1={top - 6} y2={bottom + 6} stroke="var(--g-joint)" strokeWidth="1" />
                ))}
                {l.track === 'unknown' && <rect x={lo} y={top - 6} width={hi - lo} height={bottom - top + 12} fill="url(#g-unknown)" />}
              </g>
              {typeof l.track === 'object' && (
                <Voids voids={l.track.voids} x={x} lo={lo} hi={hi} top={top} bottom={bottom} domain={domain} halo={`var(--g-${l.kind})`} />
              )}
              {(l.track === 'unknown' || l.track === 'checking') && (
                <text x={lo + 10} y={(top + bottom) / 2 + 4} className="g-void-label" stroke={`var(--g-${l.kind})`}>
                  {l.track === 'unknown' ? 'coverage not available: the coverage request failed' : 'checking coverage'}
                </text>
              )}
            </g>
          )
        })}

        {/* boundaries */}
        {waves.map((w, i) => {
          const dashed = layers[i]?.empty || layers[i - 1]?.empty
          return (
            <path
              key={`w${i}`}
              d={w.d}
              stroke="var(--g-line)"
              strokeWidth={dashed ? 1.2 : 1.5}
              strokeDasharray={dashed ? '3 5' : undefined}
              fill="none"
            />
          )
        })}

        {/* layer names, italic as on the site */}
        {layers.map((l, i) => (
          <text key={`n${i}`} x={gutOf(width) - 24 > 8 ? 16 : 6} y={bases[i] + 20} className="g-layer-name">
            {l.name}
          </text>
        ))}

        {/* ground line: the chart's baseline, hatched as on the site */}
        <rect x="0" y="0" width={width} height={SOIL - 4} fill="var(--g-soil)" opacity="0.6" />
        <path
          d={Array.from({ length: Math.ceil(width / 9) + 1 }, (_, k) => `M${k * 9} 11 L${k * 9 + 9} 2`).join(' ')}
          stroke="var(--g-ground)"
          strokeWidth="0.7"
        />
        <path d={`M0 1 H${width}`} stroke="var(--g-ground)" strokeWidth="2" />
        {labels.map((lb) => {
          const px = x(lb.at)
          if (px < lo - 2 || px > hi + 2) return null
          return (
            <text key={lb.at} x={lb.anchor === 'start' ? px + 4 : px} y={29} textAnchor={lb.anchor} className="g-tick">
              {lb.text}
            </text>
          )
        })}

        {/* cursor carried down from the chart */}
        {cursor != null && cursor >= domain[0] && cursor <= domain[1] && (
          <line x1={x(cursor)} x2={x(cursor)} y1={0} y2={bases[bases.length - 1]} stroke="var(--chart-cursor)" strokeWidth="1" opacity="0.7" />
        )}

        {/* planned cable: dashed, thin */}
        {lastPlanned > lastLive && (
          <g fill="none" stroke="var(--g-line)" strokeWidth="1.4" strokeDasharray="4 4">
            <path d={`M${tx} ${trunkEnd} V${ringY[lastPlanned] - 14} Q${tx} ${ringY[lastPlanned]} ${tx + 14} ${ringY[lastPlanned]} H${tx + RING_X - 6.5}`} />
            <circle cx={tx + RING_X} cy={ringY[lastPlanned]} r="6.5" fill="var(--g-soil)" />
          </g>
        )}

        {/* live cable: ink outer, coloured core per stratum */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={`${head} V${trunkEnd}`} stroke="var(--g-cable)" strokeWidth="4.4" />
          <path d={head} stroke="var(--g-core-soil)" strokeWidth="1.5" />
          {trunkSegs.map((s) => (
            <path key={s.y0} d={`M${tx} ${s.y0} V${s.y1}`} stroke={coreFor(s.y0 + 1)} strokeWidth="1.5" />
          ))}
          {layers.map((l, i) => {
            if (!connected[i]) return null
            const ry = ringY[i]
            const d = `M${tx} ${ry - 14} Q${tx} ${ry} ${tx + 14} ${ry} H${tx + RING_X - 6.5}`
            return (
              <g key={`br${i}`}>
                <path d={d} stroke="var(--g-cable)" strokeWidth="4.4" />
                <path d={d} stroke={`var(--g-core-${l.kind})`} strokeWidth="1.5" />
              </g>
            )
          })}
        </g>
        {layers.map((l, i) => {
          if (!connected[i]) return null
          return (
            <g key={`ring${i}`}>
              {i !== lastLive && <circle cx={tx} cy={ringY[i] - 14} r="4.6" fill="var(--g-cable)" />}
              <circle cx={tx + RING_X} cy={ringY[i]} r="6.5" fill={`var(--g-${l.kind})`} stroke="var(--g-cable)" strokeWidth="2" />
              <circle cx={tx + RING_X} cy={ringY[i]} r="1.8" fill="var(--g-cable)" />
            </g>
          )
        })}
        <circle cx={hi} cy={1.5} r="3.4" fill="var(--bg)" stroke="var(--g-cable)" strokeWidth="1.3" />
      </svg>

      {layers.map((l, i) => (
        <div
          key={`lab${i}`}
          className={`g-terminal${l.terminal.none ? ' is-none' : ''}${l.terminal.planned ? ' is-planned' : ''}`}
          style={{ left: tx + RING_X + 12, top: ringY[i] - 10, width: width - (tx + RING_X + 12) - gutOf(width) }}
        >
          {l.terminal.ids.map((id) => (
            <div key={id} className="g-terminal-id">
              <Id>{id}</Id>
            </div>
          ))}
          {l.terminal.body && <div className="g-terminal-body">{l.terminal.body}</div>}
        </div>
      ))}
    </div>
  )
}
