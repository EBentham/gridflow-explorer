/**
 * Elexon's demand forecasts: what GB's electricity demand was forecast to
 * be. The national demand forecast per half-hour (`ndf`) opens the page,
 * with national demand outturn (`indo`) read beside it; the transmission
 * demand forecast per half-hour (`tsdf`, boundary N by default) gets the
 * same page against transmission demand outturn (`itsdo`). The two daily
 * forecasts for two to fourteen days ahead (`ndfd`, `tsdfd`) each read the
 * other, lined up on the delivery date, and their outturn's daily peak and
 * mean. Every dataset says which issue of the forecast it shows: the keys
 * read how far ahead each held forecast was issued from the rows themselves.
 */
import { SourceLine } from '../../_template/panels'
import { relatedFilters, type SourcePart } from '../../_template/panelHelpers'
import type { PageContext, RelatedSpec, SlotSpec } from '../../define'
import { defineView } from '../../define'
import { BoundaryControl } from './BoundaryControl'
import { DailyKey } from './DailyKey'
import { DailyPanel } from './DailyPanel'
import {
  AXIS_WIDTH,
  BOUNDARY,
  BOUNDARY_PARAM,
  BOUNDARIES,
  COLORS,
  FORECAST_TYPE,
  INDO,
  ITSDO,
  NATIONAL_BOUNDARY,
  NATIONAL_FC,
  NDF,
  NDFD,
  OTHER_KEY,
  OUTTURN_KEY,
  TRANSMISSION_FC,
  TSDF,
  TSDFD,
  boundaryOf,
  forecastColumn,
  outturnColumn,
} from './figures'
import { HalfHourKey } from './HalfHourKey'
import { HorizonControl } from './HorizonControl'
import { OutturnPanel } from './OutturnPanel'

/** A related dataset in a source line, named in full with the filters its rows carry. */
function relPart(ctx: PageContext, key: string, column: string): SourcePart[] {
  const rel = ctx.related[key]
  if (!rel) return []
  return [{ source: rel.source, dataset: rel.spec.dataset, columns: [column], filters: relatedFilters(rel), unit: 'GW' }]
}

const ownFilters = (ctx: PageContext) => ctx.response?.filters
const comparable = (ctx: PageContext) => ctx.dataset.id === NDF || boundaryOf(ctx) === NATIONAL_BOUNDARY

const halfHourPanels: { key: SlotSpec; working: SlotSpec } = {
  key: {
    title: 'Key',
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[forecastColumn(ctx.dataset.id), 'published_at']}
        filters={ownFilters(ctx)}
        unit="GW"
        also={comparable(ctx) ? relPart(ctx, OUTTURN_KEY, outturnColumn(ctx.dataset.id)) : []}
        what="the latest half-hour held, the window's peak and trough, how far ahead the forecasts drawn were issued, and the miss against outturn in MW"
      />
    ),
    Body: HalfHourKey,
  },
  working: {
    title: (ctx) => (ctx.mode === 'chart' ? 'Forecast against outturn, and the days' : 'The days, against outturn'),
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[forecastColumn(ctx.dataset.id)]}
        filters={ownFilters(ctx)}
        unit="GW"
        also={comparable(ctx) ? relPart(ctx, OUTTURN_KEY, outturnColumn(ctx.dataset.id)) : []}
        what={ctx.mode === 'chart' ? 'the forecast and its outturn per half-hour with outturn less forecast in MW, then each UK day' : 'each UK day: the forecast, its outturn and the miss in MW'}
      />
    ),
    Body: OutturnPanel,
  },
}

const dailyPanels: { key: SlotSpec; working: SlotSpec } = {
  key: {
    title: 'Key',
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[forecastColumn(ctx.dataset.id), 'published_at']}
        filters={ownFilters(ctx)}
        unit="GW"
        also={relPart(ctx, OUTTURN_KEY, outturnColumn(ctx.dataset.id))}
        what="the highest and lowest delivery day, the newest issue held, and the forecast less the outturn's daily peak and mean"
      />
    ),
    Body: DailyKey,
  },
  working: {
    title: (ctx) => (ctx.mode === 'chart' ? 'Both daily forecasts beside outturn, and the days' : 'The delivery days'),
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[forecastColumn(ctx.dataset.id), 'published_at']}
        filters={ownFilters(ctx)}
        unit="GW"
        also={[...relPart(ctx, OTHER_KEY, ctx.dataset.id === NDFD ? TRANSMISSION_FC : NATIONAL_FC), ...relPart(ctx, OUTTURN_KEY, outturnColumn(ctx.dataset.id))]}
        what="each delivery day: both forecasts lined up on the date, their issue, and the outturn's daily peak and mean"
      />
    ),
    Body: DailyPanel,
  },
}

const indo: RelatedSpec = {
  key: OUTTURN_KEY,
  source: 'elexon',
  dataset: 'indo',
  label: 'National demand outturn',
  values: [{ column: INDO, label: 'National demand outturn', color: COLORS.outturn }],
}
const itsdo: RelatedSpec = {
  key: OUTTURN_KEY,
  source: 'elexon',
  dataset: 'itsdo',
  label: 'Transmission demand outturn',
  values: [{ column: ITSDO, label: 'Transmission demand outturn', color: COLORS.outturn }],
}

