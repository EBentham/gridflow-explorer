import type { ShellProps, VariantDef } from '../../context'
import { CablePanel } from './CablePanel'
import { LANGUAGE_J } from './charts'
import { GenerationScreenJ, PricesScreenJ, WindScreenJ } from './screens'
import './tokens.css'
import './j.css'

/**
 * Slot j, "Cable network": the navigation is drawn as the site's cable
 * routes. Each screen is a ring terminal on a cable from its source; the
 * workspace beside it keeps the site's paper-chart grammar.
 */
function Shell({ nav, children }: ShellProps) {
  return (
    <div className="j-app">
      <aside className="j-panel">
        <CablePanel nav={nav} />
      </aside>
      <main className="j-work">{children}</main>
    </div>
  )
}

export const variant: VariantDef = {
  key: 'j',
  name: 'Cable network',
  line: 'Navigation drawn as the site’s cable routes: every screen is a terminal on a cable from its source.',
  language: LANGUAGE_J,
  Shell,
  keyPlacement: 'aside',
  screens: { generation: GenerationScreenJ, prices: PricesScreenJ, wind: WindScreenJ },
  round: 2,
}
