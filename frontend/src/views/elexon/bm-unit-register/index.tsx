/**
 * Elexon's BM unit register (`bmunits_reference`): a reference table (v0.4
 * P4-0 reference batch), today's register as gridflow last fetched it, with
 * a search box, the largest registrations first, and rows counted by fuel.
 */
import { defineView } from '../../define'

const view = defineView({
  title: 'BM unit register',
  sub: 'The balancing mechanism units registered with Elexon: who holds each, its fuel, its GSP group and its registered capacity.',
  caveats: [
    'The register leaves most fuels (83% of rows) and GSP groups (61%) blank, so a count by fuel covers only the rows that name one.',
    'Interconnector units are registered once per trading party, so their capacities overlap: never add capacity up by fuel.',
    'This read doesn’t carry the units’ ids or names yet, so two rows of one company can only be told apart by their other columns.',
  ],
  datasets: [
    {
      id: 'bmunits_reference',
      body: 'reference',
      label: 'Register',
      title: 'Registered units',
      columns: [
        { field: 'company_name', label: 'Company' },
        { field: 'fuel_type', label: 'Fuel' },
        { field: 'gsp_group_id', label: 'GSP group', format: 'id' },
        { field: 'registered_capacity_mw', label: 'Registered capacity', format: 'number', unit: 'MW', display: 'MW' },
      ],
      sort: { field: 'registered_capacity_mw', dir: 'desc' },
      search: ['company_name', 'fuel_type', 'gsp_group_id'],
      countBy: 'fuel_type',
    },
  ],
})

export default view
