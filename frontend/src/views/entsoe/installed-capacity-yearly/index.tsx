/**
 * ENTSO-E's installed capacity for the year (v0.4 P4-0 reference batch):
 * capacity by production type per area, capacity per generating unit, and
 * the forecast margin, each a table. Every row is one yearly figure, so each
 * table ends on a Year column read from the row's date, rather than the page
 * naming a year that the next fetch could change. The unit list opens on GB's
 * units, whose area code the rows carry.
 */
import type { Scalar } from '../../contract'
import { productionType } from '../../_template/codes'
import type { ColumnSpec } from '../../define'
import { defineView } from '../../define'
import { GbControl } from './GbControl'

/** GB's area code (EIC) in ENTSO-E's rows. */
const GB = '10YGB----------A'

const YEARLY = 'Each row is ENTSO-E’s figure for one year, which it publishes once a year and dates midnight on 1 January Central European time (23:00 on 31 December on the UK clock). The Year column reads that date.'

const cetYear = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Brussels', year: 'numeric' })

/** The year a row is for: its `timestamp_utc` on the Central European clock ENTSO-E dates it by. */
function yearOf(v: Scalar): string | null {
  const ms = typeof v === 'string' ? Date.parse(v) : NaN
  return Number.isFinite(ms) ? cetYear.format(ms) : null
}

const YEAR: ColumnSpec = { field: 'timestamp_utc', label: 'Year', text: yearOf }

/** The four areas the per-area tables hold, as the research counted them. */
const NO_GB = 'This table covers France, Belgium, the Netherlands and Germany-Luxembourg, by ENTSO-E’s area codes: GB isn’t among them.'

const view = defineView({
  title: 'Installed capacity, yearly',
  sub: 'How much generating capacity each area reports for the year, by production type and by unit, with its forecast margin.',
  caveats: [YEARLY],
  datasets: [
    {
      id: 'installed_capacity',
      body: 'reference',
      label: 'By type',
      title: 'Installed capacity by production type',
      sub: 'Generating capacity each area reports for the year, by production type.',
      caveats: [`${NO_GB} The unit list has GB’s units.`],
      columns: [
        { field: 'area_code', label: 'Area', format: 'id' },
        { field: 'production_type', label: 'Production type', text: productionType },
        { field: 'capacity_mw', label: 'Installed capacity', format: 'number', unit: 'MW', display: 'MW' },
        YEAR,
      ],
      sort: { field: 'capacity_mw', dir: 'desc' },
      search: ['area_code', 'production_type'],
      countBy: 'area_code',
    },
    {
      id: 'installed_capacity_units',
      body: 'reference',
      label: 'By unit',
      title: 'Installed capacity by unit',
      sub: 'Each generating unit’s capacity for the year, GB’s by default.',
      caveats: [
        'Units and areas show as ENTSO-E’s codes; GB’s area is 10YGB----------A.',
        'GB’s rows look out of date: they still list hard-coal units, and GB’s last coal plant closed in 2024. Read them as the last list GB sent ENTSO-E, not as its fleet for the year shown.',
      ],
      query: (params) => (params.get('area') === 'all' ? {} : { filters: { area_code: GB } }),
      controls: GbControl,
      columns: [
        { field: 'unit_mrid', label: 'Unit', format: 'id' },
        { field: 'production_type', label: 'Production type', text: productionType },
        { field: 'capacity_mw', label: 'Installed capacity', format: 'number', unit: 'MW', display: 'MW' },
        { field: 'area_code', label: 'Area', format: 'id' },
        YEAR,
      ],
      sort: { field: 'capacity_mw', dir: 'desc' },
      search: ['unit_mrid', 'production_type', 'area_code'],
      countBy: 'production_type',
    },
    {
      id: 'forecast_margin',
      body: 'reference',
      label: 'Forecast margin',
      title: 'Forecast margin',
      sub: 'The margin each area forecasts for the year between its available capacity and its load.',
      caveats: [NO_GB],
      columns: [
        { field: 'area_code', label: 'Area', format: 'id' },
        { field: 'forecast_margin_mw', label: 'Forecast margin', format: 'number', unit: 'MW', display: 'MW' },
        YEAR,
      ],
      sort: { field: 'forecast_margin_mw', dir: 'desc' },
    },
  ],
})

export default view
