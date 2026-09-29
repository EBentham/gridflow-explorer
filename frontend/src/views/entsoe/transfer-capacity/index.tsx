/**
 * ENTSO-E's transfer capacity (v0.4 P4): how much capacity each border has,
 * and how much of it was taken, one direction per border.
 *
 * - Net transfer capacity (`net_transfer_capacity`), capacity allocated
 *   (`total_capacity_allocated`) and capacity nominated
 *   (`total_nominated_capacity`): one panel per border on the window's clock
 *   (`BorderCharts`). On GB's borders the other measures are drawn beside the
 *   page's own: allocated and nominated under the net transfer capacity, the
 *   net transfer capacity under allocated or nominated. A key of borders
 *   (`BorderKey`), the days of the selected border (`BorderDays`), and About
 *   with the area codes (`AboutFamily`). Borders are read one in area at a
 *   time (`InAreaControl`, `?in=`), as the rows split by one column only.
 * - The DC link's intraday limits (`dc_link_intraday_transfer_limits`):
 *   GB–Netherlands only, published only when a limit is set, drawn over that
 *   border's net transfer capacity.
 *
 * Four more datasets in the family came back empty and aren't held; the
 * template names them in the toolbar, and the caveats say why in words.
 *
 * Borders are named in area first (`GB–France`), with no arrow, as on the
 * flows page: which way the capacity runs in the direction held isn't
 * confirmed. Values stay in MW: the borders run from under 500 MW to about
 * 4,500, and GW would hide the smaller.
 */
import { instantLabel, periodLabel } from '../../../design/time'
import { relatedParts } from '../../_template/panelHelpers'
import { SourceLine } from '../../_template/panels'
import { defineView, type PageContext, type PanelSlots, type RelatedSpec, type SeriesView, type SlotSpec } from '../../define'
import { AboutFamily } from './AboutFamily'
import { areaPhrase, borderQuery, GB, GB_QUERY, IN_PARAM, inAreaCode } from './areas'
import { BorderCharts } from './BorderCharts'
import { BorderDays } from './BorderDays'
import { BorderKey } from './BorderKey'
import { AXIS_WIDTH } from './figures'
import { InAreaControl } from './InAreaControl'
import { ALLOCATED, BESIDE, bordersOf, DC_LIMITS, focusedBorder, inAreaOf, latestStamp, MEASURES, measureOf, NOMINATED, NTC } from './model'

const MW = 'MW'

/** The filters a border read carries: as the rows came back, else as asked. */
const borderFilters = (ctx: PageContext) => ctx.response?.filters ?? { in_area_code: inAreaCode(ctx.view.id, ctx.param(IN_PARAM)) }

/** The measures drawn beside the borders, for a source line, once they are read. */
function besideParts(ctx: PageContext, out?: string) {
  const defs = bordersOf(ctx).flatMap((b) => (!out || b.out === out ? b.beside.map((x) => x.line.def) : []))
  return defs.length ? relatedParts(ctx, defs) : []
}

const about: SlotSpec = {
  title: 'About this data',
  src: (ctx) => {
    const read = Date.parse(ctx.readAt)
    return <SourceLine ctx={ctx} what={Number.isFinite(read) ? `local coverage as read ${instantLabel(read)}` : 'local coverage'} window={false} />
  },
  Body: AboutFamily,
}

function panels(title: string): PanelSlots {
  return {
    main: {
      title: (ctx) => {
        const code = inAreaOf(ctx)
        if (ctx.view.id === DC_LIMITS) return title
        return code === GB ? `${title} on GB’s borders` : `${title}, ${areaPhrase(code)} as the in area`
      },
      src: (ctx) => (
        <SourceLine
          ctx={ctx}
          columns={[measureOf(ctx).column]}
          by="out_area_code"
          filters={borderFilters(ctx)}
          unit={MW}
          also={besideParts(ctx)}
          what={ctx.mode === 'table' ? 'one row per border and time held' : 'one panel per border'}
        />
      ),
      Body: BorderCharts,
    },
    key: {
      title: 'Borders',
      src: (ctx) => {
        const stamp = latestStamp(bordersOf(ctx).map((b) => b.own))
        return (
          <SourceLine
            ctx={ctx}
            columns={[measureOf(ctx).column]}
            by="out_area_code"
            filters={borderFilters(ctx)}
            unit={MW}
            what={`${stamp ? `latest held values, ${periodLabel(stamp.t, stamp.step)}` : 'latest held values'}, and the steps each border holds`}
            window={false}
          />
        )
      },
      Body: BorderKey,
    },
    working: {
      title: (ctx) => {
        const b = focusedBorder(ctx, bordersOf(ctx))
        return b ? `The days on ${b.name}` : 'The days'
      },
      src: (ctx) => {
        const b = focusedBorder(ctx, bordersOf(ctx))
        return (
          <SourceLine
            ctx={ctx}
            columns={[measureOf(ctx).column]}
            by="out_area_code"
            filters={borderFilters(ctx)}
            unit={MW}
            also={b ? besideParts(ctx, b.out) : []}
            what={b ? `${b.name} per UK day: values held, mean, lowest, highest and zeros` : 'per UK day'}
          />
        )
      },
      Body: BorderDays,
    },
    side: about,
  }
}

