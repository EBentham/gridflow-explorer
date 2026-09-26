/**
 * Elexon's market index price (`mid`): the pilot page (v0.4 P4-0), the
 * approved reference every dataset page copies. A series page in the full
 * DESIGN §5 frame: the price line in the main panel with its extremes
 * labelled and its runs below zero banded; a key of the latest half-hour and
 * the window's range, extremes and mean (`PriceKey`); the volume traded on
 * the same clock, with a table of the days, in the working panel
 * (`VolumePanel`); About in the side panel. The backend's default filter
 * keeps one provider, APXMIDP, and the page says so; tooltips name each
 * half-hour with the settlement period the rows carry.
 */
import { SourceLine } from '../../_template/panels'
import { defineView } from '../../define'
import { AXIS_WIDTH, PRICE, VOLUME } from './figures'
import { PriceKey } from './PriceKey'
import { VolumePanel } from './VolumePanel'

const view = defineView({
  title: 'Market index price',
  sub: 'The price of GB power traded in the short-term market for each half-hour, as the market index reports it, with the volume traded behind it.',
  caveats: [
    'Two providers publish the index. This page reads APXMIDP, the dataset’s default: N2EXMIDP’s rows are almost all a zero price with zero volume, which means it published no index, not that power traded at £0.',
    'Over the years held locally, 15 of APXMIDP’s half-hours on 11 days were never published. Any in this window show as gaps, never as zeros.',
  ],
  datasets: [
    {
      id: 'mid',
      body: 'series',
      label: 'Market index',
      title: 'Price per half-hour',
      values: [
        { column: PRICE, label: 'Price', color: 'var(--chart-price)' },
        { column: VOLUME, label: 'Volume', color: 'var(--chart-fan-soft)' },
      ],
      // Volume goes to the working panel, drawn there on this chart's clock.
      chart: { mark: 'line', values: [PRICE], lower: false, belowZero: true, axisWidth: AXIS_WIDTH },
      panels: {
        key: {
          title: 'Key',
          src: (ctx) => (
            <SourceLine ctx={ctx} columns={[PRICE, VOLUME]} filters={ctx.response?.filters} unit="£/MWh and MWh" what="the latest half-hour held, and the window's range, extremes and mean" />
          ),
          Body: PriceKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Volume traded, and the days' : 'The days'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[VOLUME, PRICE]}
              filters={ctx.response?.filters}
              unit="MWh and £/MWh"
              what={ctx.mode === 'chart' ? 'volume per half-hour, then price and volume per UK day' : 'price and volume per UK day'}
            />
          ),
          Body: VolumePanel,
        },
      },
    },
  ],
})

export default view
