/**
 * System prices joined with carbon intensity (`gold_uk_imbalance_context`):
 * Elexon's half-hourly system price and net imbalance volume with NESO's
 * national carbon intensity joined to each half-hour. The rows endpoint
 * splits the rows by price derivation code, so the page folds them back to
 * one row per half-hour (`figures.ts`) and draws its own main, key and
 * working panels from the folded rows: price, imbalance volume and intensity
 * on one clock (`ContextChart`); the latest half-hour and the window's
 * figures (`ContextKey`); the days, and price set against thirds of the
 * forecast intensity (`ContextDays`). NESO's carbon intensity is read beside
 * it only so the page can say where intensity is held when the window has
 * none. About stays in the side panel.
 */
import { SourceLine } from '../../_template/panels'
import { defineView } from '../../define'
import { ContextChart } from './ContextChart'
import { ContextDays } from './ContextDays'
import { ContextKey } from './ContextKey'
import { AXIS_WIDTH, CI_ACTUAL, CI_FORECAST, CI_SOURCE, NIV, SBP, SSP, VALUES } from './figures'

const view = defineView({
  title: 'System prices joined with carbon intensity',
  sub: 'The GB system price and net imbalance volume for each half-hour, with the national carbon intensity joined to the half-hours where it is held.',
  datasets: [
    {
      id: 'gold_uk_imbalance_context',
      body: 'series',
      label: 'Prices and intensity',
      title: 'System price, imbalance volume and carbon intensity per half-hour',
      caveats: [
        'Prices reach back to 2021, but the national carbon intensity is held locally for far fewer days, so many windows carry little or none. A half-hour without it shows as a gap, never as zero.',
        'The actual intensity is estimated and published after the half-hour it describes. A model of a half-hour can’t use it as an input for that half-hour; the forecast is the one known in time.',
        'Each half-hour carries a code for how its price was derived: N and P are the ones seen, K rarely. This page shows them as published and reads nothing into them. The rows arrive split by that code; the page joins them back into one row per half-hour, and would show a half-hour held under two codes as a gap, with a note.',
      ],
      values: VALUES,
      related: [{ key: CI_SOURCE, source: 'neso', dataset: 'carbon_intensity', label: 'National carbon intensity' }],
      // The main panel is the page's own; lower: false keeps the template from planning a second panel.
      chart: { mark: 'line', values: [SSP], lower: false, belowZero: true, axisWidth: AXIS_WIDTH },
      panels: {
        main: {
          title: (ctx) => (ctx.view.title ?? ctx.view.label),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[SSP, SBP, NIV, CI_FORECAST, CI_ACTUAL]}
              filters={ctx.response?.filters}
              unit="£/MWh, MWh and gCO₂/kWh"
              what="one row per half-hour, whichever price derivation code it carries"
            />
          ),
          Body: ContextChart,
        },
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[SSP, SBP, NIV, CI_FORECAST]} unit="£/MWh, MWh and gCO₂/kWh" what="the latest half-hour held, and the window’s price range, extremes and mean" />,
          Body: ContextKey,
        },
        working: {
          title: 'The days, and price against carbon intensity',
          src: (ctx) => <SourceLine ctx={ctx} columns={[SSP, NIV, CI_FORECAST]} unit="£/MWh, MWh and gCO₂/kWh" what="per UK day, then price by thirds of the forecast intensity" />,
          Body: ContextDays,
        },
      },
    },
  ],
})

export default view
