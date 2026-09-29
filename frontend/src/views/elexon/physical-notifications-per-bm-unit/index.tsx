/**
 * Elexon's physical notifications (`pn`): the level each balancing
 * mechanism unit planned to run at, half-hour by half-hour, as it notified
 * the system operator. The dataset holds about 2,500 units, so the page
 * never reads it whole:
 *
 * - by default it reads the backend's own cut, the top 20 units by their
 *   mean end level in the window: their start levels stacked fuel by fuel
 *   in GW, with the market index price under them on the same clock
 *   (`LevelsMain`); a key of the units under their fuels, with the sum they
 *   make at the latest half-hour all of them hold (`UnitsKey`); and the
 *   units ranked, each with its mean, lowest, highest and half-hours at
 *   zero (`UnitsTable`);
 * - with one unit asked for (`?unit=`, the toolbar's `UnitControl`), that
 *   unit's rows alone: its line in MW over the price, its figures and the
 *   mean price where it sat above, at and below zero, then its start level
 *   against the price half-hour by half-hour, and its days (`UnitPrice`).
 *
 * Each unit's fuel is read beside the page from Elexon's 2 to 14 day
 * availability forecast (`uou2t14d`), which lists it against the unit; the
 * BM unit register's rows can't be matched to units (NEEDS.md). Only the
 * start levels are drawn (see the caveats, and NEEDS.md).
 */
import { SourceLine } from '../../_template/panels'
import type { PageContext } from '../../define'
import { defineView } from '../../define'
import { AXIS_WIDTH, END, FUEL_DATASET, FUEL_KEY, FUEL_VALUE, PRICE, PRICE_COLOR, PRICE_DATASET, PRICE_KEY, START, TOP_N, UNIT, UNIT_PARAM, focusedLine, fuelPart, pricePart, unitLines, unitShown, validUnit } from './figures'
import { LevelsMain } from './LevelsMain'
import { UnitControl } from './UnitControl'
import { UnitsKey } from './UnitsKey'
import { Working } from './Working'
import './page.css'

/** How many units the rows hold, once read; the backend's default before. */
const unitCount = (ctx: PageContext) => unitLines(ctx).filter((l) => l.def.count > 0).length || TOP_N

function mainTitle(ctx: PageContext): string {
  const one = unitShown(ctx)
  const focus = one ? undefined : focusedLine(ctx, unitLines(ctx))
  if (ctx.mode === 'table') return one ? `Each half-hour of ${one}` : focus ? `Each half-hour of ${focus.id}, one of the top ${unitCount(ctx)}` : 'Each unit, each half-hour'
  if (one) return `Notified level of ${one}`
  return focus ? `${focus.id}, one of the top ${unitCount(ctx)}` : `Top ${unitCount(ctx)} units, stacked by fuel`
}

function mainSrc(ctx: PageContext) {
  const one = unitShown(ctx)
  const filters = ctx.response?.filters
  const focus = one ? undefined : focusedLine(ctx, unitLines(ctx))
  if (ctx.mode === 'table') {
    return (
      <SourceLine
        ctx={ctx}
        columns={[START, END]}
        by={one ? null : UNIT}
        filters={filters}
        unit="MW"
        also={one ? [pricePart(ctx)] : [fuelPart(ctx)]}
        what={one ? 'one row per half-hour, with its price' : focus ? `${focus.id}’s rows, one per half-hour` : 'one row per half-hour and unit'}
      />
    )
  }
  const what = one ? 'the start level of each half-hour' : focus ? `${focus.id}’s start level of each half-hour` : `the top ${unitCount(ctx)} units’ start levels, stacked`
  return <SourceLine ctx={ctx} columns={[START]} by={one ? null : UNIT} filters={filters} unit={one || focus ? 'MW' : 'GW'} also={[fuelPart(ctx), pricePart(ctx)]} what={what} />
}

