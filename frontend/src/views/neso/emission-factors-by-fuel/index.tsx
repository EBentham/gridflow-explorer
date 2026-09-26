/**
 * NESO's emission factors by fuel (`intensity_factors`): a reference table
 * (v0.4 P4-0 reference batch) of the carbon intensity NESO assigns to each
 * fuel, highest first.
 */
import { idWords } from '../../_template/codes'
import { defineView } from '../../define'

const view = defineView({
  title: 'Emission factors by fuel',
  sub: 'The carbon intensity NESO counts for each fuel and import when it works out GB’s carbon intensity.',
  caveats: ['gridflow’s power stack doesn’t use these factors yet: its carbon cost comes from its own assumption.'],
  datasets: [
    {
      id: 'intensity_factors',
      body: 'reference',
      label: 'Factors',
      title: 'Emission factor per fuel',
      columns: [
        { field: 'fuel', label: 'Fuel', text: idWords },
        { field: 'factor_gco2_kwh', label: 'Emission factor', format: 'number', unit: 'gCO2/kWh' },
      ],
      sort: { field: 'factor_gco2_kwh', dir: 'desc' },
      search: ['fuel'],
    },
  ],
})

export default view
