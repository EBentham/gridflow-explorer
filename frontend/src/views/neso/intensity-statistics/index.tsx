/**
 * NESO's carbon intensity statistics (v0.4 P4-0 reference batch): the
 * highest, mean and lowest intensity per 24-hour block, as a table. Its
 * sibling `intensity_stats` summarises whatever span one request asked for,
 * so it is listed on the page as held and left out.
 */
import { defineView } from '../../define'

const view = defineView({
  title: 'Intensity statistics',
  sub: 'The highest, mean and lowest carbon intensity of GB electricity in each 24-hour block, as a table.',
  caveats: [
    'The blocks run 24 hours from midnight UTC, which is 01:00 on the UK clock while summer time runs, so a block is not quite a UK day.',
    'The other statistics dataset, intensity_stats, isn’t shown: each of its rows summarises whatever span gridflow asked for in one request, which says nothing on its own.',
  ],
  datasets: [
    {
      id: 'intensity_stats_block',
      body: 'series',
      label: 'Daily blocks',
      title: 'Intensity per 24-hour block',
      values: [
        { column: 'max_gco2_kwh', label: 'Highest' },
        { column: 'average_gco2_kwh', label: 'Mean' },
        { column: 'min_gco2_kwh', label: 'Lowest' },
      ],
      chart: false,
    },
  ],
})

export default view
