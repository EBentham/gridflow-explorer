/**
 * The working panel for both datasets. In the Chart view, how far ahead each
 * half-hour's figure was issued, as bars on the main chart's clock and
 * value-axis width: what the page shows for a half-hour is one issue among
 * several, and this says which. Then each UK day: the half-hours held, each
 * figure's highest and lowest (demand with its sign flipped), and the issues
 * the day's figures come from.
 */
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { HOUR_MS, clock, dayLabel, instantLabel, londonMidnight, stepNoun, windowDomain, zoneAbbrev } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, COLORS, LEAD_UNIT, boundaryName, issueStats, pairDays, pairOf, type PairDay } from './figures'

const dash = '–'

/** `01:17 BST that day (45)`: an issue named against the day it gives figures for. */
function issueWords(day: PairDay, at: number, n: number, many: boolean): string {
  const issuedOn = londonMidnight(at)
  const time = `${clock(at)} ${zoneAbbrev(at)}`
  const when = issuedOn === day.start ? `${time} that day` : issuedOn === londonMidnight(day.start - 1) ? `${time} the day before` : instantLabel(at)
  return many ? `${when} (${n})` : when
}

export function IssuePanel({ ctx }: { ctx: PageContext }) {
  const pair = pairOf(ctx)
  if (!pair || !ctx.window || (!pair.gen && !pair.dem)) {
    return <p className="gf-hint">Nothing is held for this boundary in this window, so there is no issue to read and no day to summarise.</p>
  }
  const issue = issueStats(pair)
  const days = pairDays(pair, ctx.window)
  const noun = pair.bucketed && pair.stepMs ? meansText(pair.stepMs) : stepNoun(pair.stepMs)
  const own = pair.ownIsDemand ? 'demand' : 'generation'
  const unit = (pair.gen ?? pair.dem)?.unit
  const range = (lo: { v: number } | null, hi: { v: number } | null) => (lo && hi && unit ? `${unit.plain(lo.v)} to ${unit.plain(hi.v)}` : dash)
  const heldDays = days.filter((d) => d.gHeld > 0 || d.dHeld > 0)
  const firstHeld = days.findIndex((d) => d.gHeld > 0 || d.dHeld > 0)
  const lead = firstHeld === -1 ? 0 : firstHeld
  const shown = lead >= 2 ? days.slice(lead) : days
  const last = heldDays.at(-1)
  const lastHeld = [...pair.rows].reverse().find((r) => typeof r.l === 'number')
  const lastPartial = last && last.expected !== null && Math.max(last.gHeld, last.dHeld) < last.expected
  const endsOnNewest = Boolean(issue && lastHeld && Math.round(lastHeld.t - (lastHeld.l ?? 0) * HOUR_MS) === issue.newest)
  const held = (d: PairDay) => {
    const count = (n: number) => (d.expected !== null && n < d.expected ? `${n} of ${d.expected}` : String(n))
    return d.gHeld === d.dHeld || !pair.gen || !pair.dem ? count(Math.max(d.gHeld, d.dHeld)) : `${count(d.gHeld)} and ${count(d.dHeld)}`
  }
  const cols = 5
  // A run of days opening in part: the day before, whose issue gives a day's first half-hours, holds nothing.
  const first = firstHeld > 0 ? days[firstHeld] : null
  const firstRow = first ? pair.rows.find((r) => r.t >= first.start && (typeof r.g === 'number' || typeof r.d === 'number')) : undefined
  const openingGap = first && firstRow && pair.stepMs ? Math.round((firstRow.t - first.start) / pair.stepMs) : 0

  return (
    <>
      {ctx.mode === 'chart' && issue && (
        <>
          <KeyList items={[{ key: 'l', mark: { kind: 'bars', color: COLORS.lead, shape: 'rise' }, label: `Hours before each half-hour the ${own} figure drawn for it was issued` }]} />
          <SeriesChart
            panels={[
              {
                rows: pair.rows,
                series: [{ key: 'lead', field: 'l', column: 'published_at', group: null, label: 'Issued ahead', color: COLORS.lead, unit: LEAD_UNIT, from: 'lead', count: issue.count, mean: null, min: null, max: null, signed: false }],
                mark: 'bars',
                unit: LEAD_UNIT,
                stepMs: pair.stepMs,
                bucketed: pair.bucketed,
                settlement: pair.settlement,
                height: 150,
                zero: true,
                axisWidth: AXIS_WIDTH,
              },
            ]}
            domain={windowDomain(ctx.window.start, ctx.window.end)}
            picked={ctx.picked}
            onPick={ctx.pick}
            fixture={ctx.fixture}
          />
          <p className="gf-hint">
            Each bar is one half-hour: how long before it the issue drawn for it was made. A saw from near zero up to about a day means each day’s figures come from one issue made early that day, so the early half-hours were issued minutes ahead and the late ones most of a day ahead; a
            step in the bars is a change of issue.
          </p>
        </>
      )}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Generation, lowest to highest, GW
              </th>
              <th scope="col" className="is-num">
                Demand flipped, lowest to highest, GW
              </th>
              <th scope="col">Issued</th>
            </tr>
          </thead>
          <tbody>
            {lead >= 2 && (
              <tr className="is-missing">
                <th scope="row">
                  {dayLabel(days[0].start)} – {dayLabel(days[lead - 1].start)}
                </th>
                <td className="is-num">0</td>
                <td colSpan={cols - 2}>not held locally, {plural(lead, 'day', 'days')}</td>
              </tr>
            )}
            {shown.map((d) => {
              if (d.gHeld === 0 && d.dHeld === 0) {
                return (
                  <tr key={d.date} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={cols - 2}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && Math.max(d.gHeld, d.dHeld) < d.expected
              return (
                <tr key={d.date} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{held(d)}</td>
                  <td className="is-num">{range(d.gLow, d.gHigh)}</td>
                  <td className="is-num">{range(d.dLow, d.dHigh)}</td>
                  <td>{d.issues.length ? d.issues.map((x) => issueWords(d, x.at, x.n, d.issues.length > 1)).join('; ') : dash}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        {boundaryName(pair.boundary).replace(/^b/, 'B')}. Held counts the {noun} held{pair.gen && pair.dem ? ', one figure for both when they agree' : ''}; a day held in part is summarised in part. Demand is the held figure with its sign flipped, so its highest is the half-hour of most demand; each range runs over the half-hours held that day. Issued names the issue each
        day’s {own} figures come from, with how many {noun} each gives when there is more than one.
        {first && openingGap > 0
          ? ` ${dayLabel(first.start)} lacks its first ${plural(openingGap, noun.replace(/s$/, ''), noun)}, and the day before holds none: in the rows held, a day’s first three come from the issue made the day before.`
          : ''}
        {lastPartial && endsOnNewest && last ? ` ${dayLabel(last.start)} is held in part because the newest issue held runs no further.` : ''}
        {ctx.mode === 'chart' ? ' Select a day to mark it on both charts.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
