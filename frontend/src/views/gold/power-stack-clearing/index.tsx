/**
 * gridflow's power stack: its model of the GB wholesale price, read as three
 * datasets of the one published run.
 *
 * - Clearing price (`gold_stack_clearing`): the modelled price per half-hour
 *   beside the market index price it is scored against, the half-hours the
 *   model's price floor set it banded, and under them the clearing demand,
 *   each bar coloured by the fuel that set the price (`ClearingMain`); a key
 *   of the latest half-hour, the means and gaps, and what set the price how
 *   often (`ClearingKey`); a table of the days, each linking to its supply
 *   curves (`ClearingDays`).
 * - Residual demand (`gold_stack_residual_demand`): demand, residual demand
 *   and clearing demand (`ResidualMain`), and what comes off between them,
 *   stacked on the same clock (`NettedPanel`).
 * - Supply curve (`gold_stack_supply_curve_points`): the merit order at one
 *   half-hour chosen in the toolbar, with the clearing demand read across to
 *   where it clears (`CurveMain`), each fuel's share (`CurveKey`), and the
 *   units in order with how their costs were set (`MeritOrder`).
 *
 * Every read pins the published headline run (`RUN_QUERY`); the backend
 * keeps that run by default and the source lines name it.
 */
import { SourceLine } from '../../_template/panels'
import { relatedFilters, type SourcePart } from '../../_template/panelHelpers'
import { periodName } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { defineView } from '../../define'
import { ClearingDays } from './ClearingDays'
import { ClearingKey } from './ClearingKey'
import { ClearingMain } from './ClearingMain'
import { ClearingControls, PeriodControl, ResidualControls } from './Controls'
import { CurveKey } from './CurveKey'
import { CurveMain } from './CurveMain'
import {
  AT_FLOOR,
  AVAILABLE,
  AXIS_WIDTH,
  CAPACITY,
  CLEARING_DATASET,
  COST,
  CUMULATIVE,
  DEMAND,
  FLOOR,
  FUEL,
  HYDRO,
  INDO,
  INTERCONNECTORS,
  LINE_COLUMNS,
  MARGINAL_FUEL,
  MARGINAL_UNIT,
  MARKET,
  MARKET_COLOR,
  MARKET_DATASET,
  MODEL_COLOR,
  OTHER,
  POLICY,
  PRICE,
  PROVENANCE,
  PUMPED,
  RANK,
  RESIDUAL,
  RESIDUAL_DATASET,
  RUN_QUERY,
  SOLAR,
  UNIT,
  WIND,
  chosenTime,
  curveTimes,
  ownRows,
  NET_PIECES,
} from './figures'
import { MeritOrder } from './MeritOrder'
import { NettedPanel } from './NettedPanel'
import { ResidualKey } from './ResidualKey'
import { ResidualMain } from './ResidualMain'
import './stack.css'

/** The run's filter as the rows carry it, or as the page asks for it before they arrive. */
const runFilters = (ctx: PageContext) => ctx.response?.filters ?? RUN_QUERY.filters

/** A related dataset in a source line, named in full with its columns, filters and unit (none for text columns). */
function relatedPart(ctx: PageContext, key: string, dataset: string, columns: string[], unit?: string): SourcePart {
  const rel = ctx.related[key]
  return { source: rel?.source ?? null, dataset, columns, filters: rel ? relatedFilters(rel) : null, ...(unit === undefined ? {} : { unit }) }
}

/** The supply curve's half-hour, in words, once the rows are read. */
function curvePeriod(ctx: PageContext): string | null {
  const model = ctx.series
  if (!model || model.bucketed) return null
  const at = chosenTime(ctx.param('at'), curveTimes(ownRows(ctx)))
  return at === null ? null : periodName(at, model.stepMs, model.settlement)
}

/** The pieces taken off demand that are one column each; the interconnectors are named together. */
const SINGLE_PIECES = NET_PIECES.filter((p) => p.columns.length === 1).flatMap((p) => p.columns)

/** The half-hour a supply-curve panel shows, as its source line's closing words; the window when there is none. */
function curveSrc(ctx: PageContext): { what: string; window: boolean } {
  const period = curvePeriod(ctx)
  return period ? { what: `at ${period}`, window: false } : { what: 'one half-hour at a time', window: true }
}

