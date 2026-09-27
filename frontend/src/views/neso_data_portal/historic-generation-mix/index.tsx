/**
 * NESO's historic generation mix (v0.4 P4, bespoke): Great Britain's
 * generation by fuel for every half-hour since 2009, the deepest history
 * the Explorer holds, with NESO's carbon intensity for each half-hour.
 *
 * Two views on one page. The recent window (the default week, or up to 31
 * days) is the template's chart: the eleven fuels stacked per half-hour, the
 * carbon intensity below on the same clock. A long window (the toolbar's
 * 1 year, 5 years, since 2009, or a calendar year) is one rows request the
 * backend reads as means where it must (said above the chart); the page
 * draws each UK day's or month's mean with year ticks (`LongChart`). The key
 * lists the fuels with their latest or mean values; the working panel holds
 * the selected period's mix as one bar and every day, month or year of the
 * window with its shares; the side panel says what is drawn and what isn't.
 */
import { instantLabel, periodLabel } from '../../../design/time'
import { SourceLine } from '../../_template/panels'
import { defineView } from '../../define'
import { AXIS_WIDTH, CI, CI_COLOR, CI_LABEL, FUELS, FUEL_COLUMNS } from './fuels'
import { MixAbout } from './MixAbout'
import { MixBody } from './MixBody'
import { MixKey } from './MixKey'
import { MixPeriods } from './MixPeriods'
import { clockOf, latestHeld, rowKindOf, stepsText } from './periods'
import { SpanControl } from './SpanControl'

const UNITS = 'GW and gCO₂/kWh'

const view = defineView({
  title: 'Historic generation mix',
  sub: 'Great Britain’s generation by fuel for every half-hour since 2009, as NESO publishes it, with the carbon intensity of each half-hour: a recent week in detail, or years at a time.',
  caveats: [
    'NESO republishes its whole history in every file and revises past half-hours; gridflow keeps every download, and this page reads the latest.',
    'Embedded wind is wind generation on the distribution networks rather than the transmission system; NESO lists it apart from transmission-connected wind.',
    'Imports are what came in over the interconnectors: NESO’s mix counts no exports, and storage only what it generated, so nothing here goes below zero.',
    'NESO dates each half-hour in UTC, as its field notes say (the file itself doesn’t); the page shows the UK clock.',
  ],
  datasets: [
    {
      id: 'historic_generation_mix',
      body: 'series',
      label: 'Generation mix',
      title: 'Generation by fuel',
      values: [...FUELS.map(({ column, label, color }) => ({ column, label, color })), { column: CI, label: CI_LABEL, color: CI_COLOR }],
      chart: {
        mark: 'stacked',
        values: FUEL_COLUMNS,
        lower: { values: [CI], mark: 'line', extremes: true },
        // Eleven fuels and the carbon intensity: all drawn, none left to the table.
        maxSeries: 12,
        axisWidth: AXIS_WIDTH,
      },
      controls: SpanControl,
      panels: {
        main: {
          title: (ctx) => {
            const clock = clockOf(ctx.window)
            return clock === 'native' ? 'Generation by fuel' : `Generation by fuel, ${clock === 'day' ? 'daily' : 'monthly'} means`
          },
          src: (ctx) => {
            const clock = clockOf(ctx.window)
            const read = ctx.series ? stepsText(ctx.series) : 'rows'
            const what = clock === 'native' ? 'each half-hour, the fuels stacked, carbon intensity below' : `${clock === 'day' ? 'daily' : 'monthly'} means of the ${read} read`
            return <SourceLine ctx={ctx} columns={[...FUEL_COLUMNS, CI]} filters={ctx.response?.filters} unit={UNITS} what={what} />
          },
          Body: MixBody,
        },
        key: {
          title: 'Fuels',
          src: (ctx) => {
            if (clockOf(ctx.window) !== 'native') return <SourceLine ctx={ctx} unit={UNITS} what="each fuel’s mean over the window" />
            const latest = ctx.series ? latestHeld(ctx.series) : undefined
            return <SourceLine ctx={ctx} unit={UNITS} what={latest ? `latest half-hour held, ${periodLabel(latest.t, ctx.series?.stepMs ?? null)}` : 'latest half-hour held'} window={false} />
          },
          Body: MixKey,
        },
        working: {
          title: (ctx) => {
            const kind = rowKindOf(clockOf(ctx.window))
            return `Mix by ${kind}`
          },
          src: (ctx) => {
            const kind = rowKindOf(clockOf(ctx.window))
            const per = kind === 'day' ? 'UK day' : kind
            return (
              <SourceLine
                ctx={ctx}
                unit="GW, % and gCO₂/kWh"
                what={
                  <>
                    the eleven fuel columns and <code>{CI}</code> per {per}: held, mean total, mean carbon intensity and each fuel’s share
                  </>
                }
              />
            )
          },
          Body: MixPeriods,
        },
        side: {
          title: 'About this data',
          src: (ctx) => {
            const read = Date.parse(ctx.readAt)
            return <SourceLine ctx={ctx} what={Number.isFinite(read) ? `local coverage as read ${instantLabel(read)}` : 'local coverage'} window={false} />
          },
          Body: MixAbout,
        },
      },
    },
  ],
})

export default view
