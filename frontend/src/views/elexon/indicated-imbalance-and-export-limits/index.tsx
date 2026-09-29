/**
 * Elexon's day and day-ahead indicated imbalance (`imbalngc`) and indicated
 * margin (`melngc`), for boundary N only: one figure per half-hour, each
 * with the issue it comes from. Each dataset reads the other beside it, so
 * both draw, one above the other on the same clock, whichever is open.
 *
 * - Main (`PairBody`): the page's own dataset on top, the other below, in
 *   GW; Table: a row per half-hour in MW with the issue behind each figure.
 * - Key (`PairKey`): each figure's latest, highest and lowest, how often the
 *   imbalance sits either side of zero, and how far ahead the figures drawn
 *   were issued.
 * - Working (`IssuePanel`): each half-hour's issue lead on the main chart's
 *   clock, then the days with the issues behind them.
 * - Side: the template's About.
 *
 * The source list calls the family "export limits"; the second dataset is
 * Elexon's indicated margin, and the page names it so.
 */
import { SourceLine } from '../../_template/panels'
import type { SourcePart } from '../../_template/panelHelpers'
import type { DatasetView, PageContext, PanelSlots, RelatedSpec } from '../../define'
import { defineView } from '../../define'
import { AXIS_WIDTH, COLORS, IMBALANCE, IMBALNGC, ISSUED, LABELS, MARGIN, MELNGC, OTHER_KEY } from './figures'
import { IssuePanel } from './IssuePanel'
import { PairBody } from './PairBody'
import { PairKey } from './PairKey'

const ownColumn = (ctx: PageContext) => (ctx.dataset.id === IMBALNGC ? IMBALANCE : MARGIN)
const otherColumn = (ctx: PageContext) => (ctx.dataset.id === IMBALNGC ? MARGIN : IMBALANCE)

/** The other dataset in a source line. */
function otherPart(ctx: PageContext, unit: string, columns = true): SourcePart[] {
  const rel = ctx.related[OTHER_KEY]
  if (!rel) return []
  return [{ source: rel.source, dataset: rel.spec.dataset, columns: columns ? [otherColumn(ctx), ISSUED] : undefined, unit }]
}

const panels: PanelSlots = {
  main: {
    title: (ctx) => (ctx.mode === 'table' ? 'Every half-hour, both figures' : ctx.dataset.id === IMBALNGC ? 'Indicated imbalance, with the margin below' : 'Indicated margin, with the imbalance below'),
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[ownColumn(ctx), ISSUED]}
        unit={ctx.mode === 'table' ? 'MW' : 'GW'}
        also={otherPart(ctx, ctx.mode === 'table' ? 'MW' : 'GW')}
        what={
          ctx.mode === 'table'
            ? 'boundary N only, a row per half-hour with the issue behind it'
            : 'boundary N only, per half-hour the first issue from the latest day fetched'
        }
      />
    ),
    Body: PairBody,
  },
  key: {
    title: 'Key',
    src: (ctx) => <SourceLine ctx={ctx} columns={[ownColumn(ctx), ISSUED]} unit="GW" also={otherPart(ctx, 'GW', false)} what="boundary N only: the latest half-hour, highest and lowest, and how far ahead each was issued" />,
    Body: PairKey,
  },
  working: {
    title: (ctx) => (ctx.mode === 'chart' ? 'How far ahead each half-hour was issued, and the days' : 'The days'),
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[ownColumn(ctx), ISSUED]}
        unit="GW, and hours"
        also={otherPart(ctx, 'GW')}
        what={ctx.mode === 'chart' ? 'boundary N only: hours from each issue to its half-hour, then each UK day' : 'boundary N only: each UK day, half-hours held, lowest and highest, and its issues'}
      />
    ),
    Body: IssuePanel,
  },
}

const margin: RelatedSpec = {
  key: OTHER_KEY,
  source: 'elexon',
  dataset: MELNGC,
  label: LABELS.margin,
  values: [{ column: MARGIN, label: LABELS.margin, color: COLORS.margin }],
}
const imbalance: RelatedSpec = {
  key: OTHER_KEY,
  source: 'elexon',
  dataset: IMBALNGC,
  label: LABELS.imbalance,
  values: [{ column: IMBALANCE, label: LABELS.imbalance, color: COLORS.imbalance }],
}

const common: Pick<DatasetView, 'panels'> = { panels }

const view = defineView({
  title: 'Indicated imbalance and margin',
  sub: 'Elexon’s day and day-ahead indicated imbalance and indicated margin for boundary N, the whole system, half-hour by half-hour on one clock: each half-hour shows the first issue of the latest day it was fetched, not the latest issue.',
  caveats: [
    'Not the latest figures: for each half-hour, gridflow keeps only the first issue of each day it fetches, though each day holds 47 (a known gridflow fault, checked against the files fetched for 1 to 5 Aug and 13 to 21 Sep 2026). A past day usually comes mostly from the issue made at about 01:17 BST that day; the key and the working panel name the issue behind each figure.',
    'Boundary N, the whole system, only. Elexon publishes 18 boundaries, but gridflow’s copy drops the boundary and keeps, for each half-hour, the last row of that day’s files, which was N’s at every half-hour checked; if that order changed, another boundary’s figures would show here unmarked.',
    'Within each issue the imbalance jumps at 23:00 BST, by 1.5 to 7.1 GW on all 16 nights held, where the median half-hour move is 0.4 GW; the margin moves then too, by up to 5.8 GW, though by 0.6 GW or less on 4 nights. Both move again where a newer issue takes over, usually at 01:30 BST. The rows don’t say why, and the key’s highest and lowest can fall between the two (checked 29 Sep 2026).',
    'The source list calls this family “export limits”; its second dataset is Elexon’s indicated margin.',
  ],
  datasets: [
    {
      ...common,
      id: IMBALNGC,
      body: 'series',
      label: 'Indicated imbalance',
      caveats: [
        'gridflow describes an imbalance below zero as the system short and above zero as long; Elexon’s own definition isn’t held here. The imbalance is not indicated generation plus indicated demand (held negative) either: they agree at none of the 782 half-hours held for all three (checked 29 Sep 2026).',
      ],
      values: [{ column: IMBALANCE, label: LABELS.imbalance, color: COLORS.imbalance }],
      related: [margin],
      chart: { mark: 'line', lower: false, zero: true, axisWidth: AXIS_WIDTH },
    },
    {
      ...common,
      id: MELNGC,
      body: 'series',
      label: 'Indicated margin',
      caveats: ['gridflow describes the margin as available generation less demand; Elexon’s own definition isn’t held here.'],
      values: [{ column: MARGIN, label: LABELS.margin, color: COLORS.margin }],
      related: [imbalance],
      chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
    },
  ],
})

export default view
