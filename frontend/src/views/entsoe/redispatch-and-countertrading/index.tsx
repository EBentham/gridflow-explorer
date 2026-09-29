/**
 * ENTSO-E's redispatch and countertrading family. Only internal
 * redispatching (`redispatching_internal`) is held, for the Netherlands and
 * Belgium: MW per quarter-hour, one line per zone. The other three datasets
 * were asked for and came back empty; the toolbar and About name them.
 *
 * A series, not an events table: the rows carry a time, a zone and MW on a
 * quarter-hour clock, and nothing an event would have (no id, start and end,
 * direction or reason). The working panel reads stretches of consecutive
 * quarter-hours redispatching off the series, and says each stretch is read
 * from the quarter-hours alone.
 */
import { SourceLine } from '../../_template/panels'
import type { PageContext, SlotSpec } from '../../define'
import { defineView } from '../../define'
import { AboutRedispatch } from './AboutRedispatch'
import { AREA, DATASET, QUANTITY, ZONES } from './figures'
import { RedispatchKey } from './RedispatchKey'
import { StretchesPanel } from './StretchesPanel'

const src = (what: string) => (ctx: PageContext) => <SourceLine ctx={ctx} columns={[QUANTITY]} by={AREA} filters={ctx.response?.filters} unit="MW" what={what} />

const panels: { key: SlotSpec; working: SlotSpec; side: SlotSpec } = {
  key: {
    title: 'Key',
    src: src('each zone’s latest value held, then its quarter-hours redispatching, peak and energy in MWh'),
    Body: RedispatchKey,
  },
  working: {
    title: 'When each zone redispatched',
    src: src('quarter-hours held and redispatching per UK day and zone, then each stretch of consecutive quarter-hours redispatching, with energy in MWh'),
    Body: StretchesPanel,
  },
  side: {
    title: 'About this data',
    Body: AboutRedispatch,
  },
}

const view = defineView({
  title: 'Redispatch and countertrading',
  sub: 'How many MW grid operators in the Netherlands and Belgium redispatched inside their own zones each quarter-hour to relieve congestion.',
  datasets: [
    {
      id: DATASET,
      body: 'series',
      label: 'Internal redispatching',
      title: 'Internal redispatching per quarter-hour, by zone',
      query: { group: AREA },
      values: [{ column: QUANTITY, label: 'Internal redispatching', display: 'MW' }],
      groups: ZONES,
      chart: { mark: 'line', zero: true, lower: false },
      caveats: [
        'Only the Netherlands and Belgium are held; ENTSO-E’s rows here hold no GB zone. Each row names the same zone on both sides, so this is redispatching inside a zone, not across a border.',
        'The rows say how many MW each quarter-hour and nothing more: no direction (up or down), no reason and no plant. The page says how much and when, never why. It shows MW, not GW, as tens of MW would round away in GW.',
        'The Netherlands holds whole days of quarter-hours, many of them at 0 MW. Belgium holds values in short runs only, with no rows between them. The page leaves those quarter-hours as gaps, never as 0 MW: the rows don’t say whether Belgium redispatched then.',
        'The chart reads both zones on the UK clock, an hour behind their own Central European time: 19:00 there reads 18:00 here.',
      ],
      panels,
    },
  ],
})

export default view