/** The measures read beside a dataset's own, for GB's borders. */
const besideReads = (dataset: string): RelatedSpec[] =>
  BESIDE[dataset].map((m) => ({
    key: m.key,
    source: 'entsoe',
    dataset: m.dataset,
    label: m.label,
    query: GB_QUERY,
    values: [{ column: m.column, label: m.label, display: 'MW' as const }],
  }))

/** A border dataset of the page: its own measure, the ones beside it, and the in-area control. */
function border(dataset: string, extra: Pick<SeriesView, 'label' | 'title' | 'sub' | 'caveats'>): SeriesView {
  const m = MEASURES[dataset]
  return {
    id: dataset,
    body: 'series',
    ...extra,
    values: [{ column: m.column, label: m.label, display: 'MW' }],
    query: borderQuery(dataset),
    related: besideReads(dataset),
    controls: InAreaControl,
    chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
    panels: panels(extra.title ?? extra.label),
  }
}

const BESIDE_GB = 'They’re read for GB’s borders only, so a border with France or the Netherlands as the in area is drawn alone.'

const view = defineView({
  title: 'Transfer capacity',
  sub: 'How much capacity ENTSO-E reports on GB’s borders with France, the Netherlands, Belgium and Ireland (SEM), and on some borders on the continent: the day-ahead net transfer capacity, the capacity allocated and nominated, and the intraday limits on the GB–Netherlands link, one direction per border.',
  caveats: [
    'ENTSO-E reports a border’s capacity one direction at a time, naming an in area and an out area. gridflow asks for one direction on each border, so the other direction isn’t held. The page names both areas as ENTSO-E does, in area first, and doesn’t say which way the capacity runs.',
    'Four more datasets in this family came back empty when gridflow asked ENTSO-E for them, and aren’t drawn: the capacity offered for explicit, implicit and continuous allocation, and the use of transfer capacity. For all three offered-capacity datasets, ENTSO-E’s reply named its implicit-allocation data, so the explicit and continuous ones may not have been asked for as intended.',
  ],
  datasets: [
    border(NTC, {
      label: 'Net transfer capacity',
      title: 'Net transfer capacity',
      sub: 'The day-ahead net transfer capacity ENTSO-E publishes for each border, one direction per border, with the capacity allocated and nominated beside it on GB’s borders.',
      caveats: [
        'One value per hour. The capacity moves in steps and often holds one value for days; a flat run and a zero are as published.',
        `On GB’s borders the capacity allocated and the capacity nominated are drawn beside the net transfer capacity, under the same in and out area codes. ${BESIDE_GB}`,
      ],
    }),
    border(ALLOCATED, {
      label: 'Capacity allocated',
      title: 'Capacity allocated',
      sub: 'The capacity ENTSO-E reports as already allocated on each border in earlier auctions, one direction per border, with the net transfer capacity beside it on GB’s borders.',
      caveats: ['One value per hour, and it rarely changes: a flat run and a zero are as published.', `On GB’s borders the net transfer capacity is drawn beside it, under the same in and out area codes. ${BESIDE_GB}`],
    }),
    border(NOMINATED, {
      label: 'Capacity nominated',
      title: 'Capacity nominated',
      sub: 'The total capacity ENTSO-E reports as nominated on each border, one direction per border, with the net transfer capacity beside it on GB’s borders.',
      caveats: [
        'Hourly on GB’s borders and every 15 minutes between France and Germany / Luxembourg, as published.',
        `On GB’s borders the net transfer capacity is drawn beside it, under the same in and out area codes. ${BESIDE_GB}`,
      ],
    }),
    border(DC_LIMITS, {
      label: 'DC link limits',
      title: 'Intraday limit on the GB–Netherlands link',
      sub: 'The intraday transfer limit ENTSO-E publishes for the GB–Netherlands DC link when one is set, over that border’s net transfer capacity.',
      caveats: [
        'ENTSO-E publishes a limit only when one is set, and gridflow holds it for GB–Netherlands only. An hour with no limit held may be an hour with no limit set, or one not fetched locally; the page can’t tell them apart and names no gap.',
        'The net transfer capacity is drawn beside the limit, under the same in and out area codes.',
      ],
    }),
  ],
})

export default view
