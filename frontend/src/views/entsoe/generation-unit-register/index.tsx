/**
 * ENTSO-E's generation unit register (`generation_units_master_data`): a
 * reference table (v0.4 P4-0 reference batch) of each generating unit's
 * code, area and production type, searchable, counted by production type.
 */
import { productionType } from '../../_template/codes'
import { defineView } from '../../define'

const view = defineView({
  title: 'Generation unit register',
  sub: 'The generating units ENTSO-E lists, with each unit’s area and production type.',
  caveats: [
    'Units and areas show as ENTSO-E’s codes: this read doesn’t carry the units’ names yet. GB’s area code is 10YGB----------A.',
    'GB’s units look out of date: they still include hard-coal units, and GB’s last coal plant closed in 2024. Read them as the last list GB sent ENTSO-E.',
  ],
  datasets: [
    {
      id: 'generation_units_master_data',
      body: 'reference',
      label: 'Register',
      title: 'Generating units',
      columns: [
        { field: 'unit_mrid', label: 'Unit', format: 'id' },
        { field: 'area_code', label: 'Area', format: 'id' },
        { field: 'production_type', label: 'Production type', text: productionType },
      ],
      sort: { field: 'area_code', dir: 'asc' },
      search: ['unit_mrid', 'area_code', 'production_type'],
      countBy: 'production_type',
    },
  ],
})

export default view
