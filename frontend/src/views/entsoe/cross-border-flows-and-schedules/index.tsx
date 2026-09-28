/**
 * ENTSO-E's cross-border flows and schedules (v0.4 P4): what crosses GB's
 * four borders, and four borders on the continent, one direction per border.
 *
 * - Physical flow (`cross_border_flows`) and commercial schedule
 *   (`commercial_schedules`): one panel per border on the window's clock
 *   (`BorderCharts`), with the other dataset drawn beside each GB border, a
 *   key of borders with their steps as held (`BorderKey`), the days of the
 *   selected border (`BorderDays`), and About with the area codes
 *   (`AboutFamily`). The rows split by one column only, so the borders are
 *   read one in area at a time (`InAreaControl`, `?in=`).
 * - Net positions (`net_positions`): one panel per continental zone, the two
 *   sides ENTSO-E names the zone on drawn apart and never netted, as the sign
 *   is unconfirmed (`ZoneCharts`, `ZoneKey`, `ZoneDays`).
 *
 * Borders are named in area first (`GB–France`), with no arrow: which way the
 * power moves in the direction held isn't confirmed. Values stay in MW: the
 * borders run from under 300 MW to about 3,000, and GW would hide the smaller.
 */
import { instantLabel, periodLabel } from '../../../design/time'
import { relatedParts } from '../../_template/panelHelpers'
import { SourceLine } from '../../_template/panels'
import { defineView, type PageContext, type PanelSlots, type SlotSpec } from '../../define'
import { AboutFamily } from './AboutFamily'
import { areaName, AREA_GROUPS, borderQuery, GB, GB_QUERY, IN_PARAM, IN_SIDE_QUERY, inAreaCode, OUT_SIDE_QUERY } from './areas'
import { BorderCharts } from './BorderCharts'
import { BorderDays } from './BorderDays'
import { BorderKey } from './BorderKey'
import { AXIS_WIDTH } from './figures'
import { InAreaControl } from './InAreaControl'
import { bordersOf, FLOW_ROLE, focusedBorder, focusedZone, inAreaOf, latestStamp, OUT_SIDE_KEY, roleOf, SCHEDULE_ROLE, zonesOf, type Line } from './model'
import { ZoneCharts } from './ZoneCharts'
import { ZoneDays } from './ZoneDays'
import { ZoneKey } from './ZoneKey'

const MW = 'MW'
const NET_UNIT = 'MW, sign unconfirmed'

/** The filters a border read carries: as the rows came back, else as asked. */
const borderFilters = (ctx: PageContext) => ctx.response?.filters ?? { in_area_code: inAreaCode(ctx.param(IN_PARAM)) }

/** `latest held values, Mon 21 Sep, 00:45–01:00 BST`: the time a key's latest values are at. */
function latestText(lines: (Line | null)[]): string {
  const stamp = latestStamp(lines)
  return stamp ? `latest held values, ${periodLabel(stamp.t, stamp.step)}` : 'latest held values'
}

