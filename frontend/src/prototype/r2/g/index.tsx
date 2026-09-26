import { useEffect, useRef } from 'react'
import { DEFAULT_LANGUAGE } from '../../../design/charts'
import type { ShellProps, VariantDef } from '../../context'
import { ProtoLink } from '../../controls'
import { useRange } from '../../data'
import { GenerationG } from './screens'
import { PricesG } from './prices'
import { WindG } from './wind'
import { GeoDefs } from './strata'
import './tokens.css'

/**
 * Slot g, "Above ground, below ground" (after the site's R3-3 board). Every
 * screen is a geological section: the working chart on paper above a hatched
 * ground line, and below it the bronze, silver and gold strata the chart was
 * read from, with coverage drawn as rock and voids on the chart's own clock.
 */
function Shell({ nav, children }: ShellProps) {
  const { preset, setPreset } = useRange()
  const opened = useRef(false)
  useEffect(() => {
    // Open on 30 days so the section shows real voids (7 to 9 Sep) on first load.
    if (!opened.current && preset === 7) setPreset(30)
    opened.current = true
  }, [preset, setPreset])

  return (
    <div className="g-app">
      <GeoDefs />
      <header className="g-mast">
        <p className="g-brand">
          gridflow <span>Explorer</span>
        </p>
        <nav aria-label="Screens">
          <ul>
            {nav.map((n) => (
              <li key={n.to}>
                <ProtoLink to={n.to} className="g-nav-link">
                  {n.label}
                  {n.fixture && <span className="g-nav-fixture">fixture</span>}
                </ProtoLink>
              </li>
            ))}
          </ul>
        </nav>
        <p className="g-mast-note">Local catalogue, read-only</p>
      </header>
      <main className="g-main">{children}</main>
      <footer className="g-bedrock">
        <svg className="g-bedrock-tex" aria-hidden="true" focusable="false">
          <rect width="100%" height="100%" fill="url(#g-granite)" />
        </svg>
        <p>Reads gridflow’s silver layer through GridflowClient. Never writes to gridflow’s layers.</p>
        <p className="g-bedrock-name">bedrock</p>
      </footer>
    </div>
  )
}

export const variant: VariantDef = {
  key: 'g',
  name: 'Above ground, below ground',
  line: 'Every screen is a section: the chart above a hatched ground line, its bronze, silver and gold provenance below, with missing days drawn as voids under the time they affect.',
  language: { ...DEFAULT_LANGUAGE, curve: 'linear', fan: 'bands', gridX: 'days', height: 350 },
  Shell,
  keyPlacement: 'aside',
  screens: { generation: GenerationG, prices: PricesG, wind: WindG },
  round: 2,
}
