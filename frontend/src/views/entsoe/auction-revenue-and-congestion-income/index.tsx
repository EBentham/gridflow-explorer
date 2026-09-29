/**
 * ENTSO-E's auction revenue and congestion income (v0.4 P4).
 *
 * - Auction revenue (`auction_revenue`): euros raised each hour by the
 *   explicit auctions of capacity on GB's borders with the Netherlands and
 *   Belgium, the only borders held. Main: the two borders stacked as bands
 *   (the tooltip's total is both borders' revenue that hour), with the
 *   capacity allocated on the same borders (`total_capacity_allocated`, GB as
 *   the in area) as lines beneath, in MW on an axis of its own. No revenue
 *   per MW is worked out: whether the capacity allocated counts the same
 *   auctions as the revenue isn't confirmed. Key: each border's total over
 *   the hours held, its hours at €0 and its highest hour (`RevenueKey`).
 *   Working: totals per UK day (`RevenueDays`). Side: About, with what the
 *   datasets are in words (`AboutAuction`).
 * - Congestion income (`congestion_income`): asked for and came back empty.
 *   It opens to the template's not-held state, and About says why in words.
 *
 * gridflow stores some border-hours more than once, with the same value each
 * time; the rows endpoint reads each (time, in area, out area, business type)
 * once, so every figure here counts a border-hour once.
 */
import { instantLabel } from '../../../design/time'
import { relatedParts } from '../../_template/panelHelpers'
import { SourceLine } from '../../_template/panels'
import { defineView, type PageContext, type SlotSpec } from '../../define'
import { AboutAuction } from './AboutAuction'
import { ALLOC_GROUPS, ALLOC_KEY, ALLOCATED, ALLOCATED_MW, AMOUNT, BORDERS, CONGESTION, GB, GB_BORDERS, IN_AREA, OUT_AREA, REVENUE } from './figures'
import { RevenueDays } from './RevenueDays'
import { RevenueKey } from './RevenueKey'

/** The filters the revenue rows carry: as they came back, else as asked. */
const revenueFilters = (ctx: PageContext) => ctx.response?.filters ?? { [IN_AREA]: GB }

/** The capacity allocated's part of a source line, once it is read. */
function allocatedParts(ctx: PageContext) {
  const defs = ctx.related[ALLOC_KEY]?.series?.drawn ?? []
  return defs.length ? relatedParts(ctx, defs) : []
}

const about: SlotSpec = {
  title: 'About this data',
  src: (ctx) => {
    const read = Date.parse(ctx.readAt)
    return <SourceLine ctx={ctx} what={Number.isFinite(read) ? `local coverage as read ${instantLabel(read)}` : 'local coverage'} window={false} />
  },
  Body: AboutAuction,
}

const view = defineView({
  title: 'Auction revenue and congestion income',
  sub: 'The euros raised each hour by the explicit auctions of capacity on GB’s borders with the Netherlands and Belgium, as ENTSO-E reports them, with the capacity allocated on each border beneath.',
  datasets: [
    {
      id: REVENUE,
      body: 'series',
      label: 'Auction revenue',
      title: 'Auction revenue per hour on GB’s borders',
      query: GB_BORDERS,
      values: [{ column: AMOUNT, label: 'Auction revenue' }],
      groups: BORDERS,
      related: [
        {
          key: ALLOC_KEY,
          source: 'entsoe',
          dataset: ALLOCATED,
          label: 'Capacity allocated',
          query: GB_BORDERS,
          values: [{ column: ALLOCATED_MW, label: 'Capacity allocated', display: 'MW' }],
          groups: ALLOC_GROUPS,
        },
      ],
      chart: { mark: 'stacked', lower: { from: ALLOC_KEY, mark: 'line', height: 150 } },
      caveats: [
        'ENTSO-E reports each border one direction at a time, naming an in area and an out area. Every row held names GB as the in area; which way the capacity sold runs isn’t confirmed, so the page names both areas, in area first, and never calls it import or export capacity.',
        'Only GB’s borders with the Netherlands and Belgium are held.',
        'The rows carry no currency. The amounts are read as euros, from the column’s name and gridflow’s research.',
        'An hour at €0 is as published. An hour not held is a gap, never €0, and adds nothing to a total.',
        'gridflow stores some border-hours more than once, with the same value each time. The page reads each border-hour once.',
        'The capacity allocated beneath is drawn under the same in and out areas. Whether it counts the same auctions as the revenue isn’t confirmed, so no revenue per MW is worked out.',
      ],
      panels: {
        key: {
          title: 'Borders',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[AMOUNT]}
              by={OUT_AREA}
              filters={revenueFilters(ctx)}
              unit="€"
              also={allocatedParts(ctx)}
              what="each border’s total over the hours held, its hours at €0 and its highest hour"
            />
          ),
          Body: RevenueKey,
        },
        working: {
          title: 'Revenue per UK day',
          src: (ctx) => <SourceLine ctx={ctx} columns={[AMOUNT]} by={OUT_AREA} filters={revenueFilters(ctx)} unit="€" what="hours held, total and highest hour per border and UK day" />,
          Body: RevenueDays,
        },
        side: about,
      },
    },
    {
      id: CONGESTION,
      body: 'series',
      label: 'Congestion income',
      sub: 'The congestion income ENTSO-E reports for implicit and flow-based allocation. gridflow asked for it and every answer was empty, so nothing is held.',
      panels: { side: about },
    },
  ],
})

export default view