const DAILY_CAVEATS = {
  issue:
    'Each delivery day shows the latest issue of the forecast held for it. Each issue covers the days two to fourteen days ahead, and gridflow has fetched it on only some days, so a day’s figure can come from an issue made up to two weeks before. The key and the working panel name the issue behind each figure.',
  ahead: 'These forecasts run up to two weeks past today. The toolbar’s windows stop at the latest local day; “On to” in the toolbar runs the window on to the last day forecast.',
}

const view = defineView({
  title: 'Demand forecasts',
  sub: 'What GB’s electricity demand was forecast to be: national and transmission demand half-hour by half-hour for the next day or so, and one figure a day for two to fourteen days ahead.',
  datasets: [
    {
      id: NDF,
      body: 'series',
      label: 'National, half-hourly',
      title: 'National demand forecast per half-hour',
      caveats: [
        'Each half-hour shows the latest issue of the forecast held for it. Elexon reissues this forecast through the day and gridflow keeps every issue, so what is drawn is often an issue made shortly before the half-hour began rather than the day before, although the rows name their type day-ahead. The key reads how far ahead the forecasts drawn in this window were issued; the misses against outturn are those issues’ misses, not a day-ahead forecast’s.',
      ],
      query: { filters: { [FORECAST_TYPE]: 'day_ahead' } },
      values: [{ column: NATIONAL_FC, label: 'National demand forecast', color: COLORS.national }],
      related: [indo],
      chart: { mark: 'line', extremes: true, lower: false, axisWidth: AXIS_WIDTH },
      panels: halfHourPanels,
    },
    {
      id: TSDF,
      body: 'series',
      label: 'Transmission, half-hourly',
      title: 'Transmission demand forecast per half-hour',
      sub: 'The forecast of transmission system demand, half-hour by half-hour, for the whole system (boundary N) or one of 17 boundaries within it.',
      caveats: [
        'This is not the latest forecast. gridflow keeps only the first issue of this forecast from each day it fetches it, a known fault in gridflow that is not yet fixed, so later issues that day, the ones made closest to each half-hour, aren’t held. Each half-hour shows that first issue from the latest day it was fetched for it; the key reads how far ahead those were issued.',
        'Boundary N is the whole system and opens by default; B1 to B17 are named by their codes, as the rows don’t say what area each bounds. Only N is set against outturn, which is held for the whole system alone.',
      ],
      query: (params) => {
        const b = params.get(BOUNDARY_PARAM)
        return { filters: { [BOUNDARY]: b && BOUNDARIES.includes(b) ? b : NATIONAL_BOUNDARY } }
      },
      controls: BoundaryControl,
      values: [{ column: TRANSMISSION_FC, label: 'Transmission demand forecast', color: COLORS.transmission }],
      related: [itsdo],
      chart: { mark: 'line', extremes: true, lower: false, axisWidth: AXIS_WIDTH },
      panels: halfHourPanels,
    },
    {
      id: NDFD,
      body: 'series',
      label: 'National, 2 to 14 days',
      title: 'National demand forecast per day, 2 to 14 days ahead',
      sub: 'One figure of national demand for each day two to fourteen days ahead, set beside the transmission forecast and the demand that came.',
      caveats: [
        DAILY_CAVEATS.issue,
        'The figure is in MW, one per day, but whether it stands for the day’s peak or its mean is unconfirmed: the description that would settle it isn’t held here. The working panel sets national demand outturn’s daily peak and mean beside it, for comparison only.',
        DAILY_CAVEATS.ahead,
      ],
      query: { filters: { [FORECAST_TYPE]: '2_14_day' } },
      controls: HorizonControl,
      values: [{ column: NATIONAL_FC, label: 'National demand forecast', color: COLORS.national }],
      related: [
        {
          key: OTHER_KEY,
          source: 'elexon',
          dataset: TSDFD,
          label: 'Transmission demand forecast, daily',
          values: [{ column: TRANSMISSION_FC, label: 'Transmission demand forecast', color: COLORS.transmission }],
        },
        indo,
      ],
      chart: { mark: 'line', extremes: true, lower: false, axisWidth: AXIS_WIDTH },
      panels: dailyPanels,
    },
    {
      id: TSDFD,
      body: 'series',
      label: 'Transmission, 2 to 14 days',
      title: 'Transmission demand forecast per day, 2 to 14 days ahead',
      sub: 'One figure of transmission system demand for each day two to fourteen days ahead, set beside the national forecast and the demand that came.',
      caveats: [
        DAILY_CAVEATS.issue,
        'The figure is in MW, one per day. As with the national figure, whether it stands for the day’s peak or its mean isn’t confirmed here; the working panel sets transmission demand outturn’s daily peak and mean beside it, for comparison only.',
        'Its rows are stamped at midnight UTC, an hour after the national figure’s UK midnight in summer. The two are lined up on the delivery date, never on the stamp.',
        DAILY_CAVEATS.ahead,
      ],
      controls: HorizonControl,
      values: [{ column: TRANSMISSION_FC, label: 'Transmission demand forecast', color: COLORS.transmission }],
      related: [
        {
          key: OTHER_KEY,
          source: 'elexon',
          dataset: NDFD,
          label: 'National demand forecast, daily',
          query: { filters: { [FORECAST_TYPE]: '2_14_day' } },
          values: [{ column: NATIONAL_FC, label: 'National demand forecast', color: COLORS.national }],
        },
        itsdo,
      ],
      chart: { mark: 'line', extremes: true, lower: false, axisWidth: AXIS_WIDTH },
      panels: dailyPanels,
    },
  ],
})

export default view
