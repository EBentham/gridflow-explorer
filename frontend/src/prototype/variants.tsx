import { useMemo } from 'react'
import { DEFAULT_LANGUAGE, money } from '../design/charts'
import { FUEL_BANDS, totalGeneration } from '../design/fuels'
import { halfHourWindow } from '../design/time'
import type { ShellProps, VariantDef, VariantKey } from './context'
import { ProtoLink, fmtDate } from './controls'
import { useMix, usePrices, useRange } from './data'

const daysBehind = (latest: string | null) => {
  if (!latest) return null
  const today = new Date().toISOString().slice(0, 10)
  return Math.round((Date.parse(today) - Date.parse(latest)) / 86400e3)
}

// ---------------------------------------------------------------- A: Synoptic

function ShellA({ nav, children }: ShellProps) {
  const { latest } = useRange()
  return (
    <div className="a-shell">
      <aside className="a-key">
        <div className="a-brand">
          <span className="a-brand-name">Gridflow Explorer</span>
          <span className="a-brand-sub">GB power market charts from the local catalogue</span>
        </div>
        <nav className="a-nav" aria-label="Charts">
          {nav.map((n) => (
            <ProtoLink key={n.to} to={n.to} className="a-nav-item">
              <span>{n.label}</span>
              {n.fixture && <span className="a-tag">fixture</span>}
            </ProtoLink>
          ))}
        </nav>
        <div id="gf-shell-slot" className="a-slot" />
        <p className="a-source">Elexon BMRS through gridflow. {latest ? `Latest local day ${fmtDate(latest)}.` : ''} Clock times are UK time.</p>
      </aside>
      <main className="a-main">{children}</main>
    </div>
  )
}

// ---------------------------------------------------------------- B: Control room

function SystemStrip() {
  const { range, latest } = useRange()
  const lastDay = useMemo(() => (latest ? { start: latest, end: latest } : null), [latest])
  const mix = useMix(lastDay ?? range)
  const prices = usePrices(lastDay ?? range)
  // Align both readouts on the same half-hour: the last one present in both.
  const lastT = Math.min(mix.rows.at(-1)?.t ?? Infinity, prices.rows.at(-1)?.t ?? Infinity)
  const m = mix.rows.findLast((r) => r.t <= lastT)
  const p = prices.rows.findLast((r) => r.t <= lastT)
  const behind = daysBehind(latest)
  const total = m ? totalGeneration(m) : 0
  const share = (k: string) => (m && total ? `${Math.round((Math.max(m[k], 0) / total) * 100)}%` : '–')
  const lamp = behind === null ? 'unknown' : behind <= 1 ? 'ok' : 'warn'
  return (
    <div className="b-strip" role="region" aria-label="Last settled half-hour">
      <div className="b-read b-read-when">
        <span className="b-read-label">Last settled half-hour</span>
        <span className="b-read-value">{m ? halfHourWindow(m.t) : '–'}</span>
      </div>
      <div className="b-read">
        <span className="b-read-label">Generation</span>
        <span className="b-read-value">{m ? `${total.toFixed(1)} GW` : '–'}</span>
      </div>
      <div className="b-read">
        <span className="b-read-label">Wind share</span>
        <span className="b-read-value">{share('wind')}</span>
      </div>
      <div className="b-read">
        <span className="b-read-label">Gas share</span>
        <span className="b-read-value">{share('gas')}</span>
      </div>
      <div className="b-read">
        <span className="b-read-label">System price</span>
        <span className="b-read-value">{p?.price != null ? `${money(p.price, 2)}/MWh` : '–'}</span>
      </div>
      <div className="b-read">
        <span className="b-read-label">NIV</span>
        <span className="b-read-value">{p?.niv != null ? `${Math.round(p.niv)} MWh ${p.niv >= 0 ? 'short' : 'long'}` : '–'}</span>
      </div>
      <div className={`b-lamp is-${lamp}`}>
        <span className="b-lamp-dot" aria-hidden="true" />
        <span>{behind === null ? 'Checking catalogue' : behind <= 1 ? 'Catalogue current' : `Catalogue ${behind} days behind`}</span>
      </div>
    </div>
  )
}

function ShellB({ nav, children }: ShellProps) {
  return (
    <div className="b-shell">
      <header className="b-top">
        <span className="b-brand">Gridflow Explorer</span>
        <nav className="b-tabs" aria-label="Screens">
          {nav.map((n) => (
            <ProtoLink key={n.to} to={n.to} className="b-tab">
              {n.label}
              {n.fixture && <span className="b-tag">fixture</span>}
            </ProtoLink>
          ))}
        </nav>
      </header>
      <SystemStrip />
      <main className="b-wall">{children}</main>
    </div>
  )
}

// ---------------------------------------------------------------- C: Chart recorder

function ShellC({ nav, children }: ShellProps) {
  return (
    <div className="c-shell">
      <header className="c-roll">
        <span className="c-brand">Gridflow Explorer</span>
        <nav className="c-tabs" aria-label="Charts">
          {nav.map((n) => (
            <ProtoLink key={n.to} to={n.to} className="c-tab">
              {n.label}
              {n.fixture && <span className="c-tag">fixture</span>}
            </ProtoLink>
          ))}
        </nav>
      </header>
      <main className="c-paper">{children}</main>
    </div>
  )
}

