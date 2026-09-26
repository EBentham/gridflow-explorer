/**
 * FIXTURE: the source catalogue, mirrored by hand from gridflow's
 * config/sources.yaml on 26 Sep 2026 (dataset ids and fetch schedules as
 * configured there). Family labels and blurbs are written for the Explorer.
 * Kinds follow each dataset's silver table shape, checked 26 Sep 2026: time
 * series are keyed on a regular clock, event feeds on a per-action or
 * per-message id, reference tables have no clock.
 * "Configured" is not "has local rows": only the charted datasets carry
 * coverage. v0.4 P4-0 replaces this file with the /api/sources endpoint and
 * deletes it.
 */

import type { Domain } from '../design/symbols'

export type { Domain }
export type Kind = 'series' | 'events' | 'reference'
export type Schedule = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface Dataset {
  id: string
  schedule: Schedule
}

export interface Family {
  label: string
  kind: Kind
  datasets: Dataset[]
  /** Set when an Explorer screen reads this family. */
  view?: { to: string; label: string }
}

export interface Source {
  key: string
  name: string
  domain: Domain
  host: string
  blurb: string
  families: Family[]
}

export const CATALOGUE_SNAPSHOT = '26 Sep 2026'

const ds = (schedule: Schedule, ...ids: string[]): Dataset[] => ids.map((id) => ({ id, schedule }))