/** The dataset drawn beside the borders, for a source line, once it is read. */
function besideParts(ctx: PageContext, out?: string) {
  const defs = bordersOf(ctx).flatMap((b) => (b.beside && (!out || b.out === out) ? [b.beside.def] : []))
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

/** The four panels of a border dataset: the flow or the schedule. */
function borderPanels(measure: string): PanelSlots {
  return {
    main: {
      title: (ctx) => {
        const code = inAreaOf(ctx)
        return code === GB ? `${measure} on GB’s borders` : `${measure}, ${areaName(code)} as the in area`
      },
      src: (ctx) => (
        <SourceLine
          ctx={ctx}
          columns={[roleOf(ctx).column]}
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
      src: (ctx) => (
        <SourceLine
          ctx={ctx}
          columns={[roleOf(ctx).column]}
          by="out_area_code"
          filters={borderFilters(ctx)}
          unit={MW}
          what={`${latestText(bordersOf(ctx).map((b) => b.own))}, and the steps each border holds`}
          window={false}
        />
      ),
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
            columns={[roleOf(ctx).column]}
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

const outsideParts = (ctx: PageContext) => {
  const defs = zonesOf(ctx).flatMap((z) => (z.outSide ? [z.outSide.def] : []))
  return defs.length ? relatedParts(ctx, defs) : []
}
const netFilters = (ctx: PageContext) => ctx.response?.filters ?? IN_SIDE_QUERY.filters ?? null

const zonePanels: PanelSlots = {
  main: {
    title: 'Net position by zone, sign unconfirmed',
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={['quantity_mw']}
        by="in_area_code"
        filters={netFilters(ctx)}
        unit={NET_UNIT}
        also={outsideParts(ctx)}
        what={ctx.mode === 'table' ? 'one row per zone and quarter-hour held, with the side it is named on' : 'one panel per zone, its two sides apart'}
      />
    ),
    Body: ZoneCharts,
  },
  key: {
    title: 'Zones',
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={['quantity_mw']}
        by="in_area_code"
        filters={netFilters(ctx)}
        unit={NET_UNIT}
        also={outsideParts(ctx)}
        what={`${latestText(zonesOf(ctx).flatMap((z) => [z.inSide, z.outSide]))}, and each zone’s quarter-hours on each side`}
        window={false}
      />
    ),
    Body: ZoneKey,
  },
  working: {
    title: (ctx) => {
      const z = focusedZone(ctx, zonesOf(ctx))
      return z ? `The days in ${z.phrase}` : 'The days'
    },
    src: (ctx) => {
      const z = focusedZone(ctx, zonesOf(ctx))
      return (
        <SourceLine
          ctx={ctx}
          columns={['quantity_mw']}
          by="in_area_code"
          filters={netFilters(ctx)}
          unit={NET_UNIT}
          also={outsideParts(ctx)}
          what={z ? `${z.name} per UK day: quarter-hours held on each side, and each side’s mean` : 'per UK day'}
        />
      )
    },
    Body: ZoneDays,
  },
  side: about,
}

const ONE_DIRECTION = 'gridflow asks for one direction on each border, with the first-named area as the in area, so the other direction isn’t held and nothing here is a net figure.'

const view = defineView({
  title: 'Cross-border flows and schedules',
  sub: 'What crosses GB’s borders with France, the Netherlands, Belgium and Ireland (SEM), and four borders on the continent, as ENTSO-E reports it: the physical flow and the commercial schedule, one direction per border, and the continent’s net positions.',
  datasets: [
    {
      id: 'cross_border_flows',
      body: 'series',
      label: 'Physical flow',
      title: 'Physical flow by border',
      sub: 'The physical flow ENTSO-E reports on GB’s four borders and four on the continent, one direction per border, with each GB border’s commercial schedule beside it.',
      caveats: [
        `ENTSO-E reports a border’s flow one direction at a time, naming an in area and an out area. ${ONE_DIRECTION}`,
        'Which way the power moves in the direction held, into the in area or out of it, isn’t confirmed, so the page names both areas as ENTSO-E does and never calls a flow an import or an export.',
        'In the days gridflow holds, GB–France comes once an hour where GB–Belgium and GB–Netherlands come every 15 minutes, so it holds about a quarter as many rows; why ENTSO-E’s GB–France flow is hourly isn’t known. GB–Ireland (SEM) is hourly too, with some hours missing: they show as gaps.',
      ],
      values: [{ column: FLOW_ROLE.column, label: 'Physical flow', display: 'MW' }],
      groups: AREA_GROUPS,
      query: borderQuery,
      related: [
        {
          key: FLOW_ROLE.besideKey,
          source: 'entsoe',
          dataset: 'commercial_schedules',
          label: 'Commercial schedule',
          query: GB_QUERY,
          values: [{ column: SCHEDULE_ROLE.column, label: 'Commercial schedule', display: 'MW' }],
          groups: AREA_GROUPS,
        },
      ],
      controls: InAreaControl,
      chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
      panels: borderPanels('Physical flow'),
    },
    {
      id: 'commercial_schedules',
      body: 'series',
      label: 'Commercial schedule',
      title: 'Commercial schedule by border',
      sub: 'The final commercial schedule ENTSO-E publishes for each border, one direction per border, with each GB border’s physical flow beside it.',
      caveats: [
        `ENTSO-E publishes a border’s commercial schedule one direction at a time, naming an in area and an out area. ${ONE_DIRECTION}`,
        'Which way the scheduled power moves in the direction held isn’t confirmed, so the page names both areas as ENTSO-E does and never calls a schedule an import or an export.',
        'On GB’s borders the schedule comes once an hour; on the continental pairs, every 15 minutes.',
      ],
      values: [{ column: SCHEDULE_ROLE.column, label: 'Commercial schedule', display: 'MW' }],
      groups: AREA_GROUPS,
      query: borderQuery,
      related: [
        {
          key: SCHEDULE_ROLE.besideKey,
          source: 'entsoe',
          dataset: 'cross_border_flows',
          label: 'Physical flow',
          query: GB_QUERY,
          values: [{ column: FLOW_ROLE.column, label: 'Physical flow', display: 'MW' }],
          groups: AREA_GROUPS,
        },
      ],
      controls: InAreaControl,
      chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
      panels: borderPanels('Commercial schedule'),
    },
    {
      id: 'net_positions',
      body: 'series',
      label: 'Net positions',
      title: 'Net position by zone, sign unconfirmed',
      sub: 'Each continental zone’s net position from the implicit auction, as ENTSO-E publishes it, with the zone named on one side of the record or the other: the sign is unconfirmed.',
      caveats: [
        'Sign unconfirmed. ENTSO-E names each zone as the in area or as the out area of its net position, with a placeholder in place of the other, so the side the zone is on carries the sign. Which side means the zone is exporting isn’t confirmed, so the page draws the two sides apart and never nets them into one signed line.',
        'Only the four continental zones hold net positions here: none is held for Great Britain.',
      ],
      values: [{ column: 'quantity_mw', label: 'Net position, sign unconfirmed', display: 'MW' }],
      groups: AREA_GROUPS,
      query: IN_SIDE_QUERY,
      related: [
        {
          key: OUT_SIDE_KEY,
          source: 'entsoe',
          dataset: 'net_positions',
          label: 'Net position, zone named as the out area',
          query: OUT_SIDE_QUERY,
          values: [{ column: 'quantity_mw', label: 'Net position, sign unconfirmed', display: 'MW' }],
          groups: AREA_GROUPS,
        },
      ],
      chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
      panels: zonePanels,
    },
  ],
})

export default view
