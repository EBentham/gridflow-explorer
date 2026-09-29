/**
 * Elexon's temperature (`temp`): one GB temperature figure per UK day,
 * placed on the day it was measured.
 *
 * - Main: the template's series body, a marker per day joined where days
 *   run on; gaps stay gaps.
 * - Key (`TempKey`): the latest day, the mean of the 7 days to it, the
 *   warmest and coolest days, and the days held.
 * - Working (`DaysPanel`): each day's figure beside national demand for the
 *   same day (`indo`, read as a related dataset): half-hours held, mean, peak.
 * - Side: the template's About.
 *
 * The unit, °C, is the one gridflow's source list gives; gridflow's schema
 * for the dataset names none. See NEEDS.md.
 */
import { SourceLine } from '../../_template/panels'
import { SeriesBody } from '../../_template/SeriesBody'
import { plannedParts, relatedParts } from '../../_template/panelHelpers'
import { clock, zoneAbbrev } from '../../../design/time'
import { defineView } from '../../define'
import { COLORS, DEMAND_KEY, INDO, TEMP, seriesOf, tempUnit } from './figures'
import { DaysPanel } from './DaysPanel'
import { TempKey } from './TempKey'

const view = defineView({
  title: 'Temperature',
  sub: 'One GB temperature figure for each day, as Elexon publishes it, with national demand for the same days beside it.',
  datasets: [
    {
      id: 'temp',
      body: 'series',
      label: 'Temperature',
      title: 'Temperature per day',
      caveats: [
        'The °C is the unit gridflow’s source list gives for this dataset; gridflow’s schema for it names none.',
        'Each figure sits on the day it was measured, not the day it was published. The rows say nothing of how it was taken, so the page doesn’t call it a mean or a reading at a set time.',
        'gridflow’s schema and notes list normal, low and high reference temperatures for this dataset, but none of them is held, so the page draws the measured figure alone.',
        'A day with no figure hasn’t been fetched here. It is a gap in the line and “not held locally” in the table, never a zero.',
      ],
      values: [{ column: TEMP, label: 'Temperature', color: COLORS.temp }],
      related: [
        {
          key: DEMAND_KEY,
          source: 'elexon',
          dataset: 'indo',
          label: 'National demand',
          values: [{ column: INDO, label: 'National demand', color: COLORS.demand }],
        },
      ],
      // National demand is read for the day table only, never drawn under the daily markers.
      // Extremes go in the key, which names every day on a tie; the chart's labels name one.
      chart: { mark: 'line', extremes: false, lower: false },
      panels: {
        // The template's body; the source line names `temp` alone, as the main panel never draws national demand.
        main: {
          title: 'Temperature per day',
          src: (ctx) => {
            // A daily row arrives at midnight UTC (01:00 BST, 00:00 GMT); on a one-day clock axis that reads as a time of day.
            const oneDay = ctx.window !== null && ctx.window.start === ctx.window.end
            const at = ctx.series?.rows.find((r) => typeof r[seriesOf(ctx.series, TEMP)?.field ?? ''] === 'number')?.t
            const drawnAt = at === undefined ? 'midnight UTC' : `midnight UTC (${clock(at)} ${zoneAbbrev(at)})`
            const what = ctx.mode === 'table' ? 'a row per UK day' : oneDay ? `one figure for the day, drawn at ${drawnAt}, not at a time of day` : 'a marker per UK day, joined where days run on'
            return <SourceLine ctx={ctx} columns={[TEMP]} unit={tempUnit(ctx)} what={what} />
          },
          Body: SeriesBody,
        },
        key: {
          title: 'Key',
          src: (ctx) => {
            const t = seriesOf(ctx.series, TEMP)
            // One day held gives no mean and no range, so the line names only what the key shows.
            const what = !t || !t.count ? 'the days held' : t.count < 2 ? 'the latest day held, and the days held' : 'the latest day held, the 7 days to it, the warmest and coolest days, and the days held'
            return <SourceLine ctx={ctx} columns={[TEMP]} unit={tempUnit(ctx)} what={what} />
          },
          Body: TempKey,
        },
        working: {
          title: 'The days, beside national demand',
          src: (ctx) => {
            const n = seriesOf(ctx.related[DEMAND_KEY]?.series, INDO)
            return (
              <SourceLine
                ctx={ctx}
                columns={[TEMP]}
                unit={tempUnit(ctx)}
                also={n ? relatedParts(ctx, [n]) : plannedParts(ctx).also}
                what="each UK day’s temperature, and national demand’s half-hours held, mean and peak that day"
              />
            )
          },
          Body: DaysPanel,
        },
      },
    },
  ],
})

export default view