const view = defineView({
  title: 'Power stack clearing',
  sub: 'gridflow’s model of the GB power price for each half-hour: where a merit order of power stations, costed by the model, meets the demand left for them, set beside the market index price.',
  caveats: [
    'This is a model, not a market price. It is built with perfect prognosis, from the demand, wind and solar that actually happened, so it tests how the model’s stack works rather than forecasting a price in advance.',
    'The run shown is the one gridflow published, for 18 Aug – 3 Sep 2026. A run for the week from 14 Sep 2026 was checked before publishing and failed: in none of its half-hours did the actual price fall inside its 50, 80 or 90% ranges, and its average error was £157.7/MWh. It wasn’t published, so that week isn’t shown.',
    'gridflow also holds an earlier version of this run for the same half-hours, and monthly diagnostic runs from May 2025 to May 2026; this page reads the published run only.',
  ],
  datasets: [
    {
      id: CLEARING_DATASET,
      body: 'series',
      label: 'Clearing price',
      title: 'Modelled and market index price, and the clearing demand',
      caveats: [
        'The market index price is Elexon’s, for the APXMIDP provider: the benchmark gridflow scores the model against.',
      ],
      query: RUN_QUERY,
      values: [
        { column: PRICE, label: 'Modelled price', color: MODEL_COLOR },
        { column: DEMAND, label: 'Clearing demand', display: 'GW' },
        { column: CAPACITY, label: 'Capacity in the stack', display: 'GW' },
        { column: FLOOR, label: 'Price floor' },
      ],
      related: [
        {
          key: 'market',
          source: 'gold',
          dataset: MARKET_DATASET,
          label: 'Market index price',
          values: [{ column: MARKET, label: 'Market index price', color: MARKET_COLOR }],
        },
      ],
      chart: { mark: 'line', values: [PRICE], lower: false, axisWidth: AXIS_WIDTH },
      controls: ClearingControls,
      panels: {
        main: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Modelled and market index price, and the clearing demand' : 'Each half-hour'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[PRICE, DEMAND, AT_FLOOR, MARGINAL_FUEL]}
              by={POLICY}
              filters={runFilters(ctx)}
              unit={ctx.mode === 'chart' ? '£/MWh, clearing demand in GW' : '£/MWh and MW'}
              also={[relatedPart(ctx, 'market', MARKET_DATASET, [MARKET], '£/MWh')]}
              what="each half-hour as held"
            />
          ),
          Body: ClearingMain,
        },
        key: {
          title: 'Key',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[PRICE, MARGINAL_UNIT, MARGINAL_FUEL, AT_FLOOR]}
              by={POLICY}
              filters={runFilters(ctx)}
              unit="£/MWh"
              also={[relatedPart(ctx, 'market', MARKET_DATASET, [MARKET], '£/MWh')]}
              what="the latest half-hour held, the window’s means, and what set the price how often"
            />
          ),
          Body: ClearingKey,
        },
        working: {
          title: 'The days',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[PRICE, AT_FLOOR, MARGINAL_FUEL]}
              by={POLICY}
              filters={runFilters(ctx)}
              unit="£/MWh"
              also={[relatedPart(ctx, 'market', MARKET_DATASET, [MARKET], '£/MWh')]}
              what="per UK day: half-hours held, means, and what set the price most often"
            />
          ),
          Body: ClearingDays,
        },
      },
    },
    {
      id: RESIDUAL_DATASET,
      body: 'series',
      label: 'Residual demand',
      title: 'Demand, residual demand and clearing demand',
      sub: 'The demand the model’s stack is priced against, for each half-hour: demand, less wind and solar, less what else comes off before the priced power stations.',
      caveats: [
        'Demand is Elexon’s initial national demand outturn. Hydro that isn’t pumped storage, other generation, pumped storage and the interconnectors come off as Elexon’s generation by fuel reports them, signed: exports and pumping add to the clearing demand.',
      ],
      query: RUN_QUERY,
      values: [
        { column: INDO, label: 'Demand', color: 'var(--chart-actual)', display: 'GW' },
        { column: RESIDUAL, label: 'Residual demand', color: 'var(--chart-fan)', display: 'GW' },
        { column: DEMAND, label: 'Clearing demand', color: 'var(--chart-price-2)', display: 'GW' },
        { column: WIND, label: 'Wind', color: 'var(--fuel-wind)', display: 'GW' },
        { column: SOLAR, label: 'Solar', color: 'var(--fuel-biomass)', display: 'GW' },
        { column: HYDRO, label: 'Hydro, not pumped', color: 'var(--fuel-hydro)', display: 'GW' },
        { column: OTHER, label: 'Other', color: 'var(--fuel-other)', display: 'GW' },
        { column: PUMPED, label: 'Pumped storage', color: 'var(--fuel-pumped_storage)', display: 'GW' },
        ...INTERCONNECTORS.map((c) => ({ column: c, label: `Interconnector ${c.slice('netted_'.length, -'_mw'.length)}`, color: 'var(--fuel-imports)', display: 'GW' as const })),
      ],
      chart: { mark: 'line', values: LINE_COLUMNS, lower: false, maxSeries: 18, axisWidth: AXIS_WIDTH },
      controls: ResidualControls,
      panels: {
        main: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Demand, residual demand and clearing demand' : 'Each half-hour'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={ctx.mode === 'chart' ? LINE_COLUMNS : undefined}
              by={POLICY}
              filters={runFilters(ctx)}
              unit={ctx.mode === 'chart' ? 'GW' : 'MW'}
              what={ctx.mode === 'chart' ? 'each half-hour as held' : 'every column, each half-hour as held'}
            />
          ),
          Body: ResidualMain,
        },
        key: {
          title: 'Key',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[...LINE_COLUMNS, ...SINGLE_PIECES]}
              by={POLICY}
              filters={runFilters(ctx)}
              unit="GW"
              what={
                <>
                  with the ten interconnector columns, <code>netted_INT…_mw</code>, together; the latest half-hour held and the window’s means
                </>
              }
            />
          ),
          Body: ResidualKey,
        },
        working: {
          title: 'What comes off demand before the stack',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={SINGLE_PIECES}
              by={POLICY}
              filters={runFilters(ctx)}
              unit="GW"
              what={
                <>
                  and the ten interconnector columns, <code>netted_INT…_mw</code>, each half-hour as held, then each piece’s mean, lowest and highest
                </>
              }
            />
          ),
          Body: NettedPanel,
        },
      },
    },
    {
      id: 'gold_stack_supply_curve_points',
      body: 'series',
      label: 'Supply curve',
      title: 'Supply curve',
      sub: 'The model’s merit order at one half-hour: each power station’s available capacity at its modelled cost, cheapest first, and where the demand left for them clears it.',
      caveats: [
        'The costs are the model’s own: its units’ cost notes mark the fuel and carbon prices behind them as synthetic, and record no fuel price for biomass and nuclear. The unit list is the model’s too. A day is the lightest read, a row per unit per half-hour; seven days take a while, and longer windows are read as means, which aren’t a merit order.',
      ],
      query: { group: UNIT, filters: RUN_QUERY.filters },
      values: [
        { column: COST, label: 'Marginal cost' },
        { column: AVAILABLE, label: 'Available capacity', display: 'MW' },
        { column: CUMULATIVE, label: 'Through the merit order', display: 'MW' },
        { column: RANK, label: 'Merit order rank' },
      ],
      related: [
        {
          key: 'clearing',
          source: 'gold',
          dataset: CLEARING_DATASET,
          label: 'Clearing price',
          query: RUN_QUERY,
          values: [
            { column: PRICE, label: 'Modelled price', color: MODEL_COLOR },
            { column: DEMAND, label: 'Clearing demand', display: 'GW' },
          ],
        },
        {
          key: 'market',
          source: 'gold',
          dataset: MARKET_DATASET,
          label: 'Market index price',
          values: [{ column: MARKET, label: 'Market index price', color: MARKET_COLOR }],
        },
      ],
      chart: { mark: 'line', values: [COST], lower: false },
      controls: PeriodControl,
      panels: {
        main: {
          title: (ctx) => {
            if (ctx.mode === 'table') return 'Each unit, each half-hour'
            const period = curvePeriod(ctx)
            return period ? `Supply curve at ${period}` : 'Supply curve'
          },
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={ctx.mode === 'chart' ? [COST, AVAILABLE, CUMULATIVE, FUEL] : undefined}
              by={UNIT}
              filters={runFilters(ctx)}
              unit={ctx.mode === 'chart' ? '£/MWh and GW' : '£/MWh and MW'}
              also={
                ctx.mode === 'chart'
                  ? [relatedPart(ctx, 'clearing', CLEARING_DATASET, [DEMAND, PRICE, AT_FLOOR, MARGINAL_UNIT], '£/MWh and GW'), relatedPart(ctx, 'market', MARKET_DATASET, [MARKET], '£/MWh')]
                  : []
              }
              {...(ctx.mode === 'chart' ? curveSrc(ctx) : { what: 'every row as held', window: true })}
            />
          ),
          Body: CurveMain,
        },
        key: {
          title: 'Key',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[FUEL, AVAILABLE, COST]}
              by={UNIT}
              filters={runFilters(ctx)}
              unit="GW and £/MWh"
              also={[relatedPart(ctx, 'clearing', CLEARING_DATASET, [DEMAND, PRICE, MARGINAL_UNIT], '£/MWh and GW'), relatedPart(ctx, 'market', MARKET_DATASET, [MARKET], '£/MWh')]}
              {...curveSrc(ctx)}
            />
          ),
          Body: CurveKey,
        },
        working: {
          title: 'The merit order, and how its costs were set',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[RANK, FUEL, AVAILABLE, CUMULATIVE, COST, PROVENANCE]}
              by={UNIT}
              filters={runFilters(ctx)}
              unit="MW and £/MWh"
              also={[relatedPart(ctx, 'clearing', CLEARING_DATASET, [MARGINAL_UNIT, AT_FLOOR])]}
              {...curveSrc(ctx)}
            />
          ),
          Body: MeritOrder,
        },
      },
    },
  ],
})

export default view
