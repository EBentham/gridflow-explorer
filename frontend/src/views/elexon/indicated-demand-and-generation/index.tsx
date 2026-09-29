/**
 * Elexon's day and day-ahead indicated demand (`inddem`) and indicated
 * generation (`indgen`): one figure per half-hour and boundary, N (national)
 * by default. Each dataset reads the other beside it, so both draw as a pair
 * on one axis whichever is open; demand, held negative, is drawn with its
 * sign flipped and every place that shows it says so.
 *
 * - Main (`PairBody`): the two lines in GW; Table: a row per half-hour in MW,
 *   demand as held and flipped, with the issue each figure comes from.
 * - Key (`PairKey`): each line's latest, highest and lowest, and how far
 *   ahead the figures drawn were issued.
 * - Working (`IssuePanel`): each half-hour's issue lead on the main chart's
 *   clock, then the days with the issues behind them.
 * - Side: the template's About.
 *
 * The other dataset is read split by boundary rather than filtered to one:
 * a dataset read beside the page can't follow the page's boundary (see
 * NEEDS.md), so the page picks the boundary's series from it.
 */
import { SourceLine } from '../../_template/panels'
import type { SourcePart } from '../../_template/panelHelpers'
import type { DatasetView, PageContext, PanelSlots, RelatedSpec } from '../../define'
import { defineView } from '../../define'
import { BoundaryControl } from './BoundaryControl'
import { AXIS_WIDTH, BOUNDARIES, BOUNDARY, BOUNDARY_PARAM, COLORS, DEMAND, GENERATION, INDDEM, INDGEN, ISSUED, NATIONAL_BOUNDARY, OTHER_KEY, boundaryOf } from './figures'
import { IssuePanel } from './IssuePanel'
import { PairBody } from './PairBody'
import { PairKey } from './PairKey'

const ownColumn = (ctx: PageContext) => (ctx.dataset.id === INDDEM ? DEMAND : GENERATION)
const otherColumn = (ctx: PageContext) => (ctx.dataset.id === INDDEM ? GENERATION : DEMAND)
const at = (ctx: PageContext) => ({ [BOUNDARY]: boundaryOf(ctx) })

/** The other dataset in a source line: split by boundary as read, the page's boundary picked from it. */
function otherPart(ctx: PageContext, unit: string, columns = true): SourcePart[] {
  const rel = ctx.related[OTHER_KEY]
  if (!rel) return []
  return [{ source: rel.source, dataset: rel.spec.dataset, columns: columns ? [otherColumn(ctx), ISSUED] : undefined, filters: at(ctx), unit }]
}

const panels: PanelSlots = {
  main: {
    title: (ctx) =>
      ctx.mode === 'table' ? 'Every half-hour, both figures' : ctx.dataset.id === INDDEM ? 'Indicated demand, sign flipped, against indicated generation' : 'Indicated generation against indicated demand, sign flipped',
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[ownColumn(ctx), ISSUED]}
        filters={at(ctx)}
        unit={ctx.mode === 'table' ? 'MW' : 'GW'}
        also={otherPart(ctx, ctx.mode === 'table' ? 'MW' : 'GW')}
        what={ctx.mode === 'table' ? 'a row per half-hour, demand as held and with its sign flipped, and the issue behind it' : 'per half-hour the first issue from the latest day fetched, demand drawn with its sign flipped'}
      />
    ),
    Body: PairBody,
  },
  key: {
    title: 'Key',
    src: (ctx) => <SourceLine ctx={ctx} columns={[ownColumn(ctx), ISSUED]} filters={at(ctx)} unit="GW" also={otherPart(ctx, 'GW', false)} what="the latest half-hour, highest and lowest, and how far ahead each was issued" />,
    Body: PairKey,
  },
  working: {
    title: (ctx) => (ctx.mode === 'chart' ? 'How far ahead each half-hour was issued, and the days' : 'The days'),
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[ownColumn(ctx), ISSUED]}
        filters={at(ctx)}
        unit="GW, and hours"
        also={otherPart(ctx, 'GW')}
        what={ctx.mode === 'chart' ? 'hours from each issue to its half-hour, then each UK day' : 'each UK day: half-hours held, highest and lowest, and its issues'}
      />
    ),
    Body: IssuePanel,
  },
}

