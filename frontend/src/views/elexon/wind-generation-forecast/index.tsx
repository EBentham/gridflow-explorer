/**
 * Elexon's wind generation forecast (`windfor`): GB wind generation forecast
 * hour by hour, one figure per hour from the latest issue held for it. The
 * main panel draws the line; the key reads which issues the hours drawn come
 * from and how many were forecast ahead of the hour; the working panel sets
 * the forecast against the wind output GB metered (Elexon's generation by
 * fuel type, wind only, read beside it), with the difference and each hour's
 * issue lead on the same clock, then the days. The metered figure is
 * transmission-connected wind only, and the page says so.
 */
import { SourceLine } from '../../_template/panels'
import { relatedFilters, type SourcePart } from '../../_template/panelHelpers'
import type { PageContext } from '../../define'
import { defineView } from '../../define'
import { AXIS_WIDTH, COLORS, FORECAST, FUEL_TYPE, ISSUED, METERED, METERED_KEY, WIND } from './figures'
import { ForecastKey } from './ForecastKey'
import { MeteredPanel } from './MeteredPanel'

/** The metered wind output in a source line, named in full with the filter its rows carry. */
function meteredPart(ctx: PageContext, withColumn: boolean): SourcePart[] {
  const rel = ctx.related[METERED_KEY]
  if (!rel) return []
  return [{ source: rel.source, dataset: rel.spec.dataset, columns: withColumn ? [METERED] : undefined, filters: withColumn ? relatedFilters(rel) : null, unit: 'GW' }]
}

const view = defineView({
  title: 'Wind generation forecast',
  sub: 'Elexon’s forecast of GB wind generation, one figure an hour from the latest issue held, set beside the wind output GB metered.',
  datasets: [
    {
      id: 'windfor',
      body: 'series',
      label: 'Wind forecast',
      title: 'Wind generation forecast per hour, latest issue held',
      caveats: [
        'Each hour shows the latest issue of the forecast held for it. Elexon reissues the forecast, gridflow keeps every issue it has fetched, and each issue also gives figures for about a day before it was made. So for most past hours the figure drawn comes from an issue made after the hour, up to about a day later: not a forecast made ahead. What the publisher’s figure for an hour already past stands for isn’t confirmed here. The key counts the hours drawn from issues made before and after them, and the working panel charts it hour by hour.',
        'Only one figure per hour is held: gridflow’s description of this dataset lists a first-issued forecast and settlement periods as well, but the rows hold neither.',
        'Each figure is stamped with the start time Elexon sends for it, on the hour. Whether it stands for the hour that follows or the instant on the hour isn’t confirmed; the working panel sets it against the mean of the two metered half-hours from that time.',
        'The metered wind output beside it is the wind generation Elexon meters on the transmission system: wind farms on local distribution networks aren’t in it. Which wind farms the forecast covers isn’t stated in the rows held, so a steady gap between the two can be a difference in what each counts, not a miss.',
      ],
      values: [{ column: FORECAST, label: 'Wind generation forecast', color: COLORS.forecast }],
      related: [
        {
          key: METERED_KEY,
          source: 'elexon',
          dataset: 'fuelhh',
          label: 'Metered wind output',
          query: { filters: { [FUEL_TYPE]: WIND } },
          values: [{ column: METERED, label: 'Metered wind output', color: COLORS.metered }],
        },
      ],
      chart: { mark: 'line', extremes: true, lower: false, axisWidth: AXIS_WIDTH, height: 480 },
      panels: {
        key: {
          title: 'Key',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[FORECAST]}
              filters={ctx.response?.filters}
              unit="GW"
              also={meteredPart(ctx, false)}
              what={
                <>
                  the latest hour, highest and lowest, which issue each hour comes from (<code>{ISSUED}</code>), and metered less forecast in MW
                </>
              }
            />
          ),
          Body: ForecastKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Forecast against metered output, and the days' : 'The days, against metered output'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[FORECAST]}
              filters={ctx.response?.filters}
              unit="GW"
              also={meteredPart(ctx, true)}
              what={
                ctx.mode === 'chart'
                  ? <>the forecast and the metered mean per hour, metered less forecast in MW, and hours issued before the hour (from <code>{ISSUED}</code>); then each UK day</>
                  : <>each UK day: the issues drawn (<code>{ISSUED}</code>), the forecast and metered means, and metered less forecast in MW</>
              }
            />
          ),
          Body: MeteredPanel,
        },
      },
    },
  ],
})

export default view
