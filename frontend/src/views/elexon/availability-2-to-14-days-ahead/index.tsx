/**
 * Elexon's availability forecasts, 2 to 14 days ahead: the output GB's
 * plant and interconnectors are forecast to make usable on each delivery day,
 * one figure per day, issued two to fourteen days before it.
 *
 * - By fuel (`fou2t14d`, read from the table that keeps the latest issue held
 *   per fuel and day) opens the page: the fuel bands stacked per delivery day
 *   (`FuelMain`), a key of one day's bands, totals and issue (`FuelKey`), the
 *   delivery days with the issue behind each (`FuelDays`), and the day's
 *   fuel codes one by one (`FuelCodes`).
 * - By unit (`uou2t14d`, cut by the backend to the newest issue held per unit
 *   and day) sums the units fuel by fuel and sets them against the by-fuel
 *   figure, read beside it (`UnitsMain`, `UnitsKey`, `UnitsCompare`); the
 *   units are listed and searchable, and any one can be read alone
 *   (`?unit=`, `UnitsWorking`, `UnitControl`).
 *
 * The physical notifications page reads the same by-unit rows for each
 * unit's fuel; the fuel codes fold onto bands here as they do there.
 */
import { SourceLine } from '../../_template/panels'
import type { PageContext } from '../../define'
import { defineView } from '../../define'
import { FuelCodes } from './FuelCodes'
import { FuelDays } from './FuelDays'
import { FuelKey } from './FuelKey'
import { FuelMain } from './FuelMain'
import { FOU, FUEL, FUEL_KEY, ISSUED, NG_UNIT, UNIT, VALUE, unitShown } from './figures'
import { HorizonControl } from './HorizonControl'
import { UnitControl } from './UnitControl'
import { UnitsCompare } from './UnitsCompare'
import { UnitsKey } from './UnitsKey'
import { UnitsMain } from './UnitsMain'
import { UnitsWorking } from './UnitsWorking'
import './page.css'

const filters = (ctx: PageContext) => ctx.response?.filters

/** The by-fuel forecast read beside the by-unit one, in a source line. */
const fuelPart = (ctx: PageContext, unit = 'GW') => ({ source: ctx.related[FUEL_KEY]?.source ?? null, dataset: FOU, columns: [VALUE, ISSUED], by: FUEL, unit })

const HORIZON = 'These forecasts run up to two weeks past today. The toolbar’s windows stop at the latest local day; “On to …” in the toolbar runs the window on to the last day forecast.'