// ---------------------------------------------------------------- D: Settlement ledger

function ShellD({ nav, children }: ShellProps) {
  const { range, latest } = useRange()
  const lastDay = useMemo(() => (latest ? { start: latest, end: latest } : null), [latest])
  const mix = useMix(lastDay ?? range)
  const prices = usePrices(lastDay ?? range)
  const m = mix.rows.at(-1)
  const p = prices.rows.at(-1)
  const latestValue: Record<string, string> = {
    '/datasets/generation-mix': m ? `${totalGeneration(m).toFixed(1)} GW` : '',
    '/datasets/system-prices': p?.price != null ? money(p.price, 2) : '',
    '/forecasts/wind': 'fixture',
  }
  return (
    <div className="d-shell">
      <aside className="d-rail">
        <div className="d-brand">Gridflow Explorer</div>
        <p className="d-rail-note">{latest ? `Values for the last half-hour of ${fmtDate(latest)}` : 'Reading the catalogue'}</p>
        <nav aria-label="Datasets">
          {nav.map((n) => (
            <ProtoLink key={n.to} to={n.to} className="d-row">
              <span>{n.label}</span>
              <span className="d-row-value">{latestValue[n.to]}</span>
            </ProtoLink>
          ))}
        </nav>
        <p className="d-rail-foot">
          {FUEL_BANDS.length} fuel bands from Elexon FUELHH. Imbalance prices from Elexon. UK clock throughout.
        </p>
      </aside>
      <main className="d-main">{children}</main>
    </div>
  )
}

// ---------------------------------------------------------------- E: Emission lines

function ShellE({ nav, children }: ShellProps) {
  const { latest } = useRange()
  const behind = daysBehind(latest)
  return (
    <div className="e-shell">
      <nav className="e-rail" aria-label="Screens">
        <span className="e-brand">Gridflow Explorer</span>
        <ul>
          {nav.map((n) => (
            <li key={n.to}>
              <ProtoLink to={n.to} className={`e-stop${n.fixture ? ' is-fixture' : ''}`}>
                <span className="e-stop-label">{n.label}</span>
                <span className="e-tick" aria-hidden="true" />
              </ProtoLink>
            </li>
          ))}
        </ul>
        <div className={`e-fresh${behind !== null && behind > 1 ? ' is-stale' : ''}`}>
          <span className="e-stop-label">{behind === null ? 'Catalogue' : behind > 1 ? `Catalogue, ${behind} days behind` : 'Catalogue current'}</span>
          <span className="e-tick" aria-hidden="true" />
        </div>
      </nav>
      <main className="e-main">{children}</main>
    </div>
  )
}

// ---------------------------------------------------------------- registry

export const VARIANTS: Record<VariantKey, VariantDef> = {
  a: {
    key: 'a',
    name: 'Synoptic',
    line: 'Met Office chart paper: map-key sidebar, flat fills, the forecast fan drawn as labelled isobars.',
    language: { ...DEFAULT_LANGUAGE, curve: 'monotone', areaOpacity: 0.92, gap: 1.5, line: 2, gridX: 'days', fan: 'contours', font: 12, height: 470 },
    Shell: ShellA,
    keyPlacement: 'shell',
  },
  b: {
    key: 'b',
    name: 'Control room',
    line: 'NESO wall: slate panels, a live last-half-hour system strip with a freshness lamp, dense side panels.',
    language: { ...DEFAULT_LANGUAGE, curve: 'linear', areaOpacity: 0.94, gap: 1, line: 1.75, gridX: 'days', fan: 'bands', font: 11, height: 430 },
    Shell: ShellB,
    keyPlacement: 'aside',
    sidePanel: true,
  },
  c: {
    key: 'c',
    name: 'Chart recorder',
    line: 'Strip-chart paper: a green graticule on half-hour multiples, pen-ink traces, controls in the margin, no cards.',
    language: { ...DEFAULT_LANGUAGE, curve: 'linear', areaOpacity: 0.82, gap: 1, line: 1.5, gridX: 'fine', fan: 'hairlines', font: 11, height: 500 },
    Shell: ShellC,
    keyPlacement: 'aside',
  },
  d: {
    key: 'd',
    name: 'Settlement ledger',
    line: 'Statistical print: a serif ledger with latest values in the rail and a day × half-hour heat strip that opens each day.',
    language: { ...DEFAULT_LANGUAGE, curve: 'linear', areaOpacity: 0.9, gap: 1, line: 1.5, gridX: 'days', fan: 'bands', font: 12, height: 330 },
    Shell: ShellD,
    keyPlacement: 'aside',
    heatStrip: true,
    ledger: true,
  },
  e: {
    key: 'e',
    name: 'Emission lines',
    line: 'Spectrogram: charcoal ground, colour only as hairlines, an off-centre rail, state shown as line form.',
    language: {
      ...DEFAULT_LANGUAGE,
      curve: 'linear',
      areaOpacity: 0.22,
      areaStroke: 'series',
      gap: 1.25,
      line: 1.5,
      gridX: 'none',
      fan: 'hairlines',
      font: 12,
      height: 480,
    },
    Shell: ShellE,
    keyPlacement: 'aside',
    lineForm: true,
  },
}

export const VARIANT_ORDER: VariantKey[] = ['a', 'b', 'c', 'd', 'e']
