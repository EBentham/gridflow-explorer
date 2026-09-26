/**
 * FIXTURE: the template's demo family (v0.4 P0-2). Every dataset here is
 * synthetic, made in the browser by `_data/fixtureData.ts`, and the page
 * reads it through the fixture adapter, so every panel carries the Fixture
 * tag. It shows the three bodies and the states a real page meets; P4-0
 * deletes it with the fixture once the HTTP adapter lands.
 *
 * Routes for screenshots: `/sources/demo/dataset-page` (a stacked series
 * with a related price under it, which its default filter cuts to one
 * market, as `mid`'s cuts to one provider), `?dataset=demo_price` (one line
 * with its extremes, and a working panel of the page's own), `?dataset=demo_notices`
 * (events), `?dataset=demo_units` (reference), `?dataset=demo_forecast` (not
 * held), each with `&view=table`,
 * `&days=30` (a window past the local depth, drawn as hourly means) and
 * `&fixture=error|refreshing|empty|toomany`; the notices take `&area=all`
 * (the page's own control, clearing the default filter).
 */
import { SourceLine } from '../../_template/panels'
import { defineView } from '../../define'
import { AreaControl } from './AreaControl'
import { PriceExtremes } from './PriceExtremes'

const view = defineView({
  title: 'Dataset page demo',
  sub: 'The dataset page template on synthetic data: a stacked series, a price, an events feed and a reference table.',
  adapter: 'fixture',
  caveats: ['Every number on this page is synthetic, made in the browser to exercise the template. None of it is read from gridflow.'],
  datasets: [
    {
      id: 'demo_output',
      body: 'series',
      label: 'Output',
      title: 'Output by plant type, with the price',
      sub: 'Synthetic output by plant type, stacked, with the synthetic price under it on the same clock. Storage charging stacks below zero.',
      values: [{ column: 'output_mw', label: 'Output' }],
      query: { group: 'plant_type' },
      groups: [
        { value: 'wind', label: 'Wind', color: 'var(--fuel-wind)' },
        { value: 'gas', label: 'Gas', color: 'var(--fuel-gas)' },
        { value: 'storage', label: 'Storage', color: 'var(--fuel-pumped_storage)' },
      ],
      chart: { mark: 'stacked', lower: { from: 'price', height: 140 } },
      related: [
        {
          key: 'price',
          source: 'demo',
          dataset: 'demo_price',
          label: 'Price',
          values: [{ column: 'price_gbp_mwh', label: 'Price', color: 'var(--chart-price)' }],
        },
      ],
    },
    {
      id: 'demo_price',
      body: 'series',
      label: 'Price',
      title: 'Price',
      sub: 'A synthetic half-hourly price, with its highest and lowest values in the window labelled. It goes below zero when the wind is high.',
      values: [{ column: 'price_gbp_mwh', label: 'Price', color: 'var(--chart-price)' }],
      chart: { mark: 'line', zero: true },
      // A page's own working panel, in place of the days table.
      panels: {
        working: {
          title: 'Lowest and highest in the window',
          src: (ctx) => <SourceLine ctx={ctx} columns={['price_gbp_mwh']} filters={ctx.response?.filters} unit="£/MWh" what="the held values ranked" />,
          Body: PriceExtremes,
        },
      },
    },
    {
      id: 'demo_notices',
      body: 'events',
      label: 'Notices',
      title: 'Outage notices',
      sub: 'Synthetic outage notices, one row per notice, at the time each was published.',
      timeLabel: 'Published',
      columns: [
        { field: 'notice_id', label: 'Notice', format: 'id' },
        { field: 'unit_id', label: 'Unit', format: 'id' },
        { field: 'fuel', label: 'Fuel' },
        { field: 'event_type', label: 'Type' },
        { field: 'status', label: 'Status' },
        { field: 'unavailable_mw', label: 'Unavailable', format: 'number', unit: 'MW', display: 'MW' },
        { field: 'starts_at', label: 'Starts', format: 'time' },
        { field: 'ends_at', label: 'Ends', format: 'time' },
        { field: 'area', label: 'Area' },
      ],
      filters: ['event_type', 'status', 'fuel', 'area'],
      strip: true,
      // The dataset's default filter keeps GB only; the page's own switch clears it.
      query: (params) => (params.get('area') === 'all' ? { filters: null } : {}),
      controls: AreaControl,
    },
    {
      id: 'demo_units',
      body: 'reference',
      label: 'Units',
      title: 'Unit register',
      sub: 'A synthetic register of generating units: a table with no clock.',
      columns: [
        { field: 'unit_id', label: 'Unit', format: 'id' },
        { field: 'name', label: 'Name' },
        { field: 'fuel', label: 'Fuel' },
        { field: 'capacity_mw', label: 'Capacity', format: 'number', unit: 'MW', display: 'MW' },
        { field: 'company', label: 'Company' },
        { field: 'region', label: 'Region' },
      ],
      search: ['unit_id', 'name', 'company', 'region'],
      countBy: 'fuel',
    },
    {
      id: 'demo_forecast',
      body: 'series',
      label: 'Forecast',
      sub: 'A dataset the demo source lists but doesn’t hold, to show the not-held state.',
      values: [{ column: 'forecast_mw', label: 'Forecast' }],
    },
  ],
})

export default view
