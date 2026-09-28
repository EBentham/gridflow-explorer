/**
 * Open-Meteo's weather at solar sites: hourly irradiance at six places that
 * stand for GB's solar fleet. The historical archive opens the page: each
 * site's irradiance on a south-facing tilted panel, with GB solar generation
 * from NESO's historic generation mix under it on the same clock, a key of
 * each series' peak (`SiteKey`), and each day's irradiation per site beside
 * the day's solar energy (`IrradiationPanel`). The forecast model's re-run
 * for past days is the second dataset, drawn over the archive's same hours
 * and totalled against it (`RerunPanel`). It is labelled as fetched after
 * the fact everywhere: it is never a forecast made in advance.
 */
import { SourceLine } from '../../_template/panels'
import { relatedParts } from '../../_template/panelHelpers'
import { defineView, type PageContext } from '../../define'
import { ARCHIVE_KEY, ARCHIVE_SITES, AXIS_WIDTH, GTI, OUTPUT_KEY, SITES, SOLAR_MW, seriesOf, sitesOf } from './figures'
import { IrradiationPanel } from './IrradiationPanel'
import { RerunPanel } from './RerunPanel'
import { SiteKey } from './SiteKey'

const STAMP =
  'Each irradiance value is the mean of the hour that ends at its time: the value at 13:00 covers 12:00 to 13:00. The chart’s tooltip and the table name the hour that starts at that time, so read each one as the hour before it.'

const keySrc = (ctx: PageContext, lower: string, column: string) => {
  const rel = seriesOf(ctx.related[lower]?.series, column)
  return <SourceLine ctx={ctx} columns={[GTI]} by={ctx.series?.group ?? 'location'} unit="W/m²" also={rel ? relatedParts(ctx, [rel], false) : []} what="each series' highest value" />
}

const view = defineView({
  title: 'Weather at solar sites',
  sub: 'Hourly sunlight on a tilted panel at six places that stand for where GB’s solar panels are, from Open-Meteo’s historical archive and from its forecast model re-run for past days.',
  caveats: [
    STAMP,
    'The six sites are points gridflow chose to stand for where GB’s solar capacity sits, at approximate centres: they are not named solar farms, and the page neither weights nor averages them.',
    'Tilted means a panel tilted 35° and facing due south, a common GB fixed mount.',
  ],
  datasets: [
    {
      id: 'historical_solar',
      body: 'series',
      label: 'Historical archive',
      title: 'Tilted irradiance per hour, with GB solar generation',
      caveats: [
        'The publisher documents its reanalysis as arriving about five days late, yet this archive holds hours up to the newest day shown. What fills those newest days is not confirmed here, and they may change when fetched again.',
        'GB solar generation, under the chart, is NESO’s figure from its historic generation mix, read for the same window and set beside the sites for comparison. Because irradiance is stamped at the end of its hour, its lines sit to the right of the generation they go with.',
        'Flat-ground sunlight, cloud cover, temperature and snow are held too; this page draws the tilted panel only.',
      ],
      query: { group: 'location' },
      values: [{ column: GTI, label: 'Tilted panel' }],
      groups: SITES,
      related: [
        {
          key: OUTPUT_KEY,
          source: 'neso_data_portal',
          dataset: 'historic_generation_mix',
          label: 'GB solar generation',
          values: [{ column: SOLAR_MW, label: 'GB solar generation', color: 'var(--chart-actual)' }],
        },
      ],
      chart: { mark: 'line', values: [GTI], zero: true, extremes: false, maxSeries: 30, axisWidth: AXIS_WIDTH, lower: { from: OUTPUT_KEY, mark: 'line' } },
      panels: {
        key: { title: 'Key', src: (ctx) => keySrc(ctx, OUTPUT_KEY, SOLAR_MW), Body: SiteKey },
        working: {
          title: 'Irradiation per day, beside GB solar generation',
          src: (ctx) => {
            const o = seriesOf(ctx.related[OUTPUT_KEY]?.series, SOLAR_MW)
            return (
              <SourceLine
                ctx={ctx}
                columns={[GTI]}
                by={ctx.series?.group ?? 'location'}
                unit="W/m², summed to kWh/m²"
                also={o ? [{ ...relatedParts(ctx, [o])[0], unit: 'MW, summed to GWh' }] : []}
                what="per UK day"
              />
            )
          },
          Body: IrradiationPanel,
        },
      },
    },
    {
      id: 'forecast_solar',
      body: 'series',
      label: 'Model re-run',
      title: 'Tilted irradiance from the forecast model, fetched after the day',
      sub: 'Open-Meteo’s forecast model’s sunlight at the six sites for hours already past, fetched after they passed: a re-run of the model, not a forecast made in advance.',
      caveats: [
        'This is not a forecast made in advance. gridflow asked Open-Meteo’s forecast service for days already past, each fetch replaced the one before, and no issue time is kept, so the rows show what the forecast model says of those hours now. The working panel names when they were fetched.',
        'Under the chart is the historical archive for the same sites and hours, so the two can be read against each other.',
      ],
      query: { group: 'location' },
      values: [{ column: GTI, label: 'Tilted panel' }],
      groups: SITES,
      related: [
        {
          key: ARCHIVE_KEY,
          source: 'open_meteo',
          dataset: 'historical_solar',
          label: 'Historical archive',
          query: { group: 'location' },
          values: [{ column: GTI, label: 'Tilted panel' }],
          groups: ARCHIVE_SITES,
        },
      ],
      chart: { mark: 'line', values: [GTI], zero: true, extremes: false, maxSeries: 30, axisWidth: AXIS_WIDTH, lower: { from: ARCHIVE_KEY, mark: 'line' } },
      panels: {
        key: { title: 'Key', src: (ctx) => keySrc(ctx, ARCHIVE_KEY, GTI), Body: SiteKey },
        working: {
          title: 'The re-run against the archive',
          src: (ctx) => {
            const a = sitesOf(ctx.related[ARCHIVE_KEY]?.series, GTI)
            return (
              <SourceLine
                ctx={ctx}
                columns={[GTI]}
                by={ctx.series?.group ?? 'location'}
                unit="W/m², summed to kWh/m²"
                also={a.length ? [{ ...relatedParts(ctx, a)[0], unit: 'W/m², summed to kWh/m²' }] : []}
                what="per site and per UK day"
              />
            )
          },
          Body: RerunPanel,
        },
      },
    },
  ],
})

export default view