export const SOURCES: Source[] = [
  {
    key: 'elexon',
    name: 'Elexon BMRS',
    domain: 'Electricity',
    host: 'data.elexon.co.uk/bmrs/api/v1',
    blurb: 'GB balancing mechanism reporting: settlement prices, generation, demand and the balancing actions behind them.',
    families: [
      { label: 'Generation by fuel type, half-hourly', kind: 'series', datasets: ds('hourly', 'fuelhh'), view: { to: '/datasets/generation-mix', label: 'Generation mix' } },
      { label: 'System prices and net imbalance volume', kind: 'series', datasets: ds('hourly', 'system_prices'), view: { to: '/datasets/system-prices', label: 'System prices' } },
      { label: 'Generation by fuel type, instantaneous', kind: 'series', datasets: ds('hourly', 'fuelinst') },
      { label: 'Actual generation by production type', kind: 'series', datasets: ds('daily', 'agpt', 'agws') },
      { label: 'Market index price', kind: 'series', datasets: ds('hourly', 'mid') },
      { label: 'Market depth', kind: 'series', datasets: ds('daily', 'market_depth') },
      { label: 'System frequency', kind: 'series', datasets: ds('hourly', 'freq') },
      { label: 'Demand outturn', kind: 'series', datasets: [...ds('hourly', 'indo', 'itsdo'), ...ds('daily', 'indod', 'atl')] },
      { label: 'Demand forecasts', kind: 'series', datasets: ds('daily', 'ndf', 'tsdf', 'ndfd', 'tsdfd') },
      { label: 'Indicated demand and generation', kind: 'series', datasets: ds('daily', 'inddem', 'indgen') },
      { label: 'Indicated imbalance and export limits', kind: 'series', datasets: ds('hourly', 'imbalngc', 'melngc') },
      { label: 'Loss of load probability and de-rated margin', kind: 'series', datasets: ds('daily', 'lolpdrm') },
      { label: 'Wind generation forecast', kind: 'series', datasets: ds('hourly', 'windfor') },
      { label: 'Availability, 2 to 14 days ahead', kind: 'series', datasets: ds('daily', 'fou2t14d', 'uou2t14d') },
      { label: 'Temperature', kind: 'series', datasets: ds('daily', 'temp') },
      { label: 'Non-BM STOR', kind: 'series', datasets: ds('daily', 'nonbm') },
      { label: 'Net balancing services adjustment', kind: 'series', datasets: ds('daily', 'netbsad') },
      { label: 'Physical notifications per BM unit', kind: 'series', datasets: ds('hourly', 'pn') },
      { label: 'Bid-offer acceptances', kind: 'events', datasets: ds('hourly', 'boal') },
      { label: 'Disaggregated balancing services adjustments', kind: 'events', datasets: ds('daily', 'disbsad') },
      { label: 'REMIT outage messages', kind: 'events', datasets: ds('daily', 'remit') },
      { label: 'System operator to system operator trades', kind: 'events', datasets: ds('daily', 'soso') },
      { label: 'BM unit register', kind: 'reference', datasets: ds('weekly', 'bmunits_reference') },
    ],
  },
  {
    key: 'neso',
    name: 'NESO Carbon Intensity',
    domain: 'Electricity',
    host: 'api.carbonintensity.org.uk',
    blurb: 'Carbon intensity of GB electricity, national and regional, forecast and actual, with the fuel mix in per cent.',
    families: [
      {
        label: 'National carbon intensity',
        kind: 'series',
        datasets: [
          ...ds('hourly', 'carbon_intensity', 'intensity_current', 'intensity_period', 'intensity_at', 'intensity_fw24h', 'intensity_fw48h', 'intensity_pt24h'),
          ...ds('daily', 'intensity_today', 'intensity_date'),
        ],
      },
      { label: 'Intensity statistics', kind: 'series', datasets: ds('daily', 'intensity_stats', 'intensity_stats_block') },
      { label: 'Generation mix, per cent', kind: 'series', datasets: ds('hourly', 'generation', 'generation_current', 'generation_pt24h') },
      {
        label: 'Regional intensity',
        kind: 'series',
        datasets: ds('hourly', 'regional_current', 'regional_england', 'regional_scotland', 'regional_wales', 'regional_postcode', 'regional_regionid'),
      },
      {
        label: 'Regional intensity windows',
        kind: 'series',
        datasets: ds(
          'hourly',
          'regional_intensity',
          'regional_intensity_postcode',
          'regional_intensity_regionid',
          'regional_intensity_fw24h',
          'regional_intensity_fw24h_postcode',
          'regional_intensity_fw24h_regionid',
          'regional_intensity_fw48h',
          'regional_intensity_fw48h_postcode',
          'regional_intensity_fw48h_regionid',
          'regional_intensity_pt24h',
          'regional_intensity_pt24h_postcode',
          'regional_intensity_pt24h_regionid',
        ),
      },
      { label: 'Emission factors by fuel', kind: 'reference', datasets: ds('weekly', 'intensity_factors') },
    ],
  },
  {
    key: 'neso_data_portal',
    name: 'NESO Data Portal',
    domain: 'Electricity',
    host: 'api.neso.energy',
    blurb: 'Files from the GB system operator: the historic generation mix, embedded wind and solar forecasts, and wind availability.',
    families: [
      { label: 'Historic generation mix', kind: 'series', datasets: ds('daily', 'historic_generation_mix') },
      { label: 'Embedded wind and solar forecast', kind: 'series', datasets: ds('daily', 'embedded_wind_solar_forecast') },
      { label: 'Wind availability per BM unit', kind: 'series', datasets: ds('daily', 'daily_wind_availability') },
    ],
  },
  {
    key: 'entsoe',
    name: 'ENTSO-E Transparency',
    domain: 'Electricity',
    host: 'web-api.tp.entsoe.eu',
    blurb: 'The European electricity transparency platform: load, generation, cross-border capacity and balancing, by bidding zone.',
    families: [
      {
        label: 'Load, actual and forecast',
        kind: 'series',
        datasets: [...ds('daily', 'actual_load', 'load_forecast'), ...ds('weekly', 'load_forecast_weekly'), ...ds('monthly', 'load_forecast_monthly'), ...ds('yearly', 'load_forecast_yearly', 'forecast_margin')],
      },
      { label: 'Generation, actual and forecast', kind: 'series', datasets: ds('daily', 'actual_generation', 'generation_forecast', 'wind_solar_forecast', 'actual_generation_units') },
      { label: 'Day-ahead prices', kind: 'series', datasets: ds('daily', 'day_ahead_prices') },
      { label: 'Hydro reservoirs', kind: 'series', datasets: ds('daily', 'water_reservoirs') },
      { label: 'Cross-border flows and schedules', kind: 'series', datasets: ds('daily', 'cross_border_flows', 'commercial_schedules', 'net_positions') },
      {
        label: 'Transfer capacity',
        kind: 'series',
        datasets: ds(
          'daily',
          'net_transfer_capacity',
          'dc_link_intraday_transfer_limits',
          'offered_transfer_capacity_continuous',
          'offered_transfer_capacity_implicit',
          'offered_transfer_capacity_explicit',
          'transfer_capacity_use',
          'total_nominated_capacity',
          'total_capacity_allocated',
        ),
      },
      { label: 'Auction revenue and congestion income', kind: 'series', datasets: ds('daily', 'auction_revenue', 'congestion_income') },
      { label: 'Imbalance prices and volumes', kind: 'series', datasets: ds('daily', 'imbalance_prices', 'imbalance_volume', 'current_balancing_state') },
      {
        label: 'Balancing energy and reserves',
        kind: 'series',
        datasets: [
          ...ds('daily', 'activated_balancing_prices', 'aggregated_balancing_energy_bids', 'contracted_reserves', 'procured_balancing_capacity', 'cross_zonal_balancing_capacity'),
          ...ds('monthly', 'balancing_financial_expenses_income'),
        ],
      },
      { label: 'Outages, unavailable capacity per interval', kind: 'series', datasets: ds('daily', 'outages_generation', 'outages_production', 'outages_consumption', 'outages_transmission', 'outages_offshore_grid') },
      { label: 'Redispatch and countertrading', kind: 'series', datasets: ds('daily', 'redispatching_cross_border', 'redispatching_internal', 'countertrading', 'congestion_management_costs') },
      { label: 'Balancing energy bids', kind: 'series', datasets: ds('daily', 'balancing_energy_bids') },
      { label: 'Installed capacity, yearly', kind: 'series', datasets: [...ds('weekly', 'installed_capacity'), ...ds('yearly', 'installed_capacity_units')] },
      { label: 'Generation unit register', kind: 'reference', datasets: ds('weekly', 'generation_units_master_data') },
    ],
  },
  {
    key: 'entsog',
    name: 'ENTSO-G Transparency',
    domain: 'Gas',
    host: 'transparency.entsog.eu/api/v1',
    blurb: 'The European gas transparency platform: flows, nominations, capacity and gas quality at network points.',
    families: [
      { label: 'Physical flows', kind: 'series', datasets: ds('daily', 'physical_flows', 'aggregated_physical_flows') },
      { label: 'Nominations and allocations', kind: 'series', datasets: ds('daily', 'nominations', 'renominations', 'allocations') },
      {
        label: 'Firm and interruptible capacity',
        kind: 'series',
        datasets: ds('daily', 'firm_available', 'firm_booked', 'firm_technical', 'interruptible_available', 'interruptible_booked', 'interruptible_total'),
      },
      {
        label: 'Released capacity',
        kind: 'series',
        datasets: ds('daily', 'available_through_oversubscription', 'available_through_surrender', 'available_through_uioli_long_term', 'available_through_uioli_short_term'),
      },
      { label: 'Gas quality', kind: 'series', datasets: ds('daily', 'gcv', 'wobbe_index', 'methane_content', 'hydrogen_content', 'oxygen_content') },
      { label: 'Congestion management', kind: 'events', datasets: ds('daily', 'cmp_unsuccessful_requests', 'cmp_auction_premiums') },
      { label: 'Unavailable firm capacity', kind: 'reference', datasets: ds('daily', 'cmp_unavailable_firm_capacity') },
      { label: 'Interruptions and urgent market messages', kind: 'events', datasets: ds('daily', 'interruptions', 'urgent_market_messages') },
      { label: 'Tariffs', kind: 'reference', datasets: ds('monthly', 'tariffs', 'tariff_simulations') },
      {
        label: 'Network topology',
        kind: 'reference',
        datasets: ds('weekly', 'connection_points', 'operators', 'balancing_zones', 'operator_point_directions', 'interconnections', 'aggregate_interconnections'),
      },
    ],
  },
  {
    key: 'gie_agsi',
    name: 'GIE AGSI+',
    domain: 'Gas',
    host: 'agsi.gie.eu',
    blurb: 'Gas storage across Europe: stock, injection, withdrawal and fullness, by country, company and site.',
    families: [
      { label: 'Storage by country and site', kind: 'series', datasets: ds('daily', 'storage', 'storage_reports') },
      { label: 'Storage unavailability', kind: 'events', datasets: ds('daily', 'unavailability') },
      { label: 'Transparency news', kind: 'events', datasets: ds('daily', 'news', 'news_item') },
      { label: 'Facility and company listings', kind: 'reference', datasets: ds('weekly', 'about_summary', 'about_listing') },
    ],
  },
  {
    key: 'gie_alsi',
    name: 'GIE ALSI',
    domain: 'Gas',
    host: 'alsi.gie.eu',
    blurb: 'LNG terminals across Europe: inventory and send-out.',
    families: [{ label: 'LNG inventory and send-out', kind: 'series', datasets: ds('daily', 'lng') }],
  },
  {
    key: 'open_meteo',
    name: 'Open-Meteo',
    domain: 'Weather',
    host: 'api.open-meteo.com/v1',
    blurb: 'Hourly weather at fixed GB sites chosen to explain demand, wind and solar output.',
    families: [
      { label: 'Weather at demand centres', kind: 'series', datasets: [...ds('daily', 'historical_demand'), ...ds('hourly', 'forecast_demand')] },
      { label: 'Weather at wind sites', kind: 'series', datasets: [...ds('daily', 'historical_wind'), ...ds('hourly', 'forecast_wind')] },
      { label: 'Weather at solar sites', kind: 'series', datasets: [...ds('daily', 'historical_solar'), ...ds('hourly', 'forecast_solar')] },
    ],
  },
]