const query = (params: URLSearchParams) => {
  const b = params.get(BOUNDARY_PARAM)
  return { filters: { [BOUNDARY]: b && BOUNDARIES.includes(b) ? b : NATIONAL_BOUNDARY } }
}

const generation: RelatedSpec = {
  key: OTHER_KEY,
  source: 'elexon',
  dataset: INDGEN,
  label: 'Indicated generation, every boundary',
  query: { group: BOUNDARY },
  values: [{ column: GENERATION, label: 'Indicated generation', color: COLORS.generation }],
}
const demand: RelatedSpec = {
  key: OTHER_KEY,
  source: 'elexon',
  dataset: INDDEM,
  label: 'Indicated demand, every boundary',
  query: { group: BOUNDARY },
  values: [{ column: DEMAND, label: 'Indicated demand, as held (negative)', color: COLORS.demand }],
}

const common: Pick<DatasetView, 'controls' | 'panels' | 'query'> = { controls: BoundaryControl, panels, query }

const view = defineView({
  title: 'Indicated demand and generation',
  sub: 'Elexon’s day and day-ahead indicated demand and indicated generation, half-hour by half-hour, side by side for the whole system (boundary N) or one of 17 other boundaries, B1 to B17.',
  caveats: [
    'These are not the latest forecasts. gridflow keeps only the first issue from each day it fetches them (a known fault in gridflow, not yet fixed; for demand, checked against the files fetched for 3 Aug 2026), and each half-hour shows that issue from the latest day it was fetched for: for a past day, the one made at about 01:17 BST that day. The key and the working panel give the issue behind each figure.',
    'Both lines drop sharply each night at about 23:00 BST and rise again at 01:30 BST. The drop follows the issue, not the clock: in the rows held (checked 29 Sep 2026), the figures each issue made at about 01:17 BST gives for its last half-hours, that day’s last two and the next day’s first three, read several GW lower than those before them. On Tue 22 Sep the same issue runs on to 05:00 BST, and the drop with it, until a later issue takes over. The key’s lowest figures and the days’ ranges can fall in these half-hours. Why isn’t set out in the rows held.',
    'Indicated demand is held as a negative figure. This page turns its sign for display only, so that demand reads above zero beside generation; it is named “sign flipped” wherever it is drawn, and the table gives the figure as held beside it.',
    'Boundary N is the whole system and opens by default; B1 to B17 are named by their codes, as the rows don’t say what area each bounds. They are not parts of N: at a half-hour checked on 18 Sep 2026 (checked 29 Sep 2026), B1 to B17 added up to about twice N for demand and more than four times N for generation.',
    'The gap between the two lines is not Elexon’s indicated imbalance, published separately: generation plus demand as held matches none of its 96 half-hours on 18 and 19 Sep 2026 (checked 29 Sep 2026). What each figure counts isn’t set out in the rows held.',
  ],
  datasets: [
    {
      ...common,
      id: INDDEM,
      body: 'series',
      label: 'Indicated demand',
      values: [{ column: DEMAND, label: 'Indicated demand, as held (negative)', color: COLORS.demand }],
      related: [generation],
      chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
    },
    {
      ...common,
      id: INDGEN,
      body: 'series',
      label: 'Indicated generation',
      caveats: [
        'That generation keeps the earliest issue of each fetch as demand does is expected from how it is stored, not checked against the files fetched. At boundary N its issue times match demand’s at every half-hour of 17 to 23 Sep 2026 (checked 29 Sep 2026).',
      ],
      values: [{ column: GENERATION, label: 'Indicated generation', color: COLORS.generation }],
      related: [demand],
      chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
    },
  ],
})

export default view
