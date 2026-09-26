/**
 * Line-art wayfinding glyphs, drawn in the gridflow site's illustration
 * grammar: ink strokes with round caps and non-scaling widths, towers
 * standing on a short ground line. One glyph per pinned screen: a pylon
 * (generation mix), a meter (system prices), a turbine (wind forecast); and
 * a data centre for pages with no glyph of their own. All art lives in a
 * 32-unit box with the ground at y=30.
 */

export type GlyphKind = 'pylon' | 'meter' | 'turbine' | 'datacentre'

const NS = { vectorEffect: 'non-scaling-stroke' } as const

function PylonArt() {
  return (
    <g className="gf-stroke">
      <path
        {...NS}
        d="M10.5 30 L14.6 7.5 M21.5 30 L17.4 7.5 M14.6 7.5 V2.6 M17.4 7.5 V2.6 M14.6 2.6 H17.4
           M11.7 23.3 H20.3 M12.9 16.6 H19.1 M13.9 10.9 H18.1
           M10.5 30 L20.3 23.3 M21.5 30 L11.7 23.3 M11.7 23.3 L19.1 16.6 M20.3 23.3 L12.9 16.6
           M12.9 16.6 L18.1 10.9 M19.1 16.6 L13.9 10.9
           M7.8 14.2 H24.2 M9.6 8.2 H22.4 M12.2 3.8 H19.8
           M7.8 14.2 L13.1 15.8 M24.2 14.2 L18.9 15.8 M9.6 8.2 L14.4 9.5 M22.4 8.2 L17.6 9.5
           M7.8 14.2 v2 M24.2 14.2 v2 M9.6 8.2 v1.8 M22.4 8.2 v1.8 M12.2 3.8 v1.5 M19.8 3.8 v1.5"
      />
    </g>
  )
}

function MeterArt() {
  return (
    <g className="gf-stroke">
      <rect {...NS} x="7" y="3" width="18" height="21" rx="2" />
      <path {...NS} d="M10.5 13.5 A5.5 5.5 0 0 1 21.5 13.5 M10.5 13.5 H21.5" />
      <path {...NS} d="M11.3 10.7 l1 .6 M13.4 8.8 l.6 1 M16 8 v1.2 M18.6 8.8 l-.6 1 M20.7 10.7 l-1 .6" />
      <path {...NS} d="M16 13.5 L19.3 9.6" />
      <rect {...NS} x="11" y="16.5" width="10" height="4" rx=".5" />
      <path {...NS} d="M13.5 16.5 v4 M16 16.5 v4 M18.5 16.5 v4" />
      <path {...NS} d="M11.5 24 V30 M16 24 V30 M20.5 24 V30" />
    </g>
  )
}

function DataCentreArt() {
  return (
    <g className="gf-stroke">
      <rect {...NS} x="5" y="12" width="22" height="18" rx=".5" />
      <path {...NS} d="M8.5 12 V8.5 H13.5 V12 M18.5 12 V8.5 H23.5 V12 M9.5 10.2 H12.5 M19.5 10.2 H22.5" />
      <path {...NS} d="M8.5 16 H23.5 M8.5 19 H23.5 M8.5 22 H12 M20 22 H23.5" />
      <rect {...NS} x="14" y="23" width="4" height="7" />
    </g>
  )
}

const BLADE = 'M-0.75 0 C-1.4 -3 -0.55 -7.4 0 -9.6 C0.4 -7 1.5 -3 0.75 0 Z'

function TurbineArt() {
  return (
    <g>
      <path className="gf-fill" d="M15.2 30 L15.75 11.4 L16.25 11.4 L16.8 30 Z" />
      <rect className="gf-fill" x="15.4" y="10.3" width="3.4" height="1.6" rx=".6" />
      <g transform="translate(16 11)">
        <g className="gf-rotor">
          <circle r="9.6" fill="none" stroke="none" />
          <path className="gf-fill" d={BLADE} transform="rotate(12)" />
          <path className="gf-fill" d={BLADE} transform="rotate(132)" />
          <path className="gf-fill" d={BLADE} transform="rotate(252)" />
          <circle className="gf-fill" r=".9" />
        </g>
      </g>
    </g>
  )
}

