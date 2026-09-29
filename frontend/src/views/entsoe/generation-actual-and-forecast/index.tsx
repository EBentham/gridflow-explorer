/**
 * ENTSO-E's generation family, for GB's continental neighbours and Ireland
 * (ENTSO-E publishes nothing for GB since Brexit). Three of its four
 * datasets are drawn:
 *
 * - `wind_solar_forecast` opens the page: one zone at a time (`?zone=`),
 *   onshore wind, offshore wind and solar stacked, with the zone's total
 *   generation forecast (`generation_forecast`, read beside it) under the
 *   stack and set against it in the working panel (`WindSolarBody`,
 *   `WindSolarKey`, `WindSolarPanel`);
 * - `generation_forecast`: each zone's total as a line, set against its
 *   day-ahead load forecast (`load_forecast`, read beside it) in the working
 *   panel (`TotalBody`, `TotalKey`, `BalancePanel`);
 * - `actual_generation_units`: one zone and one production type at a time
 *   (`?zone=`, `?type=`), the largest units as lines, every unit and their
 *   sum in the working panel (`UnitsBody`, `UnitsKey`, `UnitsPanel`).
 *
 * `actual_generation` is held but left off the page, and a caveat says why:
 * the copy held can keep a type's consumption in place of its generation.
 * Every chart marks each series' missing steps on its own clock (`figures.ts`),
 * as these rows have no single step (NEEDS.md).
 */
import { mainSrc } from '../../_template/defaults'
import { relatedFilters, type SourcePart } from '../../_template/panelHelpers'
import { SourceLine } from '../../_template/panels'
import type { PageContext } from '../../define'
import { defineView } from '../../define'
import { BalancePanel } from './BalancePanel'
import {
  AREA,
  AXIS_WIDTH,
  filteredType,
  filteredZone,
  FORECAST,
  LOAD,
  LOAD_ID,
  LOAD_KEY,
  OUTPUT,
  TOTAL_ID,
  TOTAL_KEY,
  TOTAL_ZONES,
  TYPE,
  typeFrom,
  UNIT,
  UNIT_ZONES,
  UNITS_ID,
  WS_ID,
  WS_TYPES,
  WS_ZONES,
  zoneFrom,
  zoneGroups,
} from './figures'
import { TotalBody } from './TotalBody'
import { TotalKey } from './TotalKey'
import { zoneForecasts, zoneInView } from './total'
import { UnitControls } from './UnitControls'
import { UNITS_DRAWN } from './units'
import { UnitsBody } from './UnitsBody'
import { UnitsKey } from './UnitsKey'
import { UnitsPanel } from './UnitsPanel'
import { WindSolarBody } from './WindSolarBody'
import { WindSolarKey } from './WindSolarKey'
import { windSolarOf } from './windSolar'
import { WindSolarPanel } from './WindSolarPanel'
import { ZoneControl } from './ZoneControl'

/** A related dataset, named in full in a source line. */
function relatedPart(ctx: PageContext, key: string, column: string): SourcePart[] {
  const rel = ctx.related[key]
  if (!rel) return []
  return [{ source: rel.source, dataset: rel.spec.dataset, columns: [column], by: AREA, filters: relatedFilters(rel), unit: 'GW' }]
}

const wsZone = (ctx: PageContext) => filteredZone(ctx, WS_ZONES).label
/** Whether the zone's total generation forecast is held beside its wind and solar in this window. */
const hasTotal = (ctx: PageContext) => Boolean(windSolarOf(ctx)?.total)
const totalZone = (ctx: PageContext) => zoneInView(ctx, zoneForecasts(ctx))?.zone.label ?? 'one zone'
const unitWhat = (ctx: PageContext) => `${filteredType(ctx).label.toLowerCase()} units in ${filteredZone(ctx, UNIT_ZONES).prose}`