function keySrc(ctx: PageContext) {
  const one = unitShown(ctx)
  return (
    <SourceLine
      ctx={ctx}
      columns={[START]}
      by={one ? null : UNIT}
      filters={ctx.response?.filters}
      unit={one ? 'MW' : 'MW, sums in GW'}
      also={[fuelPart(ctx), pricePart(ctx)]}
      what={one ? 'the latest half-hour held, the window’s range and mean, and the mean price by level' : 'each unit at the latest half-hour all of them hold, by fuel'}
    />
  )
}

function workingSrc(ctx: PageContext) {
  const one = unitShown(ctx)
  if (!one) return <SourceLine ctx={ctx} columns={[START]} by={UNIT} filters={ctx.response?.filters} unit="MW" also={[fuelPart(ctx)]} what="each unit’s half-hours held, mean, lowest, highest and half-hours at zero" />
  return (
    <SourceLine
      ctx={ctx}
      columns={[START]}
      filters={ctx.response?.filters}
      unit="MW and £/MWh"
      also={[pricePart(ctx)]}
      what={ctx.mode === 'chart' ? 'each half-hour’s start level against its price, then per UK day' : 'per UK day, with the mean price'}
    />
  )
}

const view = defineView({
  title: 'Physical notifications per BM unit',
  sub: 'The level each unit in the balancing mechanism planned to run at, half-hour by half-hour, as it notified the system operator: the top units stacked by fuel, or any one unit set against the market index price.',
  datasets: [
    {
      id: 'pn',
      body: 'series',
      label: 'Physical notifications',
      caveats: [
        'A physical notification is the level, in MW, a unit tells the system operator it plans to run at, sent before gate closure an hour ahead. It is a plan, not what the unit went on to do: accepted bids and offers move units away from it, and metered output isn’t shown here.',
        'Elexon sends a unit’s plan for a half-hour as one or more straight runs between levels, and gridflow keeps only the first run of each half-hour. So the start level is the level as the half-hour begins, but the end level is where that first run ends, which is the half-hour’s end only when the plan held one run. The chart draws the start levels; the table shows both.',
        'By default the backend picks the top 20 units for the window by their mean end level as kept, so another window can pick other units; any unit can be read alone from the toolbar. Each unit’s fuel is as Elexon’s 2 to 14 day availability forecast lists it for these days; a unit it doesn’t list is drawn in grey as fuel not listed.',
      ],
      query: (params) => {
        const unit = validUnit(params.get(UNIT_PARAM))
        return unit ? { filters: { [UNIT]: unit } } : {}
      },
      values: [
        { column: START, label: 'Start level', display: 'MW' },
        { column: END, label: 'End level as kept', display: 'MW' },
      ],
      related: [
        {
          key: FUEL_KEY,
          source: 'elexon',
          dataset: FUEL_DATASET,
          label: 'Unit fuel',
          query: { group: UNIT },
          values: [{ column: FUEL_VALUE, label: 'Usable output forecast', display: 'MW' }],
        },
        {
          key: PRICE_KEY,
          source: 'elexon',
          dataset: PRICE_DATASET,
          label: 'Market index price',
          values: [{ column: PRICE, label: 'Market index price', color: PRICE_COLOR }],
        },
      ],
      // The page draws its own panels; `maxSeries` keeps every unit's two columns in the model.
      chart: { mark: 'stacked', maxSeries: 2 * TOP_N, lower: false, axisWidth: AXIS_WIDTH },
      controls: UnitControl,
      panels: {
        main: { title: mainTitle, src: mainSrc, Body: LevelsMain },
        key: { title: 'Key', src: keySrc, Body: UnitsKey },
        working: {
          title: (ctx) => (unitShown(ctx) ? (ctx.mode === 'chart' ? 'Level against price, and the days' : 'The days') : `The top ${unitCount(ctx)} units in this window`),
          src: workingSrc,
          Body: Working,
        },
      },
    },
  ],
})

export default view
