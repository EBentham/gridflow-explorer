/**
 * NESO's embedded wind and solar forecast (v0.4 P4): the wind and solar
 * output NESO forecasts on the distribution networks, per half-hour, which
 * lowers the demand the transmission system sees. The main panel stacks the
 * two forecasts (embedded wind hatched as on the historic generation mix
 * page), so the top of the band is the embedded total, and names the issue
 * the window comes from and how far ahead it was made (`ForecastBody`). The
 * key gives each forecast's peak, the issue, solar's peak against the
 * capacity NESO assumed, and the capacities (`ForecastKey`). The working
 * panel sets each forecast against NESO's own figure for the same half-hours
 * from its historic generation mix, then sums the days (`RecordedPanel`).
 * The rows are the latest issue held for each half-hour.
 */
import { SourceLine } from '../../_template/panels'
import type { SourcePart } from '../../_template/panelHelpers'
import { relatedFilters } from '../../_template/panelHelpers'
import { dayLabel } from '../../../design/time'
import { defineView, type PageContext } from '../../define'
import { ForecastBody } from './ForecastBody'
import { ForecastKey } from './ForecastKey'
import { MIX_KEY, MIX_SOLAR, MIX_WIND, RECORDED_COLOR, SOLAR_CAP, SOLAR_COLOR, SOLAR_FC, WIND_CAP, WIND_FC, WIND_HATCH_ID, AXIS_WIDTH, issuesOf } from './figures'
import { RecordedPanel } from './RecordedPanel'

/** The historic generation mix in a source line, with the two columns set beside the forecast. */
function mixPart(ctx: PageContext, unit: string): SourcePart[] {
  const rel = ctx.related[MIX_KEY]
  if (!rel) return []
  return [{ source: rel.source, dataset: rel.spec.dataset, columns: [MIX_WIND, MIX_SOLAR], filters: relatedFilters(rel), unit }]
}

const view = defineView({
  title: 'Embedded wind and solar forecast',
  sub: 'NESO’s forecast of the wind and solar generation on the distribution networks, half-hour by half-hour, with the capacity it assumes and NESO’s generation-mix figure for the same half-hours beside it.',
  caveats: [
    'Embedded means connected to the distribution networks rather than the transmission system. Embedded wind and solar meet demand before it reaches the transmission system, so the more they generate, the lower the demand the transmission system sees.',
    'gridflow reads only the forecast NESO currently publishes, and each new issue replaces the last, so only the issues gridflow fetched at the time are held. Days no fetched issue covers are not held and can’t be fetched now; 14 to 20 Sep is one such week. Each half-hour shows the latest issue held for it: the line under the chart or table and the key name that issue and how far ahead it was made.',
    'The forecasts and capacities are in MW, shown as GW. The capacities are the embedded wind and solar capacity NESO’s forecast assumes; the key gives them rather than the chart, as they sit far above the forecasts.',
    'Each half-hour is placed by its settlement date and period. NESO also sends a time column whose convention, the start or the end of the half-hour, isn’t documented; the page doesn’t use it.',
  ],
  datasets: [
    {
      id: 'embedded_wind_solar_forecast',
      body: 'series',
      label: 'Embedded forecast',
      title: 'Embedded wind and solar forecast per half-hour',
      values: [
        // The template paints each series in SVG, so embedded wind passes its hatch, not its bare colour.
        { column: WIND_FC, label: 'Embedded wind forecast', color: `url(#${WIND_HATCH_ID})` },
        { column: SOLAR_FC, label: 'Embedded solar forecast', color: SOLAR_COLOR },
        { column: WIND_CAP, label: 'Embedded wind capacity assumed' },
        { column: SOLAR_CAP, label: 'Embedded solar capacity assumed' },
      ],
      related: [
        {
          key: MIX_KEY,
          source: 'neso_data_portal',
          dataset: 'historic_generation_mix',
          label: 'Historic generation mix',
          values: [
            { column: MIX_WIND, label: 'Embedded wind, generation mix', color: RECORDED_COLOR },
            { column: MIX_SOLAR, label: 'Solar, generation mix', color: RECORDED_COLOR },
          ],
        },
      ],
      chart: { mark: 'stacked', values: [WIND_FC, SOLAR_FC], lower: false, axisWidth: AXIS_WIDTH },
      panels: {
        main: {
          title: (ctx) => {
            const issues = ctx.state === 'data' ? issuesOf(ctx.response) : null
            return issues?.times.length === 1 ? `Embedded wind and solar forecast, issued ${dayLabel(issues.times[0])}` : 'Embedded wind and solar forecast per half-hour'
          },
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[WIND_FC, SOLAR_FC]}
              filters={ctx.response?.filters}
              unit="GW"
              what={ctx.mode === 'chart' ? 'each half-hour, wind and solar stacked' : 'each half-hour, with the capacities'}
            />
          ),
          Body: ForecastBody,
        },
        key: {
          title: 'Key',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[WIND_FC, SOLAR_FC, WIND_CAP, SOLAR_CAP]}
              filters={ctx.response?.filters}
              unit="GW"
              what="each forecast’s peak, the issue behind the window, and the capacity assumed"
            />
          ),
          Body: ForecastKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Forecast against the generation mix, and the days' : 'The days, against the generation mix'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[WIND_FC, SOLAR_FC]}
              filters={ctx.response?.filters}
              unit="GW and GWh"
              also={mixPart(ctx, 'GW and GWh')}
              what={ctx.mode === 'chart' ? 'each forecast and the mix per half-hour, then per UK day' : 'forecast and mix per UK day'}
            />
          ),
          Body: RecordedPanel,
        },
      },
    },
  ],
})

export default view
