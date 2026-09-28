/**
 * ENTSO-E's hydro reservoir filling (`water_reservoirs`): a weekly series
 * shown as a table (v0.4 P4-0 reference batch). A handful of weekly points
 * held for one area say too little for a chart, so the page lists them.
 */
import { defineView } from '../../define'

const view = defineView({
  title: 'Hydro reservoirs',
  sub: 'The energy stored in each area’s hydro reservoirs and storage plants, a reading a week, as a table.',
  caveats: [
    'Only France is held locally.',
    'A week holds one reading, so 7 days show one. Choose 30 days, or a custom range, to see more.',
    'Each reading is dated midnight Central European time, 23:00 the evening before on the UK clock, so a week that starts on a Monday reads here as starting on the Sunday.',
  ],
  datasets: [
    {
      id: 'water_reservoirs',
      body: 'series',
      label: 'Reservoirs',
      title: 'Stored energy per week',
      values: [{ column: 'reservoir_mwh', label: 'Stored energy' }],
      groups: [{ value: '10YFR-RTE------C', label: 'France' }],
      chart: false,
    },
  ],
})

export default view