const view = defineView({
  title: 'Availability, 2 to 14 days ahead',
  sub: 'The output GB’s plant and interconnectors are forecast to make usable on each day two to fourteen days ahead, as Elexon publishes it: fuel by fuel, or unit by unit.',
  datasets: [
    {
      id: FOU,
      body: 'series',
      label: 'By fuel',
      title: 'Usable output forecast by fuel',
      caveats: [
        'This is a forecast, not what ran: Elexon’s figure for the output each fuel can make usable on a delivery day, in MW, one figure per fuel code per day. Nothing here says what was generated.',
        'Each delivery day shows the latest issue of the forecast held locally for it. gridflow has fetched it on some days only, so a day’s figure can come from an issue made up to two weeks before, and the days in one window can come from different issues. The key and the delivery days name the issue behind each day.',
        'Interconnectors carry a figure too, one per link. The stack’s top counts them; the key also gives the total without them.',
        HORIZON,
      ],
      values: [{ column: VALUE, label: 'Usable output forecast' }],
      chart: { mark: 'stacked', maxSeries: 30, lower: false, axisWidth: 52 },
      controls: HorizonControl,
      panels: {
        main: {
          title: (ctx) => (ctx.mode === 'table' ? 'Each fuel code, each delivery day' : 'Usable output forecast by fuel'),
          src: (ctx) =>
            ctx.mode === 'table' ? (
              <SourceLine ctx={ctx} columns={[VALUE, ISSUED]} by={FUEL} filters={filters(ctx)} unit="MW" what="one row per delivery day and fuel code, the latest issue held" />
            ) : (
              <SourceLine ctx={ctx} columns={[VALUE]} by={FUEL} filters={filters(ctx)} unit="GW" what="the latest issue held for each delivery day, fuel codes summed into fuels and stacked" />
            ),
          Body: FuelMain,
        },
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[VALUE, ISSUED]} by={FUEL} filters={filters(ctx)} unit="GW" what="one delivery day by fuel, with its issue, and the window’s highest and lowest total" />,
          Body: FuelKey,
        },
        working: {
          title: 'The delivery days',
          src: (ctx) => <SourceLine ctx={ctx} columns={[VALUE, ISSUED]} by={FUEL} filters={filters(ctx)} unit="GW" what="each delivery day by fuel, with the issue behind it" />,
          Body: FuelDays,
        },
        side: {
          title: 'Fuel codes',
          src: (ctx) => <SourceLine ctx={ctx} columns={[VALUE]} by={FUEL} filters={filters(ctx)} unit="MW" what="the key’s delivery day, code by code" window={false} />,
          Body: FuelCodes,
        },
      },
    },
    {
      id: 'uou2t14d',
      body: 'series',
      label: 'By unit',
      title: 'Usable output forecast by unit',
      sub: 'The same forecast unit by unit, for each balancing mechanism unit Elexon lists: summed fuel by fuel and set against the by-fuel figure, or any one unit alone.',
      caveats: [
        'This is a forecast, not what ran: Elexon’s figure for the output each balancing mechanism unit can make usable on a delivery day, in MW, one figure per unit per day.',
        'Each unit and delivery day shows the newest issue held locally, but that is not always the newest Elexon made. When gridflow fetches this forecast it keeps one issue per unit and day from each fetch, chosen by the order of Elexon’s files rather than by issue time, a known fault in gridflow that is not yet fixed. The key and the tables name the issue behind each figure.',
        'Its issues are not the by-fuel forecast’s: the two can be hours apart, so the units’ sum and Elexon’s by-fuel figure can differ by more than units left off the list. The chart and the side panel set them side by side, each with its issue.',
        'A few rows name no BM unit id, only a National Grid id. They count in their fuel’s sum and are listed by that id, but can’t be opened alone.',
        HORIZON,
      ],
      query: { group: UNIT },
      values: [{ column: VALUE, label: 'Usable output forecast', display: 'MW' }],
      related: [
        {
          key: FUEL_KEY,
          source: 'elexon',
          dataset: FOU,
          label: 'Usable output forecast by fuel',
          values: [{ column: VALUE, label: 'Usable output forecast by fuel' }],
        },
      ],
      // The page draws its own panels from the rows; `maxSeries` keeps every unit in the model rather than naming most as not drawn.
      chart: { mark: 'stacked', maxSeries: 600, lower: false, axisWidth: 52 },
      controls: UnitControl,
      panels: {
        main: {
          title: (ctx) => {
            const one = unitShown(ctx)
            if (ctx.mode === 'table') return one ? `Each delivery day of ${one.id}` : 'Each unit, each delivery day'
            return one ? `Usable output forecast for ${one.id}` : 'Units’ usable output forecast, summed by fuel'
          },
          src: (ctx) => {
            const one = unitShown(ctx)
            if (ctx.mode === 'table') return <SourceLine ctx={ctx} columns={[VALUE, ISSUED, FUEL, NG_UNIT]} by={UNIT} filters={filters(ctx)} unit="MW" what={one ? `${one.id}’s rows, one per delivery day` : 'one row per delivery day and unit, the newest issue held'} />
            if (one) return <SourceLine ctx={ctx} columns={[VALUE]} by={UNIT} filters={filters(ctx)} unit="MW" what={`${one.id}’s figure for each delivery day`} />
            return <SourceLine ctx={ctx} columns={[VALUE, FUEL]} by={UNIT} filters={filters(ctx)} unit="GW, the difference in MW" also={[fuelPart(ctx)]} what="units summed by the fuel each lists, stacked; under it the units’ total less the by-fuel total" />
          },
          Body: UnitsMain,
        },
        key: {
          title: 'Key',
          src: (ctx) => {
            const one = unitShown(ctx)
            if (one) return <SourceLine ctx={ctx} columns={[VALUE, ISSUED, FUEL]} by={UNIT} filters={filters(ctx)} unit="MW" what={`${one.id}: one day, its range and its issues`} />
            return <SourceLine ctx={ctx} columns={[VALUE, ISSUED, FUEL]} by={UNIT} filters={filters(ctx)} unit="GW" also={[fuelPart(ctx)]} what="one delivery day, units summed by fuel, against the by-fuel total" />
          },
          Body: UnitsKey,
        },
        working: {
          title: (ctx) => {
            const one = unitShown(ctx)
            return one ? `The delivery days of ${one.id}` : 'The units in this window'
          },
          src: (ctx) => {
            const one = unitShown(ctx)
            if (one) return <SourceLine ctx={ctx} columns={[VALUE, ISSUED]} by={UNIT} filters={filters(ctx)} unit="MW" what="each delivery day, with the issue behind it" />
            return <SourceLine ctx={ctx} columns={[VALUE, FUEL, NG_UNIT]} by={UNIT} filters={filters(ctx)} unit="MW" what="each unit listed: its fuel, days listed, the key’s day, lowest and highest" />
          },
          Body: UnitsWorking,
        },
        side: {
          title: 'Units against the by-fuel figure',
          src: (ctx) => <SourceLine ctx={ctx} columns={[VALUE, FUEL]} by={UNIT} filters={filters(ctx)} unit="GW, the difference in MW" also={[fuelPart(ctx)]} what="the key’s delivery day, fuel by fuel" window={false} />,
          Body: UnitsCompare,
        },
      },
    },
  ],
})

export default view
