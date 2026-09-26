/**
 * Slot i, "Petrol night". The site's petrol sky becomes the working ground:
 * a compact rail on the deepest petrol with line-art glyph wayfinding, dense
 * panels on two lighter petrol depths, charts drawn in the day palette, and
 * chartreuse only where the user is (active screen, selection, focus,
 * highlight bands) plus the thin land line along the bottom of the shell.
 * Light mode is the same system in daylight: paper ground, petrol rail.
 */
import { useLocation } from 'react-router-dom'
import { DEFAULT_LANGUAGE } from '../../../design/charts'
import type { ShellProps, VariantDef } from '../../context'
import { ProtoLink, fmtDate } from '../../controls'
import { useRange } from '../../data'
import { Glyph, type GlyphKind } from './glyphs'
import { GenerationScreen, PricesScreen, WindScreen } from './screens'
import './tokens.css'
import './shell.css'

const KIND: Record<string, GlyphKind> = {
  '/datasets/generation-mix': 'pylon',
  '/datasets/system-prices': 'meter',
  '/forecasts/wind': 'turbine',
}

/** The rail's foot: layered hills in petrol depths, as on the site's panorama. */
function Hills() {
  return (
    <svg className="i-hills" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path className="i-hill-far" d="M0 18 C18 10 34 9 52 15 C68 20 84 12 100 10 V40 H0 Z" />
      <path className="i-hill-near" d="M0 28 C22 22 40 20 60 25 C76 29 90 26 100 23 V40 H0 Z" />
    </svg>
  )
}

function Shell({ nav, children }: ShellProps) {
  const { latest } = useRange()
  const { pathname } = useLocation()
  return (
    <div className={`i-shell${pathname.startsWith('/forecasts/wind') ? ' is-wind' : ''}`}>
      <aside className="i-rail">
        <div className="i-brand">
          <span className="i-brand-name">gridflow</span>
          <span className="i-brand-sub">Explorer</span>
        </div>
        <nav className="i-nav" aria-label="Screens">
          {nav.map((n) => (
            <ProtoLink key={n.to} to={n.to} className={`i-nav-item is-${KIND[n.to] ?? 'pylon'}`}>
              <Glyph kind={KIND[n.to] ?? 'pylon'} />
              <span className="i-nav-label">{n.label}</span>
              {n.fixture && <span className="i-nav-fixture">fixture</span>}
            </ProtoLink>
          ))}
        </nav>
        <div className="i-rail-foot">
          <p>{latest ? `Local data to ${fmtDate(latest)}` : 'Reading the catalogue'}</p>
          <p>UK time</p>
          <Hills />
        </div>
      </aside>
      <main className="i-main">{children}</main>
      <div className="i-land" aria-hidden="true" />
      {/* Highlight-band hatch for the night charts (the site's hatched ground,
          in chartreuse); referenced through the --band token in dark mode. */}
      <svg className="i-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="i-band-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect className="i-band-wash" width="6" height="6" />
            <line className="i-band-line" x1="0" y1="0" x2="0" y2="6" />
          </pattern>
        </defs>
      </svg>
    </div>
  )
}

export const variant: VariantDef = {
  key: 'i',
  name: 'Petrol night',
  line: "The site's petrol sky as the working ground: a line-art glyph rail, dense panels, and chartreuse only where you are.",
  language: {
    ...DEFAULT_LANGUAGE,
    curve: 'linear',
    areaOpacity: 0.95,
    areaStroke: 'surface',
    gap: 1,
    line: 1.75,
    gridX: 'days',
    gridY: true,
    fan: 'bands',
    font: 12,
    height: 380,
    fixtureDash: '5 4',
  },
  Shell,
  keyPlacement: 'aside',
  screens: { generation: GenerationScreen, prices: PricesScreen, wind: WindScreen },
  round: 2,
}