const view = defineView({
  title: 'Generation, actual and forecast',
  sub: 'What GB’s continental neighbours and Ireland expected to generate the day before, from wind, from the sun and in all, and what their individual generating units produced.',
  caveats: [
    'ENTSO-E has published no generation figures for GB since Brexit, so GB isn’t here. The zones are Germany-Luxembourg, France, the Netherlands, Belgium and Ireland’s single market, as each dataset holds them; they matter to GB through the interconnectors.',
    'ENTSO-E’s actual generation by production type is held too, but not shown. In the copy held here, a type that both generates and consumes, such as pumped storage, can carry the power it consumed in place of the power it generated, and the rows don’t say which. Drawn, it would mislead, so the page leaves it out until the two are kept apart.',
    'Every time is on the UK clock, an hour behind the continental zones’ Central European time (19:00 there reads 18:00 here); Ireland keeps the UK clock.',
  ],
  datasets: [
    {
      id: WS_ID,
      body: 'series',
      label: 'Wind and solar forecast',
      sub: 'ENTSO-E’s forecast, made the day before, of how much electricity onshore wind, offshore wind and solar would generate in one zone, set against the zone’s total generation forecast.',
      caveats: [
        'Each step holds one day-ahead forecast, as ENTSO-E showed it when gridflow fetched it. Earlier versions aren’t kept, and the rows don’t say when the forecast was made.',
        'The total generation forecast under the stack is a separate ENTSO-E forecast. The rows don’t say whether it counts the same wind and solar; where the wind and solar forecast comes out larger, the working panel counts those steps rather than hiding them.',
      ],
      query: (params) => ({ group: TYPE, filters: { [AREA]: zoneFrom(params, WS_ZONES).value } }),
      values: [{ column: FORECAST, label: 'Day-ahead forecast' }],
      groups: WS_TYPES.map((t) => ({ value: t.code, label: t.label, color: t.fill })),
      related: [
        {
          key: TOTAL_KEY,
          source: 'entsoe',
          dataset: TOTAL_ID,
          label: 'Total generation forecast',
          query: { group: AREA },
          values: [{ column: FORECAST, label: 'Total generation forecast' }],
          groups: zoneGroups(TOTAL_ZONES),
        },
      ],
      chart: { mark: 'stacked', lower: false, axisWidth: AXIS_WIDTH },
      controls: ZoneControl,
      panels: {
        main: {
          title: (ctx) => (ctx.mode === 'chart' && hasTotal(ctx) ? `Wind and solar forecast in ${wsZone(ctx)}, with its total beneath` : `Wind and solar forecast in ${wsZone(ctx)}`),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[FORECAST]}
              by={TYPE}
              filters={ctx.response?.filters}
              unit="GW"
              also={ctx.mode === 'chart' && hasTotal(ctx) ? relatedPart(ctx, TOTAL_KEY, FORECAST) : []}
              what={ctx.mode === 'chart' && hasTotal(ctx) ? `${wsZone(ctx)}’s series only` : undefined}
            />
          ),
          Body: WindSolarBody,
        },
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[FORECAST]} by={TYPE} filters={ctx.response?.filters} unit="GW" what="each type’s latest forecast held, then the window’s highest and lowest" />,
          Body: WindSolarKey,
        },
        working: {
          title: (ctx) => (hasTotal(ctx) || !ctx.series ? `${wsZone(ctx)}: wind and solar against the total forecast` : `${wsZone(ctx)}: wind and solar by day`),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[FORECAST]}
              by={TYPE}
              filters={ctx.response?.filters}
              unit="GW"
              also={hasTotal(ctx) || !ctx.series ? relatedPart(ctx, TOTAL_KEY, FORECAST) : []}
              what={hasTotal(ctx) || !ctx.series ? `every type summed at the steps all hold, against ${wsZone(ctx)}’s total, and the total less wind and solar; then each UK day` : 'each type’s mean per UK day'}
            />
          ),
          Body: WindSolarPanel,
        },
      },
    },
    {
      id: TOTAL_ID,
      body: 'series',
      label: 'Total generation forecast',
      title: 'Total generation forecast per zone',
      sub: 'ENTSO-E’s forecast, made the day before, of all the electricity four of GB’s continental neighbours would generate, set against their forecast load.',
      caveats: [
        'Each step holds one day-ahead forecast, as ENTSO-E showed it when gridflow fetched it. Earlier versions aren’t kept, and the rows don’t say when the forecast was made.',
        'Every row held is one zone’s total for all its generation; none is split by production type.',
        'The working panel sets each zone’s forecast against ENTSO-E’s day-ahead load forecast for it. The two are separate forecasts, and the rows don’t say whether they count the same plant and the same demand, so the gap between them is not a forecast of exports or imports.',
      ],
      query: { group: AREA },
      values: [{ column: FORECAST, label: 'Generation forecast' }],
      groups: zoneGroups(TOTAL_ZONES),
      related: [
        {
          key: LOAD_KEY,
          source: 'entsoe',
          dataset: LOAD_ID,
          label: 'Load forecast',
          query: { group: AREA },
          values: [{ column: LOAD, label: 'Load forecast' }],
          groups: zoneGroups(TOTAL_ZONES),
        },
      ],
      chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
      panels: {
        main: { title: 'Total generation forecast per zone', src: mainSrc, Body: TotalBody },
        key: {
          title: 'Key',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[FORECAST]}
              by={AREA}
              unit="GW"
              also={relatedPart(ctx, LOAD_KEY, LOAD)}
              what={`each zone’s latest forecast held, then ${totalZone(ctx)}’s highest and lowest, and generation less load`}
            />
          ),
          Body: TotalKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? `${totalZone(ctx)}: generation against load forecast, and the zones` : 'Generation against load forecast, by zone and day'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[FORECAST]}
              by={AREA}
              unit="GW"
              also={relatedPart(ctx, LOAD_KEY, LOAD)}
              what={`generation less load at the steps both hold, for ${totalZone(ctx)} and for each zone over the window, then ${totalZone(ctx)}’s UK days`}
            />
          ),
          Body: BalancePanel,
        },
      },
    },
    {
      id: UNITS_ID,
      body: 'series',
      label: 'Output by unit',
      sub: 'What each generating unit ENTSO-E lists in France, the Netherlands and Belgium produced, one zone and one production type at a time.',
      caveats: [
        'Units are named by their ENTSO-E code: the rows carry no unit names.',
        'Only France, the Netherlands and Belgium hold unit rows. The type is the one ENTSO-E gives each unit, as the rows carry it.',
      ],
      query: (params) => ({ group: UNIT, filters: { [AREA]: zoneFrom(params, UNIT_ZONES).value, [TYPE]: typeFrom(params).code } }),
      values: [{ column: OUTPUT, label: 'Output', display: 'MW' }],
      chart: { mark: 'line', lower: false, maxSeries: UNITS_DRAWN, axisWidth: AXIS_WIDTH },
      controls: UnitControls,
      panels: {
        main: {
          title: (ctx) => `Output of ${unitWhat(ctx)}`,
          src: (ctx) => <SourceLine ctx={ctx} columns={[OUTPUT]} by={UNIT} filters={ctx.response?.filters} unit="MW" what={ctx.mode === 'chart' ? `the ${UNITS_DRAWN} units with the highest mean output` : 'every unit'} />,
          Body: UnitsBody,
        },
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[OUTPUT]} by={UNIT} filters={ctx.response?.filters} unit="MW" what="each drawn unit’s latest output held, then all units summed in GW" />,
          Body: UnitsKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? `All ${unitWhat(ctx)}, summed and one by one` : `All ${unitWhat(ctx)}, one by one`),
          src: (ctx) => <SourceLine ctx={ctx} columns={[OUTPUT]} by={UNIT} filters={ctx.response?.filters} unit={ctx.mode === 'chart' ? 'GW and MW' : 'MW'} what={ctx.mode === 'chart' ? 'the units summed at the steps all hold, then each unit’s steps held, mean, lowest, highest and latest' : 'each unit’s steps held, mean, lowest, highest and latest'} />,
          Body: UnitsPanel,
        },
      },
    },
  ],
})

export default view
