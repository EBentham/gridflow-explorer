/**
 * Open-Meteo's weather at demand centres: hourly weather at seven UK cities
 * chosen to explain electricity demand. The reanalysis (`historical_demand`)
 * opens the page: temperature per city in the main panel, a key of each
 * city's latest reading and the window's extremes and degrees
 * (`WeatherKey`), and GB national demand (Elexon's `indo`) on the same clock
 * with a table of the days in the working panel (`DemandPanel`). The
 * hindcast (`forecast_demand`) draws the same way, with the reanalysis
 * beneath it and a per-city comparison (`ArchivePanel`). It is fetched after
 * the fact, so the page never calls it a forecast made in advance.
 */
import { SourceLine } from '../../_template/panels'
import { relatedParts } from '../../_template/panelHelpers'
import { defineView, type ValueSpec } from '../../define'
import { ArchivePanel } from './ArchivePanel'
import { DemandPanel } from './DemandPanel'
import {
  AIR_DENSITY,
  ARCHIVE_KEY,
  AXIS_WIDTH,
  CDD,
  CITIES,
  DEMAND,
  DEMAND_COLOR,
  DEMAND_KEY,
  HDD,
  HUMIDITY,
  PRESSURE,
  RAIN,
  SNOW_DEPTH,
  SNOWFALL,
  SUN,
  TEMP,
  WIND,
  citySeries,
  seriesOf,
} from './figures'
import { WeatherKey } from './WeatherKey'

const BY_CITY = { group: 'location' }

const REANALYSIS_VALUES: ValueSpec[] = [
  { column: TEMP, label: 'Temperature' },
  { column: HDD, label: 'Heating degrees' },
  { column: CDD, label: 'Cooling degrees' },
  { column: WIND, label: 'Wind at 10 m' },
  { column: SUN, label: 'Solar radiation' },
  { column: HUMIDITY, label: 'Relative humidity', unit: '%' },
  { column: RAIN, label: 'Precipitation', unit: 'mm' },
  { column: PRESSURE, label: 'Surface pressure', unit: 'hPa' },
  { column: SNOWFALL, label: 'Snowfall' },
  { column: SNOW_DEPTH, label: 'Snow depth', unit: 'm' },
  { column: AIR_DENSITY, label: 'Air density', unit: 'kg/m3' },
]

const HINDCAST_VALUES: ValueSpec[] = [
  { column: TEMP, label: 'Temperature' },
  { column: HDD, label: 'Heating degrees' },
  { column: CDD, label: 'Cooling degrees' },
  { column: WIND, label: 'Wind at 10 m' },
]

// Every column is a series per city. The main panel draws temperature only, so the cap must
// hold them all, or the largest means (pressure) would crowd it out.
const capFor = (values: ValueSpec[]) => values.length * CITIES.length

const view = defineView({
  title: 'Weather at demand centres',
  sub: 'Hourly weather at seven UK cities chosen to explain electricity demand: temperature, heating and cooling degrees, wind and sunshine, set beside GB national demand.',
  caveats: [
    'The seven cities are fixed points, not a map of where GB uses its power, and every mean on this page weights them alike. Belfast is in Northern Ireland, whose power system is the all-island Irish one, not GB’s.',
    'Heating and cooling degrees are worked out by gridflow from each hour’s temperature: how far it sits below 15.5 °C, and how far above 22 °C.',
  ],
  datasets: [
    {
      id: 'historical_demand',
      body: 'series',
      label: 'Reanalysis',
      title: 'Temperature per hour, reanalysis',
      sub: 'Hourly weather at seven UK cities from the weather reanalysis archive, set beside GB national demand on the same clock.',
      caveats: [
        'The reanalysis archive runs about five days behind the present, so its latest days can be empty or thin here. That lag is how gridflow’s notes describe it, not a promise from the publisher; missing hours show as gaps.',
      ],
      query: BY_CITY,
      groups: CITIES,
      values: REANALYSIS_VALUES,
      related: [
        {
          key: DEMAND_KEY,
          source: 'elexon',
          dataset: 'indo',
          label: 'National demand',
          values: [{ column: DEMAND, label: 'National demand', color: DEMAND_COLOR }],
        },
      ],
      chart: { mark: 'line', values: [TEMP], lower: false, maxSeries: capFor(REANALYSIS_VALUES), axisWidth: AXIS_WIDTH },
      panels: {
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[TEMP, HDD, CDD]} by="location" unit="°C and K" what="each city’s latest reading, and the window across the seven" />,
          Body: WeatherKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'National demand, and the days' : 'The days'),
          src: (ctx) => {
            const d = seriesOf(ctx.related[DEMAND_KEY]?.series, DEMAND)
            return (
              <SourceLine
                ctx={ctx}
                columns={[TEMP, HDD, CDD]}
                by="location"
                unit="°C and K"
                also={d ? relatedParts(ctx, [d]) : []}
                what={ctx.mode === 'chart' ? 'national demand per half-hour, then the weather and demand per UK day' : 'the weather and demand per UK day'}
              />
            )
          },
          Body: DemandPanel,
        },
      },
    },
    {
      id: 'forecast_demand',
      body: 'series',
      label: 'Model hindcast',
      title: 'Temperature per hour, model hindcast',
      sub: 'The weather model’s own hours at the same seven cities, fetched after they had passed, set beside the reanalysis.',
      caveats: [
        'This is not a forecast made in advance. gridflow asks the weather model for hours that have already passed, and gets back the model’s stitched-together output for them. No issue time is kept, and each fetch overwrites the one before, so the page cannot show what was forecast at any earlier moment.',
      ],
      query: BY_CITY,
      groups: CITIES,
      values: HINDCAST_VALUES,
      related: [
        {
          key: ARCHIVE_KEY,
          source: 'open_meteo',
          dataset: 'historical_demand',
          label: 'Reanalysis',
          query: BY_CITY,
          groups: CITIES,
          values: [{ column: TEMP, label: 'Temperature' }],
        },
      ],
      chart: { mark: 'line', values: [TEMP], lower: false, maxSeries: capFor(HINDCAST_VALUES), axisWidth: AXIS_WIDTH },
      panels: {
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[TEMP, HDD, CDD]} by="location" unit="°C and K" what="each city’s latest reading, and the window across the seven" />,
          Body: WeatherKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Beside the reanalysis' : 'Hindcast against reanalysis, by city'),
          src: (ctx) => {
            const a = citySeries(ctx.related[ARCHIVE_KEY]?.series, TEMP)
            return (
              <SourceLine
                ctx={ctx}
                columns={[TEMP]}
                by="location"
                unit="°C"
                also={a.length ? relatedParts(ctx, a) : []}
                what={ctx.mode === 'chart' ? 'reanalysis temperature per hour, then each city compared' : 'each city compared'}
              />
            )
          },
          Body: ArchivePanel,
        },
      },
    },
  ],
})

export default view