export interface GoldGroup {
  /** Plain words, written to sit in a sentence. */
  label: string
  relations: string[]
  /** Set when an Explorer screen reads this group. */
  view?: { to: string; label: string }
}

/**
 * gridflow's own tables (its gold layer), built from the sources above by
 * gridflow and gridflow_models. The relations were listed and counted through
 * GridflowClient on 26 Sep 2026 (v0.4 local-population research); the earlier
 * `system_marginal_price` entry is gone because no relation of that name exists.
 */
export const GOLD: GoldGroup[] = [
  { label: 'the power stack', relations: ['gold_stack_supply_curve_points', 'gold_stack_clearing', 'gold_stack_residual_demand'] },
  { label: 'system prices joined with carbon intensity', relations: ['gold_uk_imbalance_context'] },
  { label: 'a GB day-ahead benchmark from the market index price', relations: ['gold_gb_day_ahead_benchmark'] },
  { label: 'gas storage by country', relations: ['gold_eu_gas_storage'] },
  { label: 'demand forecasts with their scores', relations: ['gold_forecasts', 'gold_forecast_metrics'], view: { to: '/forecasts', label: 'Forecasts' } },
]

export const DOMAINS: Domain[] = ['Electricity', 'Gas', 'Weather']

export const datasetCount = (s: Source) => s.families.reduce((n, f) => n + f.datasets.length, 0)

export function kindCounts(s: Source): Record<Kind, number> {
  const out: Record<Kind, number> = { series: 0, events: 0, reference: 0 }
  for (const f of s.families) out[f.kind] += f.datasets.length
  return out
}

export const views = (s: Source) => s.families.flatMap((f) => (f.view ? [f.view] : []))

export const sourceByKey = (key: string | undefined) => SOURCES.find((s) => s.key === key)
