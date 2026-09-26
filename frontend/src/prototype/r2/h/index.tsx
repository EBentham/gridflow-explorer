import { DEFAULT_LANGUAGE } from '../../../design/charts'
import type { ShellProps, VariantDef } from '../../context'
import { ProtoLink } from '../../controls'
import { GenerationScreen, PricesScreen, WindScreen } from './screens'
import './tokens.css'

/**
 * Slot h, "Annotated": the site's data sections as the working tool. No
 * drawing; a slim paper masthead, headings that state the window, and charts
 * that write down what their own data did.
 */
function Shell({ nav, children }: ShellProps) {
  return (
    <div className="h-app">
      <header className="h-bar">
        <p className="h-brand">
          <b>gridflow</b>
          <span>Explorer</span>
        </p>
        <nav aria-label="Explorer">
          <ul>
            {nav.map((n) => (
              <li key={n.to}>
                <ProtoLink to={n.to} className="h-nav">
                  {n.label}
                  {n.fixture && <span className="h-navtag">fixture</span>}
                </ProtoLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="h-main">{children}</main>
    </div>
  )
}

export const variant: VariantDef = {
  key: 'h',
  name: 'Annotated',
  line: 'The site’s data sections as the working tool: every chart states its window, says in plain sentences what the data did, and rings its own extremes.',
  language: { ...DEFAULT_LANGUAGE, areaOpacity: 1, gap: 0.75, line: 2, gridX: 'none', font: 12.5, height: 420 },
  Shell,
  keyPlacement: 'aside',
  screens: { generation: GenerationScreen, prices: PricesScreen, wind: WindScreen },
  round: 2,
}
