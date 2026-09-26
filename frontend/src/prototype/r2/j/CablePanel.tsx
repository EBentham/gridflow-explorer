import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { NavItem } from '../../context'
import { useProto } from '../../context'
import { fmtDate } from '../../controls'
import { useRange } from '../../data'

/**
 * The navigation, drawn as the site's cable routes (R3-3): an ink-cased
 * cable with a light core, rounded bends, junction dots, splice capsules at
 * the sources and ring terminals at the screens. The SVG and the links share
 * one pixel space, so every terminal sits on its link's title line.
 */

const W = 296
const GROUND = 112
const TX = 64 // terminal centre x
const TR = 6.5 // terminal radius
const TEND = TX - TR
const ROW_H = 72

interface RouteDef {
  key: string
  to: string
  id: string
  note: string
  rowTop: number
  /** Full path from the ground line to the terminal. */
  d: string
  /** For the fixture: the solid part up to the source, then the dashed part. */
  solid?: string
  dashed?: string
  fixture?: boolean
}

// Elexon: from the pylon, down to its trunk at x=40, splice at y=196.
const ELEXON = 'M186 113 V132 Q186 148 170 148 H56 Q40 148 40 164'
// gridflow_models: from the data centre, down to the outer trunk at x=18, splice at y=424.
const MODELS = 'M56 113 V122 Q56 134 44 134 H34 Q18 134 18 150'
const cy = (rowTop: number) => rowTop + 17

const ROUTES: RouteDef[] = [
  {
    key: 'gen',
    to: '/datasets/generation-mix',
    id: 'elexon/fuelhh',
    note: 'GW by fuel, per half-hour',
    rowTop: 236,
    d: `${ELEXON} V${cy(236) - 16} Q40 ${cy(236)} 56 ${cy(236)} H${TEND}`,
  },
  {
    key: 'prices',
    to: '/datasets/system-prices',
    id: 'elexon/system_prices',
    note: '£/MWh and NIV, per half-hour',
    rowTop: 236 + ROW_H + 4,
    d: `${ELEXON} V${cy(312) - 16} Q40 ${cy(312)} 56 ${cy(312)} H${TEND}`,
  },
  {
    key: 'wind',
    to: '/forecasts/wind',
    id: 'fixture.wind_day_ahead.v0',
    note: 'MW quantiles, day-ahead',
    rowTop: 478,
    d: `${MODELS} V${cy(478) - 16} Q18 ${cy(478)} 34 ${cy(478)} H${TEND}`,
    solid: `${MODELS} V439`,
    dashed: `M18 439 V${cy(478) - 16} Q18 ${cy(478)} 34 ${cy(478)} H${TEND}`,
    fixture: true,
  },
]

const PANEL_H = 580
const DASH = '6 5'

function Cable({ d, dashed, cls = '' }: { d: string; dashed?: boolean; cls?: string }) {
  return (
    <g className={`j-cable ${cls}`}>
      <path className="j-cable-casing" d={d} strokeDasharray={dashed ? DASH : undefined} />
      <path className="j-cable-core" d={d} strokeDasharray={dashed ? DASH : undefined} />
    </g>
  )
}

function RouteCables({ r, cls }: { r: RouteDef; cls?: string }) {
  if (r.fixture && r.solid && r.dashed)
    return (
      <>
        <Cable d={r.solid} cls={cls} />
        <Cable d={r.dashed} dashed cls={cls} />
      </>
    )
  return <Cable d={r.d} cls={cls} />
}

function Splice({ x, y }: { x: number; y: number }) {
  return (
    <g className="j-splice">
      <rect x={x - 7} y={y - 15} width={14} height={30} rx={7} />
      <path d={`M${x - 7} ${y} H${x + 7}`} />
    </g>
  )
}

function Crown() {
  const hatch: string[] = []
  for (let x = 2; x < W; x += 6) hatch.push(`M${x} ${GROUND + 2} l4 5`)
  const vents: string[] = []
  for (let x = 39; x <= 73; x += 4.25) vents.push(`M${x.toFixed(1)} 99 V108`)
  return (
    <g aria-hidden="true">
      <rect x={0} y={0} width={W} height={GROUND + 1} className="j-sky" />
      <path className="j-hill" d="M0 82 C50 72 96 76 146 85 C196 93 240 74 296 80 V114 H0 Z" />
      <path className="j-conductor" d="M-4 69 Q88 88 172 75 M200 75 Q250 86 300 70" />
      <path className="j-land" d={`M0 100 C60 93 118 99 170 97 C220 95 256 91 296 97 V${GROUND + 1} H0 Z`} />
      <g className="j-glyph">
        <path d="M179 112 L184.5 68 M193 112 L187.5 68 M172 75 H200 M175 85 H197 M180.2 101 L191.8 88 M191.8 101 L180.2 88 M181.4 88 L190.6 77 M190.6 88 L181.4 77 M184.5 68 L186 62 L187.5 68" />
        <rect className="j-dc" x={34} y={95} width={44} height={17} />
        <rect className="j-dc" x={40} y={91} width={11} height={4} />
        <path d={vents.join(' ')} strokeWidth={0.8} />
      </g>
      <path className="j-ground" d={`M0 ${GROUND + 0.5} C70 ${GROUND - 1.5} 150 ${GROUND + 2} 220 ${GROUND - 0.2} C260 ${GROUND - 1} 280 ${GROUND} 296 ${GROUND + 0.6}`} />
      <path className="j-hatch" d={hatch.join(' ')} />
    </g>
  )
}

