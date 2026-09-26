/**
 * One line-art symbol per data source, in the same grammar as the rail glyphs
 * (32-unit box, ground at y=30, round caps, non-scaling strokes). They are
 * drawings of what each source measures, not the publishers' logos.
 */
import type { ComponentType } from 'react'
import type { Domain } from './catalogue'

const NS = { vectorEffect: 'non-scaling-stroke' } as const

function Elexon() {
  // settlement clock: the half-hour that every price and volume is settled on
  return (
    <>
      <path className="i-tint" d="M16 15 V6 A9 9 0 0 1 25 15 Z" />
      <g className="i-stroke">
        <circle {...NS} cx="16" cy="15" r="9" />
        <path {...NS} d="M16 6 v1.8 M25 15 h-1.8 M16 24 v-1.8 M7 15 h1.8 M16 15 V9.5 M16 15 L20.2 17.4 M16 24 V30" />
      </g>
    </>
  )
}

function Neso() {
  // stack and plume: carbon intensity of the power that is running
  return (
    <g className="i-stroke">
      <path {...NS} d="M10.5 30 L11.5 13 H16.5 L17.5 30 M11.3 16.5 H16.7 M11 21 H17" />
      <path {...NS} d="M17.2 11.2 a2.6 2.6 0 0 1 4.6 -1.6 a3 3 0 0 1 5.4 1.4 a2.2 2.2 0 0 1 -0.6 4.2 H19.4 a2.2 2.2 0 0 1 -2.2 -4" />
      <path {...NS} d="M24 7.2 a1.8 1.8 0 0 1 3.4 -0.6" />
    </g>
  )
}

function NesoPortal() {
  // published files from the system operator
  return (
    <g className="i-stroke">
      <path {...NS} d="M11 7 H20 L25 12 V26 M20 7 V12 H25" />
      <path {...NS} d="M7 11 H16 L21 16 V30 H7 Z M16 11 V16 H21" />
      <path {...NS} d="M10 20 H18 M10 23 H18 M10 26 H14.5" />
    </g>
  )
}

function Entsoe() {
  // a meshed network of bidding zones and interconnectors
  const nodes: [number, number][] = [
    [7, 11],
    [18, 6],
    [26, 14],
    [21, 24],
    [9, 23],
    [16, 15],
  ]
  return (
    <g className="i-stroke">
      <path {...NS} d="M7 11 L18 6 L26 14 L21 24 L9 23 Z M7 11 L16 15 L18 6 M16 15 L26 14 M16 15 L21 24 M16 15 L9 23 M21 24 V30" />
      {nodes.map(([x, y]) => (
        <circle key={`${x}-${y}`} {...NS} className="i-node" cx={x} cy={y} r="1.9" />
      ))}
    </g>
  )
}

function Entsog() {
  // pipeline with flanges and a valve wheel
  return (
    <g className="i-stroke">
      <path {...NS} d="M2.5 21 H29.5 M2.5 25.5 H29.5" />
      <path {...NS} d="M8 19.5 V27 M10 19.5 V27 M22 19.5 V27 M24 19.5 V27" />
      <path {...NS} d="M16 21 V13.5" />
      <circle {...NS} cx="16" cy="10" r="4" />
      <path {...NS} d="M12 10 H20 M16 6 V14" />
      <path {...NS} d="M13 25.5 V30 M19 25.5 V30" />
    </g>
  )
}

function Agsi() {
  // domed storage tank with its level showing
  return (
    <>
      <path className="i-tint" d="M6 30 V20.5 H26 V30 Z" />
      <g className="i-stroke">
        <path {...NS} d="M6 30 V15 A10 5 0 0 1 26 15 V30" />
        <path {...NS} d="M6 20.5 H26 M22.5 12.4 V30 M22.5 17 H25 M22.5 23 H25" />
      </g>
    </>
  )
}

function Alsi() {
  // LNG carrier with its spherical tanks
  return (
    <g className="i-stroke">
      <path {...NS} d="M3 22 H29 L26 27 H7 Z" />
      <path {...NS} d="M9 22 A3.2 3.2 0 0 1 15.4 22 M15.8 22 A3.2 3.2 0 0 1 22.2 22 M4 22 V16.5 H7.5 V22 M5 14.5 V16.5" />
      <path {...NS} d="M2 30 q2 -1.4 4 0 t4 0 t4 0 t4 0 t4 0 t4 0 t4 0" />
    </g>
  )
}

function OpenMeteo() {
  // sun behind cloud
  return (
    <g className="i-stroke">
      <circle {...NS} cx="12" cy="11" r="3.6" />
      <path {...NS} d="M12 4 v1.6 M5 11 h1.6 M7 6 l1.1 1.1 M17 6 l-1.1 1.1 M7 16 l1.1 -1.1" />
      <path {...NS} d="M8.5 25 H24.5 A3.8 3.8 0 0 0 24 17.5 A5.5 5.5 0 0 0 13.6 16.2 A4.2 4.2 0 0 0 8.5 25 Z" />
      <path {...NS} d="M16 25 V30" />
    </g>
  )
}

const ART: Record<string, ComponentType> = {
  elexon: Elexon,
  neso: Neso,
  neso_data_portal: NesoPortal,
  entsoe: Entsoe,
  entsog: Entsog,
  gie_agsi: Agsi,
  gie_alsi: Alsi,
  open_meteo: OpenMeteo,
}

/** A source's symbol standing on its short ground line, tinted by domain. */
export function SourceSymbol({ source, domain, size = 40 }: { source: string; domain: Domain; size?: number }) {
  const Art = ART[source] ?? Entsoe
  return (
    <svg className={`i-sym is-${domain.toLowerCase()}`} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <Art />
      {source !== 'gie_alsi' && <path className="i-stroke i-sym-ground" {...NS} d="M4 30.5 H28" />}
    </svg>
  )
}
