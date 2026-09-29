/**
 * Elexon's loss of load probability and de-rated margin (`lolpdrm`): one
 * issue's figures per half-hour, each with the time that issue was made.
 *
 * - Main (`MarginBody`): the de-rated margin in GW, and above it the
 *   probability per million where any half-hour is above zero; Table: a row
 *   per half-hour, margin in MW, the probability as held, and its issue.
 * - Key (`MarginKey`): the margin's latest, highest and lowest; the
 *   probability as figures; how far ahead the figures were issued.
 * - Working (`IssuePanel`): each half-hour's issue lead on the main chart's
 *   clock, then the days with the issues behind them.
 * - Side: the template's About.
 */
import { SourceLine } from '../../_template/panels'
import type { PanelSlots } from '../../define'
import { defineView } from '../../define'
import { AXIS_WIDTH, COLORS, ISSUED, LOLP, MARGIN } from './figures'
import { IssuePanel } from './IssuePanel'
import { MarginBody } from './MarginBody'
import { MarginKey } from './MarginKey'

const columns = [MARGIN, LOLP, ISSUED]

const panels: PanelSlots = {
  main: {
    title: (ctx) => (ctx.mode === 'table' ? 'Every half-hour, both figures' : 'De-rated margin, with the loss of load probability above it'),
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={columns}
        unit={ctx.mode === 'table' ? 'MW; probability 0 to 1' : 'GW; probability per million'}
        what={ctx.mode === 'table' ? 'a row per half-hour with the issue behind it' : 'per half-hour one issue made ahead of it, not the latest'}
      />
    ),
    Body: MarginBody,
  },
  key: {
    title: 'Key',
    src: (ctx) => <SourceLine ctx={ctx} columns={columns} unit="GW; probability 0 to 1" what="the latest half-hour, highest and lowest, and how far ahead each was issued" />,
    Body: MarginKey,
  },
  working: {
    title: (ctx) => (ctx.mode === 'chart' ? 'How far ahead each half-hour was issued, and the days' : 'The days'),
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={columns}
        unit={ctx.mode === 'chart' ? 'hours; GW; probability 0 to 1' : 'GW; probability 0 to 1'}
        what={ctx.mode === 'chart' ? 'hours from each issue to its half-hour, then each UK day' : 'each UK day: half-hours held, lowest and highest margin, highest probability, and its issues'}
      />
    ),
    Body: IssuePanel,
  },
}

const view = defineView({
  title: 'Loss of load probability and de-rated margin',
  sub: 'Elexon’s de-rated margin, half-hour by half-hour, with its loss of load probability: each half-hour shows one issue made hours ahead of it, not the latest, and the page names which.',
  caveats: [
    'These are not the latest figures. Elexon issues them every half-hour, each issue reaching from under an hour ahead to between 17 and 40 hours ahead, and gridflow keeps one issue per half-hour for each day it fetches, picked by the order it reads that day’s files rather than by time. Checked against the files fetched for all 14 days held (29 Sep 2026): every half-hour shows the first issue made after 01:00 or after 13:00 BST that reaches it, and that is the last issue fetched for it at only 26 of 780 half-hours. Against that last issue, the de-rated margin shown differs by 0.9 GW at the median half-hour and by 5.7 GW at most. The key and the working panel name the issue behind each figure.',
    'Nothing was fetched locally for 6 to 12 Aug 2026 or for 22 Sep 2026 on, so 6 and 7 Aug and 22 and 23 Sep show only issues made on 5 Aug and 21 Sep, 11 to 40 hours ahead of their half-hours.',
    'The loss of load probability is 0 at most half-hours held: on 29 Sep 2026 it was above zero at 12 of 780, all in the half-hours from 17:30 to 21:00 BST on 14, 15, 16 and 22 Sep. Elexon’s files give it to nine decimal places, and every value above zero in them is a whole number of 0.0000001, so a 0 may stand for a value below that step; the rows don’t say. The page prints it to seven decimal places at least.',
    'gridflow describes the de-rated margin as the system’s margin in MW after capacity is de-rated for the risk that it is unavailable, and the loss of load probability as a probability from 0 to 1; Elexon’s own definitions aren’t held here.',
  ],
  datasets: [
    {
      id: 'lolpdrm',
      body: 'series',
      label: 'Loss of load probability and de-rated margin',
      panels,
      values: [
        { column: MARGIN, label: 'De-rated margin', color: COLORS.margin },
        { column: LOLP, label: 'Loss of load probability', color: COLORS.lolp },
      ],
      chart: { mark: 'line', lower: false, zero: true, axisWidth: AXIS_WIDTH },
    },
  ],
})

export default view
