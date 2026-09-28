/**
 * The app shell (DESIGN §4): a 96px sticky rail on the deepest petrol with
 * the brand (a link to the catalogue), the pinned screens as line-art
 * glyphs, and the foot (the light/dark switch, how far local data runs, the
 * clock, layered hills); the routed screen beside it; the chartreuse land
 * line along the bottom of the viewport.
 */
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Glyph } from '../design/glyphs'
import { fmtDay } from '../design/time'
import { newestDay, useLatestDays } from '../hooks/latestDays'
import { PINNED } from './pinned'
import { ThemeSwitch } from './ThemeSwitch'

const cls = (...names: (string | false)[]) => names.filter(Boolean).join(' ')

/** The rail's foot: layered hills in petrol depths, as on the site's panorama. */
function Hills() {
  return (
    <svg className="gf-hills" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
      <path className="gf-hill-far" d="M0 18 C18 10 34 9 52 15 C68 20 84 12 100 10 V40 H0 Z" />
      <path className="gf-hill-near" d="M0 28 C22 22 40 20 60 25 C76 29 90 26 100 23 V40 H0 Z" />
    </svg>
  )
}

function LocalDataTo() {
  const days = useLatestDays()
  const day = newestDay(days)
  if (day === undefined) {
    const failed = Object.values(days).every((d) => d.error && d.day === undefined)
    return <p>{failed ? 'Local data unreadable' : 'Reading local data'}</p>
  }
  return <p>{day ? `Local data to ${fmtDay(day)}` : 'No local data found'}</p>
}

export function Shell() {
  const { pathname } = useLocation()
  return (
    <div className={cls('gf-shell', pathname.startsWith('/forecasts/wind') && 'is-wind')}>
      <aside className="gf-rail">
        <NavLink to="/sources" className={({ isActive }) => cls('gf-brand', isActive && 'is-active')}>
          <span className="gf-brand-name">gridflow</span>
          <span className="gf-brand-sub">Explorer</span>
        </NavLink>
        <nav className="gf-nav" aria-label="Pinned screens">
          {PINNED.map((p) => (
            <NavLink key={p.to} to={p.to} className={({ isActive }) => cls('gf-nav-item', `is-${p.glyph}`, isActive && 'is-active')}>
              <Glyph kind={p.glyph} />
              <span className="gf-nav-label">{p.label}</span>
              {p.fixture && <span className="gf-nav-fixture">fixture</span>}
            </NavLink>
          ))}
        </nav>
        <div className="gf-rail-foot">
          <ThemeSwitch />
          <LocalDataTo />
          <p>UK time</p>
          <Hills />
        </div>
      </aside>
      <main className="gf-main">
        <Outlet />
      </main>
      <div className="gf-land" aria-hidden="true" />
      {/* The highlight-band hatch (the site's hatched ground, in chartreuse).
          Dark mode's --band token points at it by id. */}
      <svg className="gf-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <pattern id="i-band-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect className="gf-band-wash" width="6" height="6" />
            <line className="gf-band-line" x1="0" y1="0" x2="0" y2="6" />
          </pattern>
        </defs>
      </svg>
    </div>
  )
}
