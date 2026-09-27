/**
 * Open-Meteo's weather at 12 GB wind sites: hourly wind speed at 100 m,
 * the hub-height stand-in, from two sources. The reanalysis
 * (`historical_wind`) opens the page, with GB wind output read beside it
 * (Elexon's generation by fuel type, wind only): the sites' lines in the main
 * panel with the output under them on the same clock, a key of the sites by
 * region with the mean of the sites, and in the working panel each hour's
 * speed against the output, then the days. The forecast model's hindcast
 * (`forecast_wind`) is drawn the same way and set against the reanalysis.
 * It is a rerun of past hours, never a forecast made in advance, and the
 * page says so.
 */
import { SourceLine } from '../../_template/panels'
import { relatedParts } from '../../_template/panelHelpers'
import type { PageContext } from '../../define'
import { defineView } from '../../define'
import { OUTPUT, OUTPUT_COLOR, OUTPUT_KEY, REANALYSIS_KEY, SITE_GROUPS, SPEED, focusedSite } from './figures'
import { HindcastPanel } from './HindcastPanel'
import { OutputPanel } from './OutputPanel'
import { SitesKey } from './SitesKey'

const outputParts = (ctx: PageContext) => {
  const def = ctx.related[OUTPUT_KEY]?.series?.all.find((d) => d.column === OUTPUT)
  return def ? relatedParts(ctx, [def]) : []
}

const reanalysisParts = (ctx: PageContext) => {
  const def = ctx.related[REANALYSIS_KEY]?.series?.all.find((d) => d.column === SPEED)
  return def ? relatedParts(ctx, [def]) : []
}

const speedOf = (ctx: PageContext) => {
  const site = focusedSite(ctx, ctx.series)
  return site ? `${site.label}’s speed` : 'the mean of the sites'
}

const view = defineView({
  title: 'Weather at wind sites',
  sub: 'Modelled hourly wind speed at 100 m, about hub height, at 12 points spread over GB’s offshore and onshore wind fleet.',
  caveats: [
    'Each site is one grid point near a large wind farm or wind area, chosen by gridflow to follow where GB’s wind capacity sits. The speeds are modelled weather at those points, not readings from the turbines.',
    'The mean of the sites is a plain average: each site counts the same, whatever the capacity near it, and an hour missing any site has no mean.',
  ],
  datasets: [
    {
      id: 'historical_wind',
      body: 'series',
      label: 'Reanalysis',
      title: 'Wind speed at 100 m, reanalysis',
      sub: 'Hourly wind speed at 100 m, about hub height, at 12 points over GB’s wind fleet, as past weather rebuilt by the ERA5 reanalysis, with the wind output GB metered beside it.',
      caveats: [
        'The reanalysis reaches the publisher some days after the weather, so the latest days show as gaps until it arrives, never as zeros.',
        'Only the 100 m speed is drawn. The rows also hold the 10 m speed and gusts, wind direction, temperature, dew point, cloud, rain, pressure and air density, which this page doesn’t show. The reanalysis has no speeds at 80, 120 or 180 m.',
        'GB wind output under the chart is the wind generation Elexon meters on the transmission system. Wind farms on local distribution networks aren’t in it.',
      ],
      values: [{ column: SPEED, label: 'Wind speed at 100 m' }],
      groups: SITE_GROUPS,
      related: [
        {
          key: OUTPUT_KEY,
          source: 'elexon',
          dataset: 'fuelhh',
          label: 'GB wind output',
          query: { filters: { fuel_type: 'WIND' } },
          values: [{ column: OUTPUT, label: 'GB wind output', color: OUTPUT_COLOR }],
        },
      ],
      chart: { mark: 'line', maxSeries: 12, lower: { from: OUTPUT_KEY, mark: 'line', height: 150 } },
      panels: {
        key: {
          title: 'Key',
          src: (ctx) => (
            <SourceLine ctx={ctx} columns={[SPEED]} by="location" unit="m/s" also={outputParts(ctx)} what="the latest hour held, the mean of the sites, and each site" />
          ),
          Body: SitesKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Wind speed against GB wind output, and the days' : 'The days'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[SPEED]}
              by="location"
              unit="m/s"
              also={outputParts(ctx)}
              what={ctx.mode === 'chart' ? `${speedOf(ctx)} against wind output per hour, then per UK day` : `${speedOf(ctx)} and wind output per UK day`}
            />
          ),
          Body: OutputPanel,
        },
      },
    },
    {
      id: 'forecast_wind',
      body: 'series',
      label: 'Forecast model, rerun',
      title: 'Wind speed at 100 m, forecast model’s rerun of past hours',
      sub: 'Hourly wind speed at 100 m at the same 12 points, as the forecast model reran it for past dates: a hindcast, set against the reanalysis.',
      caveats: [
        'Not a forecast made in advance. gridflow asked the forecast model for past dates, and it returned its own rerun of those hours, a hindcast. Each fetch overwrites the last and no issue time is kept, so these rows can’t show what was forecast ahead of time.',
        'Only the 100 m speed is drawn, to match the reanalysis. The rows also hold speeds at 10, 80, 120 and 180 m and gusts at 10 m.',
      ],
      values: [{ column: SPEED, label: 'Wind speed at 100 m' }],
      groups: SITE_GROUPS,
      related: [
        {
          key: REANALYSIS_KEY,
          source: 'open_meteo',
          dataset: 'historical_wind',
          label: 'Reanalysis',
          values: [{ column: SPEED, label: 'Wind speed at 100 m' }],
          groups: SITE_GROUPS,
        },
      ],
      chart: { mark: 'line', maxSeries: 12, lower: false },
      panels: {
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[SPEED]} by="location" unit="m/s" what="the latest hour held, the mean of the sites, and each site" />,
          Body: SitesKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Rerun against the reanalysis, and the days' : 'Rerun against the reanalysis, by day'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[SPEED]}
              by="location"
              unit="m/s"
              also={reanalysisParts(ctx)}
              what={ctx.mode === 'chart' ? `${speedOf(ctx)} per hour from both, then per UK day` : `${speedOf(ctx)} from both per UK day`}
            />
          ),
          Body: HindcastPanel,
        },
      },
    },
  ],
})

export default view
