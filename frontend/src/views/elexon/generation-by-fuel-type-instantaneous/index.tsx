/**
 * Elexon's instantaneous generation by fuel type (`fuelinst`): GB's
 * generation by fuel read every five minutes, the fine-grained sibling of
 * the half-hourly FUELHH the pinned Generation mix screen draws.
 *
 * - Main (`InstBody`): the readings stacked in that screen's nine bands and
 *   colours, interconnectors folded into net imports and signed below zero;
 *   a click picks the day the working panel reads. Table: every reading, a
 *   column per fuel code as held, in MW.
 * - Key (`InstKey`): the bands at the latest reading, selectable; the codes
 *   folded into peaking and net imports at that reading; total generation
 *   there and at its highest and lowest.
 * - Working (`HalfHour`): one day's readings of total generation, or the
 *   selected band, against FUELHH read beside the page, with how closely six
 *   readings' mean matches FUELHH and the widest spread inside a half-hour.
 * - Side: the template's About.
 *
 * Past about a week the backend reads the window as means; the template
 * says so, and the working panel doesn't compare means with FUELHH.
 */
import { SourceLine } from '../../_template/panels'
import { meansText } from '../../_template/text'
import { defineView } from '../../define'
import { dayName, halfHourView } from './compare'
import { AXIS_WIDTH, FUEL_TYPE, GROUPS, HH_DATASET, HH_KEY, VALUE, focusedBand } from './fuels'
import { HalfHour } from './HalfHour'
import { InstBody } from './InstBody'
import { InstKey } from './InstKey'

const view = defineView({
  title: 'Generation by fuel type, instantaneous',
  sub: 'Great Britain’s generation by fuel type as Elexon reads it every five minutes: the fuels of the half-hourly generation mix, one reading at a time, set beside the half-hour figure.',
  datasets: [
    {
      id: 'fuelinst',
      body: 'series',
      label: 'Instantaneous generation',
      title: 'Generation by fuel, every five minutes',
      caveats: [
        'Instantaneous means one reading every five minutes, not a mean. FUELHH, which the Generation mix screen draws, gives one figure per half-hour; the panel below sets the two side by side.',
        'Each reading is stamped with the time Elexon published it, which in every file held is five minutes after the start of the five minutes it covers. So the reading stamped 00:00 covers the last five minutes of the day before. The page draws and names readings by their stamp.',
        'The chart folds Elexon’s twenty fuel codes into the Generation mix screen’s nine bands: OCGT, coal and oil into peaking, and every interconnector into net imports, which is below zero when GB exports, as pumped storage is while it pumps. The key lists the folded codes, and the table has a column for each code. There is no solar code in these rows.',
        'The reading at each day’s boundary is in two of Elexon’s files; the copies are identical, and the page reads it once.',
      ],
      query: { group: FUEL_TYPE },
      values: [{ column: VALUE, label: 'Generation' }],
      groups: GROUPS,
      related: [
        {
          key: HH_KEY,
          source: 'elexon',
          dataset: HH_DATASET,
          label: 'Half-hourly generation',
          query: { group: FUEL_TYPE },
          values: [{ column: VALUE, label: 'Generation' }],
          groups: GROUPS,
        },
      ],
      // The page draws its own panels; the model keeps every code.
      chart: { mark: 'stacked', maxSeries: 24, lower: false, axisWidth: AXIS_WIDTH },
      panels: {
        main: {
          title: (ctx) => {
            const means = ctx.series?.bucketed && ctx.series.stepMs ? `, ${meansText(ctx.series.stepMs)}` : ', every five minutes'
            if (ctx.mode === 'table') return means === ', every five minutes' ? 'Every reading, by fuel code' : `Generation by fuel code${means}`
            const band = focusedBand(ctx.focus)
            return band ? `${band.label} generation${means}` : `Generation by fuel${means}`
          },
          src: (ctx) =>
            ctx.mode === 'table' ? (
              <SourceLine ctx={ctx} columns={[VALUE]} by={FUEL_TYPE} unit="MW" what={ctx.series?.bucketed ? 'a row per period, a column per code' : 'a row per reading, a column per code'} />
            ) : (
              <SourceLine ctx={ctx} columns={[VALUE]} by={FUEL_TYPE} unit="GW" what={focusedBand(ctx.focus) ? `the ${focusedBand(ctx.focus)?.label.toLowerCase()} band alone` : 'codes folded into nine bands, stacked'} />
            ),
          Body: InstBody,
        },
        key: {
          title: 'Fuel',
          src: (ctx) => <SourceLine ctx={ctx} columns={[VALUE]} by={FUEL_TYPE} unit="GW, codes in MW" what="the latest reading held, and total generation’s highest and lowest" />,
          Body: InstKey,
        },
        working: {
          title: (ctx) => {
            const v = halfHourView(ctx)
            return v ? `Five-minute readings against the half-hour, ${dayName(v.day)}` : 'Five-minute readings against the half-hour'
          },
          src: (ctx) => {
            const v = halfHourView(ctx)
            const rel = ctx.related[HH_KEY]
            const band = focusedBand(ctx.focus)
            return (
              <SourceLine
                ctx={ctx}
                columns={[VALUE]}
                by={FUEL_TYPE}
                unit="GW and MW"
                also={[{ source: rel?.source ?? null, dataset: HH_DATASET, columns: [VALUE], by: FUEL_TYPE, unit: 'GW and MW' }]}
                what={v ? `${band ? band.label.toLowerCase() : 'total generation'} and every band, ${dayName(v.day)}` : 'each reading against the half-hour it falls in'}
                window={!v}
              />
            )
          },
          Body: HalfHour,
        },
      },
    },
  ],
})

export default view
