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
 * The unit is shown as unconfirmed everywhere (`UNIT_UNCONFIRMED`): the
 * source list's `degC` comes from gridflow's notes alone. See NEEDS.md.
 */
import { SourceLine } from '../../_template/panels'
import { SeriesBody } from '../../_template/SeriesBody'
import { plannedParts, relatedParts } from '../../_template/panelHelpers'
import { defineView } from '../../define'
import { COLORS, DEMAND_KEY, INDO, TEMP, UNIT_UNCONFIRMED, seriesOf } from './figures'
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
        'The unit is unconfirmed: the rows carry none, gridflow’s schema for this dataset states none, and only gridflow’s notes give degrees Celsius. Figures show as published, with no unit.',
        'Each figure sits on the day it was measured, not the day it was published. The rows say nothing of how it was taken, so the page doesn’t call it a mean or a reading at a set time.',
        'gridflow’s schema and notes list normal, low and high reference temperatures for this dataset, but none of them is held, so the page draws the measured figure alone.',
        'A day with no figure hasn’t been fetched here. It is a gap in the line and “not held locally” in the table, never a zero.',
      ],
      values: [{ column: TEMP, label: 'Temperature', color: COLORS.temp, unit: UNIT_UNCONFIRMED }],
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
          src: (ctx) => <SourceLine ctx={ctx} columns={[TEMP]} unit={null} what={ctx.mode === 'table' ? 'a row per UK day' : 'a marker per UK day, joined where days run on'} />,
          Body: SeriesBody,
        },
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[TEMP]} unit={null} what="the latest day held, the 7 days to it, the warmest and coolest days, and the days held" />,
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
                unit={null}
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