export function CablePanel({ nav }: { nav: NavItem[] }) {
  const { search } = useProto()
  const { latest } = useRange()
  const { pathname } = useLocation()
  const [lit, setLit] = useState<string | null>(null)
  const active = ROUTES.find((r) => pathname.startsWith(r.to))?.key ?? null
  const label = (to: string) => nav.find((n) => n.to === to)?.label ?? to

  const link = (r: RouteDef) => (
    <li key={r.key} style={{ top: r.rowTop, height: ROW_H }}>
      <NavLink
        to={`${r.to}${search}`}
        className={({ isActive }) => `j-route${isActive ? ' is-active' : ''}${r.fixture ? ' is-fixture' : ''}`}
        onMouseEnter={() => setLit(r.key)}
        onMouseLeave={() => setLit((k) => (k === r.key ? null : k))}
        onFocus={() => setLit(r.key)}
        onBlur={() => setLit((k) => (k === r.key ? null : k))}
      >
        <span className="j-route-name">
          {label(r.to)}
          {r.fixture && <span className="j-route-tag">Fixture</span>}
        </span>
        <code className="j-route-id">{r.id}</code>
        <span className="j-route-note">{r.note}</span>
      </NavLink>
    </li>
  )

  const hovered = lit && lit !== active ? ROUTES.find((r) => r.key === lit) : undefined
  const current = ROUTES.find((r) => r.key === active)

  return (
    <div className="j-panel-inner">
      <div className="j-diagram" style={{ height: PANEL_H }}>
        <svg className="j-cables" width={W} height={PANEL_H} viewBox={`0 0 ${W} ${PANEL_H}`} aria-hidden="true">
          <Crown />
          {ROUTES.map((r) => (
            <RouteCables key={r.key} r={r} />
          ))}
          {hovered && (
            <g className="j-lit is-hover">
              <path className="j-sheath" d={hovered.d} />
              <RouteCables r={hovered} cls="is-lit" />
            </g>
          )}
          {current && (
            <g className="j-lit is-current">
              <path className="j-sheath" d={current.d} />
              <RouteCables r={current} cls="is-lit" />
            </g>
          )}
          <circle className="j-junction" cx={40} cy={cy(236) - 16} r={4.6} />
          <Splice x={40} y={196} />
          <Splice x={18} y={424} />
          {ROUTES.map((r) => {
            const on = r.key === active
            const over = r.key === lit
            return r.fixture ? (
              <circle key={r.key} className={`j-term is-fixture${on ? ' is-on' : ''}${over ? ' is-over' : ''}`} cx={TX} cy={cy(r.rowTop)} r={TR + 0.5} strokeDasharray="3 2.4" />
            ) : (
              <g key={r.key} className={`j-term${on ? ' is-on' : ''}${over ? ' is-over' : ''}`}>
                <circle cx={TX} cy={cy(r.rowTop)} r={TR} />
                <circle className="j-term-dot" cx={TX} cy={cy(r.rowTop)} r={2.2} />
              </g>
            )
          })}
        </svg>

        <div className="j-brand">
          <span className="j-wordmark">gridflow</span>
          <span className="j-brand-sub">Explorer</span>
        </div>

        <nav aria-label="Screens" className="j-nav">
          <div className="j-source" style={{ top: 178, left: 62 }}>
            <p className="j-source-name" id="j-src-elexon">
              Elexon BMRS
            </p>
            <p className="j-source-note">GB electricity market data</p>
          </div>
          <ul aria-labelledby="j-src-elexon">{ROUTES.filter((r) => !r.fixture).map(link)}</ul>
          <div className="j-source" style={{ top: 406, left: 40 }}>
            <p className="j-source-name is-mono" id="j-src-models">
              gridflow_models
            </p>
            <p className="j-source-note">Forecast models, sibling repository</p>
          </div>
          <ul aria-labelledby="j-src-models">{ROUTES.filter((r) => r.fixture).map(link)}</ul>
        </nav>
      </div>

      <div className="j-panel-foot">
        <svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true" className="j-legend-art">
          <Cable d="M4 9 H40" />
          <Cable d="M4 26 H40" dashed />
        </svg>
        <p>
          A solid cable reads the local catalogue. A dashed cable carries synthetic fixture data; no model writes it yet.
        </p>
        {latest && <p className="j-latest">Latest local day: {fmtDate(latest)}</p>}
      </div>
    </div>
  )
}
