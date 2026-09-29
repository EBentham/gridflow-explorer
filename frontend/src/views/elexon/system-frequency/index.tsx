/**
 * Elexon's system frequency (`freq`): Great Britain's grid frequency, one
 * reading every 15 seconds in the rows held.
 *
 * - Main (`FreqMain`): every reading on the UK clock against 50 Hz, the
 *   statutory limits and the narrower band the working panel counts; past
 *   about eight days, the backend's means, said to be means.
 *   Table: the template's.
 * - Key (`FreqKey`): the latest, lowest and highest reading with their
 *   times, the readings held, and what each line is and where its figure
 *   comes from.
 * - Working (`Excursions`): per UK day, readings and time outside each band,
 *   the longest spells outside the narrower one, and the missing readings.
 * - Side: the template's About.
 */
import { SourceLine } from '../../_template/panels'
import { meansText } from '../../_template/text'
import { defineView } from '../../define'
import { Excursions } from './Excursions'
import { FreqKey } from './FreqKey'
import { FreqMain } from './FreqMain'
import { FREQ_COLOR, NARROW, STATUTORY, VALUE, bandText, meanNoun, periodNoun, spanText } from './figures'

const view = defineView({
  title: 'System frequency',
  sub: 'Great Britain’s grid frequency as Elexon publishes it, reading by reading: how far it strays from 50 Hz, and for how long it sits outside the bands around it.',
  datasets: [
    {
      id: 'freq',
      body: 'series',
      label: 'System frequency',
      caveats: [
        'The rows held are one reading every 15 seconds, 5,760 to a full day (checked 29 Sep 2026). gridflow’s notes on this dataset say Elexon samples about every 2 seconds and publishes one-minute figures, which is not what is held. Whether each reading is a single sample or an average over its 15 seconds isn’t confirmed, so time outside a band is counted at 15 seconds a reading, and anything shorter between two readings isn’t seen.',
        `The statutory limits, ${bandText(STATUTORY)}, are the range gridflow’s notes on this dataset give as statutory. The ${bandText(NARROW)} band is the one this page was asked to count; no source held here says who sets it, so it isn’t called a limit.`,
        'Past about eight days the window is read as means over 15 minutes or longer. A mean flattens the swings inside its period, so the page then draws the means, calls its highest and lowest means, and counts no time outside.',
        'A reading at the boundary of two of gridflow’s fetches can be held twice; the copies are identical, and the page reads it once.',
      ],
      values: [{ column: VALUE, label: 'System frequency', color: FREQ_COLOR }],
      chart: { mark: 'line', lower: false },
      panels: {
        main: {
          title: (ctx) => {
            const means = ctx.series?.bucketed ? meansText(ctx.series.stepMs ?? 0) : null
            if (ctx.mode === 'table') return means ? `Every ${periodNoun(ctx.series?.stepMs ?? null)}, as means` : 'Every reading'
            return means ? `System frequency, ${means}` : 'System frequency, every reading'
          },
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[VALUE]}
              unit="Hz"
              what={
                ctx.series?.bucketed
                  ? `mean of each ${periodNoun(ctx.series.stepMs)}’s readings`
                  : ctx.mode === 'table'
                    ? 'a row per reading'
                    : `each reading, against 50 Hz, ${bandText(STATUTORY)} and ${bandText(NARROW)}`
              }
            />
          ),
          Body: FreqMain,
        },
        key: {
          title: 'Frequency',
          src: (ctx) => (
            <SourceLine ctx={ctx} columns={[VALUE]} unit="Hz" what={ctx.series?.bucketed ? `latest, lowest and highest ${meanNoun(ctx.series.stepMs)}` : 'latest, lowest and highest reading'} />
          ),
          Body: FreqKey,
        },
        working: {
          title: (ctx) => (ctx.series?.bucketed ? 'Periods held, per UK day' : 'Time outside the bands, per UK day'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[VALUE]}
              unit={ctx.series && !ctx.series.bucketed && ctx.series.stepMs ? `Hz, and time at ${spanText(ctx.series.stepMs)} a reading` : 'Hz'}
              what={
                ctx.series?.bucketed ? `lowest and highest ${meanNoun(ctx.series.stepMs)} per UK day` : `readings outside ${bandText(NARROW)} and ${bandText(STATUTORY)}, spells and missing readings`
              }
            />
          ),
          Body: Excursions,
        },
      },
    },
  ],
})

export default view
