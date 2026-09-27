/**
 * ENTSO-E's outage notices (v0.4 P4): planned outages of generation units,
 * production units, cross-border transmission assets and consumption, each
 * as a table of availability blocks (a start and a MW figure) dated by when
 * the notice was published. The page draws its own table (block starts name
 * their year and sort as times), a key of counts, a per-unit working panel,
 * and About with a line on its dates. Nothing adds the MW figure up: whether
 * it is the capacity out or the capacity left is unsettled.
 */
import { instantLabel } from '../../../design/time'
import { SourceLine } from '../../_template/panels'
import { defineView, type PanelSlots, type PageContext } from '../../define'
import { AboutOutages } from './AboutOutages'
import { OutagesKey } from './OutagesKey'
import { OutagesTable } from './OutagesTable'
import { MW, START, shapeOf } from './shape'
import { UnitsPanel } from './UnitsPanel'

const UNIT = 'MW, meaning unconfirmed'

const whoOf = (ctx: PageContext) => shapeOf(ctx)?.who.field

const PANELS: PanelSlots = {
  main: {
    title: (ctx) => ctx.view.title ?? ctx.view.label,
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[START, MW]}
        filters={ctx.response?.filters}
        unit={UNIT}
        what={
          <>
            one row per outage block, dated by its notice’s <code>published_at</code>
          </>
        }
      />
    ),
    Body: OutagesTable,
  },
  key: {
    title: 'In this window',
    src: (ctx) => <SourceLine ctx={ctx} columns={[START, MW]} filters={ctx.response?.filters} what="outage blocks counted, not added up" />,
    Body: OutagesKey,
  },
  working: {
    title: (ctx) => {
      const noun = shapeOf(ctx)?.noun[1] ?? 'units'
      return `${noun[0].toUpperCase()}${noun.slice(1)} in this window`
    },
    src: (ctx) => {
      const who = whoOf(ctx)
      return <SourceLine ctx={ctx} columns={[START, MW]} by={who} filters={ctx.response?.filters} unit={UNIT} what="blocks, block starts and MW span per row" />
    },
    Body: UnitsPanel,
  },
  side: {
    title: 'About this data',
    src: (ctx) => {
      const read = Date.parse(ctx.readAt)
      return <SourceLine ctx={ctx} what={Number.isFinite(read) ? `local coverage as read ${instantLabel(read)}` : 'local coverage'} window={false} />
    },
    Body: AboutOutages,
  },
}

const view = defineView({
  title: 'Outages, unavailable capacity per interval',
  sub: 'ENTSO-E’s notices of planned outages at power stations, cross-border lines and consumers, each as blocks with a start and a MW figure, dated by when the notice was published.',
  caveats: [
    'Planned outages only: gridflow never asks ENTSO-E for unplanned ones.',
    'Each row is one block of a notice, with its start and MW figure. Its end isn’t held, so how long a block lasts, and what is out now, can’t be read.',
    'The MW figure may be the capacity left, not the capacity out: full outages mostly show 0 MW. Until that is settled it is shown as published and never added up.',
    'A notice is fetched again every day it stays open. Each block shows once here, in its latest published version.',
  ],
  datasets: [
    {
      id: 'outages_generation',
      body: 'events',
      label: 'Generation units',
      title: 'Outage blocks at generation units',
      sub: 'ENTSO-E’s notices of planned outages at generation units, each as blocks with a start and a MW figure, dated by when the notice was published.',
      caveats: [
        'About 40% of the generation notices gridflow fetched were cancelled, and these rows have no status column to tell which: any row may be a withdrawn plan.',
        'Where two notices give one unit a block at the same start, only the newer shows.',
        'GB’s units (area 10YGB----------A) appear only in notices published 2 to 6 October 2025: set the window there to read them.',
      ],
      panels: PANELS,
    },
    {
      id: 'outages_transmission',
      body: 'events',
      label: 'Transmission',
      title: 'Outage blocks on cross-border assets',
      sub: 'ENTSO-E’s notices of planned outages on cross-border transmission assets, mostly on the GB–France border, dated by when the notice was published.',
      caveats: [
        'Assets show as ENTSO-E’s codes: the rows carry no names. In and out areas are as ENTSO-E gives them.',
        'A few of the blocks held are cancelled; when a window holds any, filter Status to leave them out. A blank status is a notice that states none.',
        'No capacity is published beside these figures, so whether they are the capacity out or left can’t be checked against the asset.',
      ],
      panels: PANELS,
    },
    {
      id: 'outages_production',
      body: 'events',
      label: 'Production units',
      title: 'Outage blocks at production units',
      sub: 'ENTSO-E’s notices of planned outages at production units in the Netherlands, Germany-Luxembourg and France, dated by when the notice was published.',
      caveats: [
        'About two thirds of the blocks held are cancelled (status Cancelled); filter Status to leave them out. A blank status is a notice that states none.',
        'No GB units: these rows cover the Netherlands, Germany-Luxembourg and France. For many areas ENTSO-E’s production units overlap its generation units.',
      ],
      panels: PANELS,
    },
    {
      id: 'outages_consumption',
      body: 'events',
      label: 'Consumption',
      title: 'Outage blocks at consumption units',
      sub: 'ENTSO-E’s planned unavailability of consumption units, per area and quarter-hour, dated by when it was published.',
      caveats: [
        'This one comes on a regular 15-minute clock, almost all Germany-Luxembourg and near flat. It is dated here by publication, so a fortnight of quarter-hours lands on the day ENTSO-E sent it; sort by Block starts to read it in order.',
      ],
      panels: PANELS,
    },
    {
      id: 'outages_offshore_grid',
      body: 'events',
      label: 'Offshore grid',
      title: 'Outage blocks on offshore grids',
      caveats: ['Every answer gridflow had from ENTSO-E for offshore grid outages, from 1 August to 14 September 2026, was empty.'],
    },
  ],
})

export default view
