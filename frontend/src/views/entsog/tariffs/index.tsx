/**
 * ENTSO-G's capacity tariffs and tariff simulations (v0.4 P4-0 reference
 * batch), each a reference table. The source answers with every country
 * whatever gridflow asks for, so the page opens on the UK's rows and a
 * switch shows them all.
 */
import { defineView } from '../../define'
import { CountryControl } from './CountryControl'

const view = defineView({
  title: 'Tariffs',
  sub: 'The tariffs gas network operators charge for capacity at each point, and what a capacity product would cost them, by country.',
  caveats: ['ENTSO-G sends every country’s rows even when gridflow asks for the UK’s, so the page shows the UK’s by default.'],
  datasets: [
    {
      id: 'tariffs',
      body: 'reference',
      label: 'Tariffs',
      title: 'Capacity tariffs',
      caveats: [
        'The tariffs’ units and currencies are held in columns this read leaves out, so both values show as published, unit unconfirmed. About 7% are blank.',
        'gridflow stores the full tariff list again each day it fetches it; the table shows each tariff once.',
      ],
      query: (params) => (params.get('country') === 'all' ? {} : { filters: { country_code: 'UK' } }),
      controls: CountryControl,
      columns: [
        { field: 'point_key', label: 'Point', format: 'id' },
        { field: 'operator', label: 'Operator' },
        { field: 'product_type', label: 'Product' },
        { field: 'product_period_from', label: 'Product from', format: 'time' },
        { field: 'applicable_tariff_in_common_unit_value', label: 'Tariff, common unit', format: 'number' },
        { field: 'applicable_tariff_per_eurk_wh_d_value', label: 'Tariff, per kWh/d', format: 'number' },
        { field: 'country_code', label: 'Country', format: 'id' },
      ],
      sort: { field: 'point_key', dir: 'asc' },
      search: ['point_key', 'operator', 'product_type', 'country_code'],
      countBy: 'product_type',
    },
    {
      id: 'tariff_simulations',
      body: 'reference',
      label: 'Simulations',
      title: 'Tariff simulations',
      caveats: ['The simulated cost is held as text, in euros per the source: “N/A” where the operator gives none, and it sorts as a number where it is one.'],
      // The backend keeps the UK by default here; "All countries" clears that default.
      query: (params) => (params.get('country') === 'all' ? { filters: null } : {}),
      controls: CountryControl,
      columns: [
        { field: 'operator', label: 'Operator' },
        { field: 'product_type', label: 'Product' },
        { field: 'timestamp_utc', label: 'Product from', format: 'time' },
        { field: 'product_simulation_cost_in_euro', label: 'Simulated cost, €', format: 'number' },
        { field: 'country_code', label: 'Country', format: 'id' },
      ],
      sort: { field: 'operator', dir: 'asc' },
      search: ['operator', 'product_type', 'country_code'],
      countBy: 'product_type',
    },
  ],
})

export default view