function Art({ kind }: { kind: GlyphKind }) {
  if (kind === 'pylon') return <PylonArt />
  if (kind === 'meter') return <MeterArt />
  if (kind === 'datacentre') return <DataCentreArt />
  return <TurbineArt />
}

/** Nav glyph: the object standing on its own short ground line. */
export function Glyph({ kind, size = 34 }: { kind: GlyphKind; size?: number }) {
  return (
    <svg className={`gf-glyph is-${kind}`} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <Art kind={kind} />
      <path className="gf-stroke gf-glyph-ground" {...NS} d="M5 30.5 H27" />
    </svg>
  )
}

/** Hatch ticks under a ground line, like the site's hatched ground. */
function Hatch({ x0, x1, y }: { x0: number; x1: number; y: number }) {
  const d: string[] = []
  for (let x = x0 + 2; x < x1; x += 4) d.push(`M${x} ${y + 1.5} l-2.4 3.6`)
  return <path className="gf-hatch" {...NS} d={d.join(' ')} />
}

/**
 * The screen emblem: the screen's glyph at a larger size in a small
 * vignette, standing on a hatched ground line. Quiet: muted strokes, no fill.
 */
export function Emblem({ kind }: { kind: GlyphKind }) {
  return (
    <svg className={`gf-emblem is-${kind}`} width="112" height="60" viewBox="0 0 112 60" aria-hidden="true">
      {kind === 'pylon' && (
        <>
          <g transform="translate(6 7) scale(1.55)">
            <PylonArt />
          </g>
          <g transform="translate(74 31) scale(.72)">
            <PylonArt />
          </g>
          <path
            className="gf-stroke gf-wire"
            {...NS}
            d="M43.5 32.1 Q62 44 79.6 42.7 M40.7 22.5 Q60 34 80.9 38.2 M91.4 42.7 Q102 46 112 45 M90.1 38.2 Q101 41 112 40.5 M18.1 32.1 Q9 36 0 35.5 M20.9 22.5 Q10 27 0 26.5"
          />
        </>
      )}
      {kind === 'meter' && (
        <>
          <g transform="translate(10 7) scale(1.55)">
            <MeterArt />
          </g>
          <g className="gf-stroke" transform="translate(64 26)">
            <path {...NS} d="M0 27.5 V4 M18 27.5 V4 M36 27.5 V4 M-2 4 H38 M0 4 L18 16 M18 4 L0 16 M18 4 L36 16 M36 4 L18 16" />
            <rect {...NS} x="5" y="18" width="8" height="9.5" />
            <rect {...NS} x="23" y="18" width="8" height="9.5" />
            <path {...NS} d="M7 20.5 H11 M7 23 H11 M25 20.5 H29 M25 23 H29" />
          </g>
          <path className="gf-stroke gf-wire" {...NS} d="M62 30 Q56 23 48.8 21" />
        </>
      )}
      {kind === 'turbine' && (
        <>
          <g transform="translate(4 7) scale(1.55)">
            <TurbineArt />
          </g>
          <g transform="translate(58 25) scale(.9)">
            <TurbineArt />
          </g>
          <g transform="translate(84 33) scale(.64)">
            <TurbineArt />
          </g>
        </>
      )}
      {kind === 'datacentre' && (
        <>
          <g transform="translate(4 7) scale(1.55)">
            <DataCentreArt />
          </g>
          <g transform="translate(82 31) scale(.72)">
            <PylonArt />
          </g>
          <path className="gf-stroke gf-wire" {...NS} d="M45.9 38 Q70 46 91.4 42.7 M45.9 44 Q72 50 94.4 47" />
        </>
      )}
      <path className="gf-stroke gf-ground" {...NS} d="M0 53.5 H112" />
      <Hatch x0={0} x1={112} y={53.5} />
    </svg>
  )
}
