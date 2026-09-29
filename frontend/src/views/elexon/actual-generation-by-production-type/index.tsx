/**
 * Elexon's actual generation by production type: `agpt`, every production
 * type Elexon republishes from ENTSO-E, and `agws`, the wind and solar part
 * of it, held for years. Both come split by `psr_type`, named as Elexon names
 * the types, which are not FUELHH's fuel codes.
 *
 * - Main (`StackBody`): the types stacked in the Generation mix screen's
 *   order, in its fuel colours where a type plainly is one of its fuels,
 *   solar in `--fuel-solar`, offshore wind and oil hatched. Table: the
 *   template's, a column per type in MW.
 * - Key (`StackKey`): each type at the latest half-hour, selectable, and the
 *   types added together, at their highest and lowest.
 * - Working: for agpt (`Compare`), agpt set against FUELHH and agws, pairing
 *   by pairing, half-hour by half-hour; for agws (`DailyEnergy`), each day's
 *   energy by type.
 * - Side: the template's About.
 */
import { SourceLine } from '../../_template/panels'
import { defineView } from '../../define'
import { AgptBody, AgptKey, AgwsBody, AgwsKey } from './Bodies'
import { Compare } from './Compare'
import { DailyEnergy } from './DailyEnergy'
import { AGWS_KEY, FUEL_TYPE, FUELHH_KEY } from './figures'
import { GROUPS, PSR, VALUE } from './types'

const view = defineView({
  title: 'Actual generation by production type',
  sub: 'Great Britain’s generation by production type as Elexon republishes it for ENTSO-E, half-hour by half-hour: every type, set against the half-hourly generation mix, and wind and solar on their own.',
  caveats: [
    'The types are ENTSO-E’s production types, named as Elexon names them, not the fuel codes of the Generation mix screen’s FUELHH.',
    'gridflow stores these rows by the day Elexon published them, not the day they cover. In the rows held, the first and last day of each run of days are held in part: the first holds only its last half-hours.',
  ],
  datasets: [
    {
      id: 'agpt',
      body: 'series',
      label: 'All production types',
      title: 'Generation by production type',
      caveats: [
        'At the start of each run of days held, every type but wind and solar holds exactly zero for a day or more: 31 Jul to 4 Aug and 12 to 13 Sep 2026 (checked 29 Sep 2026), while FUELHH shows those fuels running. The rows don’t say why. The main panel names such half-hours in its window and draws them as held.',
        'The panel below pairs FUELHH’s codes with these types by name where one plainly matches the other, which doesn’t show that they count the same plant.',
        'Hydro pumped storage is below zero in none of the rows held (checked 29 Sep 2026), so pumping doesn’t show here as it does in FUELHH, where pumped storage is below zero while it pumps. The rows don’t say why.',
        'Fossil hard coal and fossil oil are zero in every row held (checked 29 Sep 2026). The key names them, and they are in the stack and the table at zero.',
        'Onshore wind, offshore wind and solar are the same three types agws carries. The panel below sets them side by side.',
        'Elexon can re-issue a figure. The rows held carry one figure per half-hour and type.',
      ],
      query: { group: PSR },
      values: [{ column: VALUE, label: 'Generation' }],
      groups: GROUPS,
      related: [
        { key: FUELHH_KEY, source: 'elexon', dataset: 'fuelhh', label: 'Generation by fuel code', query: { group: FUEL_TYPE }, values: [{ column: VALUE, label: 'Generation' }] },
        { key: AGWS_KEY, source: 'elexon', dataset: 'agws', label: 'Wind and solar', query: { group: PSR }, values: [{ column: VALUE, label: 'Generation' }], groups: GROUPS },
      ],
      chart: { mark: 'stacked', maxSeries: 12, lower: false },
      panels: {
        main: {
          title: (ctx) => (ctx.mode === 'table' ? 'Every half-hour, by production type' : 'Generation by production type'),
          src: (ctx) => <SourceLine ctx={ctx} columns={[VALUE]} by={PSR} unit={ctx.mode === 'table' ? 'MW' : 'GW'} what={ctx.mode === 'table' ? 'a row per half-hour, a column per type' : 'stacked by type'} />,
          Body: AgptBody,
        },
        key: {
          title: 'Production type',
          src: (ctx) => <SourceLine ctx={ctx} columns={[VALUE]} by={PSR} unit="GW" what="the latest half-hour held, and every type added together" />,
          Body: AgptKey,
        },
        working: {
          title: 'Set against FUELHH and agws',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[VALUE]}
              by={PSR}
              unit="GW and MW"
              also={[
                { source: ctx.related[FUELHH_KEY]?.source ?? null, dataset: 'fuelhh', columns: [VALUE], by: FUEL_TYPE, unit: 'GW and MW' },
                { source: ctx.related[AGWS_KEY]?.source ?? null, dataset: 'agws', columns: [VALUE], by: PSR, unit: 'GW and MW' },
              ]}
              what="each pairing at the half-hours both hold"
            />
          ),
          Body: Compare,
        },
      },
    },
    {
      id: 'agws',
      body: 'series',
      label: 'Wind and solar',
      title: 'Wind and solar generation',
      sub: 'Great Britain’s onshore wind, offshore wind and solar generation as Elexon republishes it for ENTSO-E, half-hour by half-hour, with each day’s energy.',
      caveats: [
        'Elexon calls these figures actual or estimated. The rows don’t say which half-hours are estimates.',
        'Whether the solar figure covers all of GB’s solar or only part of it is unconfirmed.',
        'Some past days hold two different figures for the same half-hour and type, and the rows don’t say which is the newer. A window that includes one, 28 to 30 March 2026 among them, can’t be read yet: the page says so rather than mix the two. The 30 days to 26 September 2026 read cleanly (checked 29 Sep 2026).',
        'agpt carries the same three types among its eleven, over far fewer days; its page sets them side by side.',
      ],
      query: { group: PSR },
      values: [{ column: VALUE, label: 'Generation' }],
      groups: GROUPS,
      chart: { mark: 'stacked', lower: false },
      panels: {
        main: {
          title: (ctx) => (ctx.mode === 'table' ? 'Every half-hour, by type' : 'Wind and solar generation'),
          src: (ctx) => <SourceLine ctx={ctx} columns={[VALUE]} by={PSR} unit={ctx.mode === 'table' ? 'MW' : 'GW'} what={ctx.mode === 'table' ? 'a row per half-hour, a column per type' : 'stacked by type'} />,
          Body: AgwsBody,
        },
        key: {
          title: 'Type',
          src: (ctx) => <SourceLine ctx={ctx} columns={[VALUE]} by={PSR} unit="GW" what="the latest half-hour held, and the three added together" />,
          Body: AgwsKey,
        },
        working: {
          title: 'Energy per day',
          src: (ctx) => <SourceLine ctx={ctx} columns={[VALUE]} by={PSR} unit="GWh" what="each UK day’s half-hours added up, by type" />,
          Body: DailyEnergy,
        },
      },
    },
  ],
})

export default view
