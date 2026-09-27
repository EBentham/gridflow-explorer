/**
 * Elexon's demand outturn family: GB demand as first published after each
 * half-hour. National demand (`indo`) opens the page, with transmission
 * demand (`itsdo`) read beside it on the same clock and the gap between the
 * two drawn in the working panel. Transmission demand and total load (`atl`,
 * held for only some half-hours of each day) each get a line of their own.
 * The daily figure (`indod`) is drawn as bars with no unit, as its unit is
 * unconfirmed, and its working panel sets national demand's energy per day
 * beside it.
 */
import { SourceLine } from '../../_template/panels'
import { relatedParts } from '../../_template/panelHelpers'
import { defineView } from '../../define'
import { AXIS_WIDTH, ATL, COLORS, INDO, INDOD, ITSDO, NATIONAL_KEY, TSD_KEY, seriesOf } from './figures'
import { DailyPanel } from './DailyPanel'
import { DemandKey } from './DemandKey'
import { GapPanel } from './GapPanel'
import { LoadKey } from './LoadKey'

const view = defineView({
  title: 'Demand outturn',
  sub: 'How much electricity GB drew each half-hour, as first published: national and transmission system demand, total load, and a daily national figure.',
  datasets: [
    {
      id: 'indo',
      body: 'series',
      label: 'National demand',
      title: 'National demand per half-hour',
      caveats: [
        'These are the first figures published for each half-hour. Elexon revises them later, and the revisions are not held here.',
        'Transmission system demand runs above national demand. The Chart view draws it under national demand on the same clock, and the gap between the two in the working panel.',
      ],
      values: [{ column: INDO, label: 'National demand', color: COLORS.national }],
      related: [
        {
          key: TSD_KEY,
          source: 'elexon',
          dataset: 'itsdo',
          label: 'Transmission demand',
          values: [{ column: ITSDO, label: 'Transmission demand', color: COLORS.transmission }],
        },
      ],
      chart: { mark: 'line', extremes: true, axisWidth: AXIS_WIDTH, lower: { from: TSD_KEY, mark: 'line' } },
      panels: {
        key: {
          title: 'Key',
          src: (ctx) => {
            const t = seriesOf(ctx.related[TSD_KEY]?.series, ITSDO)
            return <SourceLine ctx={ctx} unit="GW" also={t ? relatedParts(ctx, [t], false) : []} what="the latest half-hour held, and the window's peak, trough, mean and gap" />
          },
          Body: DemandKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Transmission above national, and the days' : 'The days'),
          src: (ctx) => {
            const t = seriesOf(ctx.related[TSD_KEY]?.series, ITSDO)
            return (
              <SourceLine
                ctx={ctx}
                columns={[INDO]}
                unit="GW"
                also={t ? relatedParts(ctx, [t]) : []}
                what={ctx.mode === 'chart' ? 'transmission less national per half-hour, then national demand and the gap per UK day' : 'national demand and the gap per UK day'}
              />
            )
          },
          Body: GapPanel,
        },
      },
    },
    {
      id: 'itsdo',
      body: 'series',
      label: 'Transmission demand',
      title: 'Transmission system demand per half-hour',
      caveats: [
        'These are the first figures published for each half-hour. Elexon revises them later, and the revisions are not held here.',
        'Transmission system demand runs above national demand. Open national demand to see the two on one clock, with the gap between them.',
      ],
      values: [{ column: ITSDO, label: 'Transmission demand', color: COLORS.transmission }],
      chart: { mark: 'line' },
    },
    {
      id: 'atl',
      body: 'series',
      label: 'Total load',
      title: 'Total load per half-hour',
      caveats: [
        'Total load is held for only some half-hours of each day: about half of them in the days first checked, with the missing ones scattered through each day. Why is not yet known. They show as gaps in the line, never as zeros, and the key counts them for this window.',
      ],
      values: [{ column: ATL, label: 'Total load', color: COLORS.load }],
      chart: { mark: 'line' },
      panels: {
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[ATL]} unit="GW" what="the latest half-hour held, and the half-hours held in the window" />,
          Body: LoadKey,
        },
      },
    },
    {
      id: 'indod',
      body: 'series',
      label: 'Daily national demand',
      title: 'National demand per day, unit unconfirmed',
      sub: 'One figure of national demand for each UK day, as first published, shown without a unit as its unit is unconfirmed.',
      caveats: [
        'The unit of the daily figure is unconfirmed. Its column is named as megawatts, but the values run to more than 500,000, far above any level of GB demand in megawatts, so the chart names no unit. The working panel sets national demand’s energy for each day beside it.',
      ],
      values: [{ column: INDOD, label: 'Daily figure', color: COLORS.national }],
      related: [
        {
          key: NATIONAL_KEY,
          source: 'elexon',
          dataset: 'indo',
          label: 'National demand',
          values: [{ column: INDO, label: 'National demand', color: COLORS.national }],
        },
      ],
      chart: { mark: 'bars', zero: true },
      panels: {
        working: {
          title: 'The days, beside national demand',
          src: (ctx) => {
            const n = seriesOf(ctx.related[NATIONAL_KEY]?.series, INDO)
            return (
              <SourceLine
                ctx={ctx}
                columns={[INDOD]}
                unit={null}
                also={n ? [{ ...relatedParts(ctx, [n])[0], unit: 'MWh' }] : []}
                what="the daily figure as published, and national demand's half-hours summed as energy per UK day"
              />
            )
          },
          Body: DailyPanel,
        },
      },
    },
  ],
})

export default view
