/**
 * NESO's daily wind availability (`daily_wind_availability`): its forecast
 * of the capacity each wind BM unit will have available on each day, in MW,
 * for the days 2 to 14 ahead of each file. NESO keeps no archive, so only the
 * files gridflow captured are held, and the default window (the 7 days ending
 * on the latest day held) lands on days that hold rows.
 *
 * About 276 units a day is small, so the page reads every unit for the window
 * once and draws:
 *
 * - by default, the units summed per day in GW with GB wind output (Elexon's
 *   metered wind, `fuelhh`) on the same axis (`AvailabilityMain`); a key of
 *   the total, its range, the units that change or sit at zero, when the
 *   figures were published and the ten largest units (`AvailabilityKey`);
 *   the days, and the units whose figure changes (`Working`);
 * - with one unit asked for (`?unit=`, the toolbar's `UnitControl`), that
 *   unit's figure in MW, its days, and its part of the total.
 *
 * The Table view lists every unit against every held day (`UnitsMatrix`).
 */
import { SourceLine } from '../../_template/panels'
import type { PageContext } from '../../define'
import { defineView } from '../../define'
import { AvailabilityKey } from './AvailabilityKey'
import { AvailabilityMain } from './AvailabilityMain'
import { AXIS_WIDTH, OUTPUT, OUTPUT_COLOR, OUTPUT_DATASET, OUTPUT_FILTER, OUTPUT_KEY, OUTPUT_SOURCE, UNIT, VALUE, outputPart, unitMissing, unitShown } from './figures'
import { UnitControl } from './UnitControl'
import { Working } from './Working'
import './page.css'

const oneFilter = (ctx: PageContext) => {
  const one = unitShown(ctx)
  return one ? { [UNIT]: one.id } : null
}

function mainTitle(ctx: PageContext): string {
  const missing = unitMissing(ctx)
  if (missing) return `No unit ${missing} in this window`
  const one = unitShown(ctx)
  if (ctx.mode === 'table') return one ? `Each day of ${one.id}` : 'Each unit, each day'
  return one ? `Forecast available capacity of ${one.id}` : 'Forecast available capacity, all units, with GB wind output'
}

function mainSrc(ctx: PageContext) {
  const one = oneFilter(ctx)
  if (ctx.mode === 'table') {
    return <SourceLine ctx={ctx} columns={[VALUE]} by={one ? null : UNIT} filters={one} unit={one ? 'MW, totals in GW' : 'MW'} what={one ? 'one row per day, with the total over every unit' : 'one row per unit, one column per day held'} />
  }
  if (one) return <SourceLine ctx={ctx} columns={[VALUE]} filters={one} unit="MW" what="its figure for each day" />
  return <SourceLine ctx={ctx} columns={[VALUE]} by={UNIT} unit="GW" also={[outputPart(ctx)]} what="every unit summed per day; wind output each half-hour" />
}

function keySrc(ctx: PageContext) {
  const one = oneFilter(ctx)
  if (one) return <SourceLine ctx={ctx} columns={[VALUE]} filters={one} unit="MW" what="its latest day, range, days held and part of the total" />
  return <SourceLine ctx={ctx} columns={[VALUE]} by={UNIT} unit="GW, units in MW" what="the total’s latest day and range, and the largest units" />
}

function workingSrc(ctx: PageContext) {
  const one = oneFilter(ctx)
  if (one && ctx.mode === 'chart') return <SourceLine ctx={ctx} columns={[VALUE]} filters={one} unit="MW, totals in GW" what="one row per day, with the total over every unit" />
  return <SourceLine ctx={ctx} columns={[VALUE]} by={UNIT} unit="GW, changes in MW" what="each day held, and the units whose figure changes" />
}

const view = defineView({
  title: 'Wind availability per BM unit',
  sub: 'NESO’s forecast of the capacity each wind unit in the balancing mechanism will have available, day by day, summed over every unit and set beside the wind GB generated, or read one unit at a time.',
  datasets: [
    {
      id: 'daily_wind_availability',
      body: 'series',
      label: 'Wind availability',
      caveats: [
        'Each figure is NESO’s forecast of the capacity a wind BM unit will have available for the day, in MW. It is capacity, not generation: what the wind went on to generate is a different figure, drawn beside the total as GB wind output.',
        'NESO publishes the days from 2 to 14 days ahead in each file and keeps no archive of past files, so only the files gridflow captured are held, and the local days end where the latest captured file ends. Where more than one file covers a day, the page reads the latest.',
        'Units are named by their BM unit id as NESO lists it. The page doesn’t name each wind farm, its owner or whether it is onshore or offshore.',
        'Some units are listed at zero, or below it, on some days; those figures are shown as published.',
        'The total is drawn only on days every unit in the window holds a figure, so a missing unit is never counted as zero.',
        'GB wind output is Elexon’s half-hourly metered wind generation on the transmission system. The page doesn’t claim it covers the same wind farms as NESO’s list, so the two are set side by side and never divided one by the other.',
      ],
      values: [{ column: VALUE, label: 'Forecast available', display: 'MW' }],
      related: [
        {
          key: OUTPUT_KEY,
          source: OUTPUT_SOURCE,
          dataset: OUTPUT_DATASET,
          label: 'GB wind output',
          query: { filters: OUTPUT_FILTER },
          values: [{ column: OUTPUT, label: 'GB wind output', color: OUTPUT_COLOR }],
        },
      ],
      // The page draws its own panels from the rows; the template's chart settings only shape the model it builds.
      chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
      controls: UnitControl,
      panels: {
        main: { title: mainTitle, src: mainSrc, Body: AvailabilityMain },
        key: { title: 'Key', src: keySrc, Body: AvailabilityKey },
        working: {
          title: (ctx) => (unitMissing(ctx) ? 'The days' : unitShown(ctx) && ctx.mode === 'chart' ? 'The days' : 'The days, and the units that change'),
          src: workingSrc,
          Body: Working,
        },
      },
    },
  ],
})

export default view
