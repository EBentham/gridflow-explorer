/**
 * ENTSO-E's day-ahead prices (`day_ahead_prices`): the price each day-ahead
 * auction set in five European bidding zones, in euros per MWh. There is no
 * GB zone in these rows, so gridflow's GB day-ahead benchmark (taken from
 * Elexon's market index price, in pounds) is read beside them and drawn on
 * its own axis, never on theirs, with no spread worked out: the two differ
 * in kind and in currency, and gridflow holds no exchange rate.
 *
 * The rows are split by zone (`area_code`) and read in euros only
 * (`currency` EUR, which every row held is), so the € axis holds by the
 * query. The zones are named as gridflow's `area_codes.py` names them.
 *
 * Main: each zone's line, gaps marked on its own clock, over the GB
 * benchmark (`ZonesBody`). Key: each zone's latest price, and the selected
 * zone's or the window's extremes (`ZoneKey`). Working: the zones compared,
 * their shape through the day, and each UK day (`ZonesPanel`). Side: About,
 * with why there is no GB zone and a link to the benchmark (`AboutPrices`).
 */
import { instantLabel } from '../../../design/time'
import { mainSrc } from '../../_template/defaults'
import { relatedParts } from '../../_template/panelHelpers'
import { SourceLine } from '../../_template/panels'
import type { PageContext } from '../../define'
import { defineView } from '../../define'
import { AboutPrices } from './AboutPrices'
import { AREA, AXIS_WIDTH, GB_KEY, GB_PRICE, GROUPS, PRICE, seriesOf } from './figures'
import { ZoneKey } from './ZoneKey'
import { ZonesBody } from './ZonesBody'
import { ZonesPanel } from './ZonesPanel'

/** The GB benchmark's part of a source line, once it is read. */
function gbParts(ctx: PageContext, withColumns: boolean) {
  const gb = seriesOf(ctx.related[GB_KEY]?.series, GB_PRICE)
  return gb ? relatedParts(ctx, [gb], withColumns) : []
}

const view = defineView({
  title: 'Day-ahead prices',
  sub: 'The price each day-ahead auction set in five European bidding zones, in euros per MWh, over gridflow’s GB benchmark in pounds, as ENTSO-E has no GB zone.',
  caveats: [
    'There is no GB zone in this data: gridflow asks ENTSO-E for GB with these five zones, and ENTSO-E has published no GB day-ahead price since Brexit.',
    'France, the Netherlands, Belgium and Germany / Luxembourg are priced per quarter-hour, Ireland (SEM) per hour, and every price held is in euros.',
    'A continental delivery day runs from midnight to midnight Central European time, 23:00 to 23:00 on the UK clock. This page reads every price on the UK clock and by UK day, so a UK day’s mean is not a delivery day’s.',
    'Prices below zero are as the auctions set them. A quarter-hour or hour not held locally is a gap, never a zero.',
  ],
  datasets: [
    {
      id: 'day_ahead_prices',
      body: 'series',
      label: 'Day-ahead prices',
      title: 'Day-ahead price per zone',
      query: { group: AREA, filters: { currency: 'EUR' } },
      values: [{ column: PRICE, label: 'Day-ahead price', unit: 'EUR/MWh' }],
      groups: GROUPS,
      related: [
        {
          key: GB_KEY,
          source: 'gold',
          dataset: 'gold_gb_day_ahead_benchmark',
          label: 'GB benchmark',
          values: [{ column: GB_PRICE, label: 'GB benchmark', color: 'var(--chart-price)' }],
        },
      ],
      // What the page draws, for the template's source lines and table: the zones, and GB's benchmark under them.
      chart: { mark: 'line', lower: { from: GB_KEY, mark: 'line', height: 140 }, axisWidth: AXIS_WIDTH },
      panels: {
        main: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Day-ahead price per zone, with GB’s benchmark beneath' : 'Day-ahead price per zone'),
          src: mainSrc,
          Body: ZonesBody,
        },
        key: {
          title: 'Key',
          src: (ctx) => (
            <SourceLine ctx={ctx} columns={[PRICE]} by={AREA} filters={ctx.response?.filters} unit="€/MWh" also={gbParts(ctx, false)} what="each zone's latest price held, and the window's extremes" />
          ),
          Body: ZoneKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Zones compared, through the day and by day' : 'Zones compared, and by day'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[PRICE]}
              by={AREA}
              filters={ctx.response?.filters}
              unit="€/MWh"
              what={ctx.mode === 'chart' ? 'per zone: steps held, mean, lowest, highest and below zero; the mean at each UK clock time; and the mean per UK day' : 'per zone: steps held, mean, lowest, highest and below zero; and the mean per UK day'}
            />
          ),
          Body: ZonesPanel,
        },
        side: {
          title: 'About this data',
          src: (ctx) => {
            const read = Date.parse(ctx.readAt)
            return <SourceLine ctx={ctx} also={gbParts(ctx, false)} what={Number.isFinite(read) ? `local coverage as read ${instantLabel(read)}` : 'local coverage'} window={false} />
          },
          Body: AboutPrices,
        },
      },
    },
  ],
})

export default view
