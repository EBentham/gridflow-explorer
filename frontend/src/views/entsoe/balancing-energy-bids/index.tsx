/**
 * ENTSO-E's balancing energy bids (`balancing_energy_bids`, v0.4 P4): the
 * MW each bid offers for balancing in a continental zone, per quarter-hour.
 *
 * The rows are one bid per quarter-hour, a thousand and more bids in all,
 * and the rows endpoint adds nothing up. So the page reads one zone and one
 * direction at a time, split by bid (`zones.ts`, `BidsControl`), and adds
 * the bids up itself (`figures.ts`): the MW offered and the bids at each
 * quarter-hour. Belgium and A01 by default, the one zone held through the
 * day.
 *
 * Values stay in MW: one bid runs from 1 to about 1,000 MW and a zone's
 * total from a few MW to a few thousand, which GW would flatten.
 *
 * Main: the MW offered per quarter-hour (`OfferedBody`). Key: the latest
 * quarter-hour, extremes, bids and the largest one bid (`BookKey`).
 * Working: the bids per quarter-hour on the same clock, then the days
 * (`BookDays`). Side: About, with the codes in words (`AboutBids`).
 *
 * France and Germany / Luxembourg hold one quarter-hour a day with 100 bids
 * in it, the mark of a paged reply cut off at its first page (the research
 * card's finding): every panel says their figures aren't complete.
 */
import { instantLabel } from '../../../design/time'
import { SourceLine } from '../../_template/panels'
import { defineView, type PageContext } from '../../define'
import { AboutBids } from './AboutBids'
import { BidsControl } from './BidsControl'
import { BookDays } from './BookDays'
import { BookKey } from './BookKey'
import { AXIS_WIDTH, pageBook } from './figures'
import { OfferedBody } from './OfferedBody'
import { AREA, BID, DIRECTION, QUANTITY, bidsQuery, DIR_PARAM, PRODUCT_PARAM, selectionText, ZONE_PARAM } from './zones'
import { oneStep, stepsText } from './words'

/** The filters the rows carry: as they came back, else as the parameters ask. */
function filtersOf(ctx: PageContext) {
  if (ctx.response?.filters) return ctx.response.filters
  const params = new URLSearchParams()
  for (const name of [ZONE_PARAM, DIR_PARAM, PRODUCT_PARAM]) {
    const v = ctx.param(name)
    if (v) params.set(name, v)
  }
  return bidsQuery(params).filters
}

const bucketed = (ctx: PageContext) => pageBook(ctx).book?.bucketed ?? false

function title(ctx: PageContext): string {
  const sel = pageBook(ctx)
  if (sel.book?.bucketed) return `Bids offered per ${oneStep(sel.book)}, ${selectionText(sel)}`
  return `Balancing energy offered, ${selectionText(sel)}`
}

const view = defineView({
  title: 'Balancing energy bids',
  sub: 'How much balancing energy is offered in a continental zone at each quarter-hour, and by how many bids, one zone and direction at a time.',
  caveats: [
    'Each row is one bid’s offered MW for one quarter-hour. The page adds up the bids offered at each quarter-hour; gridflow holds no price for them, and none of GB’s balancing.',
    'Direction is held as ENTSO-E codes it, A01 or A02. The page reads A01 as up and A02 as down, as ENTSO-E’s code list and gridflow’s activated-balancing tables do; this table itself keeps the codes.',
    'ENTSO-E sends these bids in pages, and gridflow’s downloader stops after a set number of pages. For France and Germany / Luxembourg it may have been cut off there: gridflow holds one quarter-hour a day for each, so their bids, counts and totals are not complete. Belgium is held for most of each UK day; the note under the chart names any hours every day lacks. Germany / Luxembourg holds A02 bids only.',
    'Belgium’s bids carry a product code, A05 or A07; gridflow gives no words for them. The page adds every product together unless one is picked. A window over 7 days reads one product at a time, A05 unless A07 is picked, as one bid id can carry both.',
  ],
  datasets: [
    {
      id: 'balancing_energy_bids',
      body: 'series',
      label: 'Balancing energy bids',
      title: 'Balancing energy offered',
      query: bidsQuery,
      controls: BidsControl,
      values: [{ column: QUANTITY, label: 'Offered', display: 'MW' }],
      // The page draws its own charts from the bids added up; lower: false keeps the template from planning a second panel.
      chart: { mark: 'stacked', lower: false, zero: true, axisWidth: AXIS_WIDTH },
      panels: {
        main: {
          title,
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[QUANTITY]}
              by={BID}
              filters={filtersOf(ctx)}
              unit={bucketed(ctx) ? 'bids' : 'MW'}
              what={
                ctx.mode === 'table'
                  ? bucketed(ctx)
                    ? 'offered per step, one row per step held, no MW added up'
                    : 'the bids added up, one row per step held'
                  : bucketed(ctx)
                    ? 'offered per step, no MW added up'
                    : 'the bids added up per quarter-hour'
              }
            />
          ),
          Body: OfferedBody,
        },
        key: {
          title: 'Key',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[QUANTITY]}
              by={BID}
              filters={filtersOf(ctx)}
              unit={bucketed(ctx) ? 'bids' : 'MW'}
              what={bucketed(ctx) ? 'the latest step held, and the window’s bids' : 'the latest quarter-hour held, and the window’s extremes, bids and largest bid'}
            />
          ),
          Body: BookKey,
        },
        working: {
          title: (ctx) => {
            const { book } = pageBook(ctx)
            return ctx.mode === 'chart' && book && !book.bucketed ? `Bids offered per ${oneStep(book)}, and the days` : 'The days'
          },
          src: (ctx) => {
            const { book } = pageBook(ctx)
            return (
              <SourceLine
                ctx={ctx}
                columns={[QUANTITY]}
                by={BID}
                filters={filtersOf(ctx)}
                unit={book?.bucketed ? 'bids' : 'bids and MW'}
                what={ctx.mode === 'chart' && book && !book.bucketed ? `bids per ${oneStep(book)}, then per UK day` : `per UK day${book ? `, from ${stepsText(book)}` : ''}`}
              />
            )
          },
          Body: BookDays,
        },
        side: {
          title: 'About this data',
          src: (ctx) => {
            const read = Date.parse(ctx.readAt)
            return <SourceLine ctx={ctx} columns={[AREA, DIRECTION]} what={Number.isFinite(read) ? `local coverage as read ${instantLabel(read)}` : 'local coverage'} window={false} />
          },
          Body: AboutBids,
        },
      },
    },
  ],
})

export default view
