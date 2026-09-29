/**
 * Elexon's market depth (`market_depth`): per half-hour, the volumes offered
 * and bid, the volumes accepted (total and priced) and the indicated
 * imbalance. The main panel draws the volumes offered and bid as mirrored
 * bars over the volumes accepted as lines, on one clock (`DepthChart`); the
 * key lists each with its latest value and the window's most accepted on
 * each side (`DepthKey`); the working panel sets Elexon's system price and
 * net imbalance volume beside the indicated imbalance on the same clock,
 * then the days (`PriceContext`). About stays in the side panel.
 */
import { SourceLine } from '../../_template/panels'
import { defineView } from '../../define'
import { DepthChart } from './DepthChart'
import { DepthKey } from './DepthKey'
import { ACCEPTED, ACC_BID, ACC_OFFER, AXIS_WIDTH, IMBALANCE, NIV, OFFERED, PRICES, PRICE_VALUES, SSP, VALUES } from './figures'
import { PriceContext } from './PriceContext'

const view = defineView({
  title: 'Market depth',
  sub: 'How much was offered and bid in the Balancing Mechanism for each half-hour, how much of it was accepted, and the indicated imbalance, with the system price beside it.',
  caveats: [
    'Elexon publishes bid volumes, and accepted bids, below zero. The page draws them as published and reads no sign convention into the indicated imbalance.',
    'The accepted volumes are totals built from the individual acceptances and adjustments that other Elexon datasets list one by one. Don’t add them to those in a model, or the same volume counts twice.',
    'Some days have landed with the offer, bid and accepted volumes missing for part of the day while the indicated imbalance is held. Why isn’t known. The missing half-hours show as gaps, and the days table counts each part.',
  ],
  datasets: [
    {
      id: 'market_depth',
      body: 'series',
      label: 'Market depth',
      title: 'Offered, bid and accepted per half-hour',
      values: VALUES,
      related: [{ key: PRICES, source: 'elexon', dataset: 'system_prices', label: 'System prices', values: PRICE_VALUES }],
      // The page draws its own charts; lower: false keeps the template from planning a second panel or calling a column table-only.
      chart: { mark: 'bars', values: OFFERED, lower: false, zero: true, axisWidth: AXIS_WIDTH },
      panels: {
        main: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Offered, bid and accepted per half-hour' : 'Market depth per half-hour'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={ctx.mode === 'chart' ? [...OFFERED, ...ACCEPTED] : [...OFFERED, ...ACCEPTED, IMBALANCE]}
              unit="MWh"
              what={ctx.mode === 'chart' ? 'offered and bid above, accepted below, per half-hour' : 'every column, one row per half-hour'}
            />
          ),
          Body: DepthChart,
        },
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[...OFFERED, ...ACCEPTED, IMBALANCE]} unit="MWh" what="the latest half-hour held, the most accepted and what the window holds" />,
          Body: DepthKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Beside the system price and imbalance, and the days' : 'The days'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[IMBALANCE, ACC_OFFER, ACC_BID]}
              unit="MWh"
              also={[{ source: ctx.related[PRICES]?.source, dataset: 'system_prices', columns: [SSP, NIV], by: null, unit: '£/MWh and MWh' }]}
              what={ctx.mode === 'chart' ? 'per half-hour on one clock, then per UK day' : 'per UK day'}
            />
          ),
          Body: PriceContext,
        },
      },
    },
  ],
})

export default view
