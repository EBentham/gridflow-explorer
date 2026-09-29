/**
 * The working panel. In the Chart view, how far ahead each half-hour's
 * figures were issued, as bars on the main chart's clock and value-axis
 * width: what the page shows for a half-hour is one issue among several, and
 * this says which. Then each UK day: the half-hours held, the margin's lowest
 * and highest, the highest loss of load probability, and the issues the
 * day's figures come from.
 */
import { KeyList } from '../../../design/charts'
import { listText, plural } from '../../../design/format'
import { HOUR_MS, clock, dayLabel, instantLabel, londonMidnight, stepNoun, windowDomain, zoneAbbrev } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, COLORS, LEAD_UNIT, daysOf, issueStats, lolpText, modelOf, type Day } from './figures'

const dash = '–'

/** `01:04 BST that day (24)`: an issue named against the day it gives figures for. */
function issueWords(day: Day, at: number, n: number, many: boolean): string {
  const issuedOn = londonMidnight(at)
  const time = `${clock(at)} ${zoneAbbrev(at)}`
  const when = issuedOn === day.start ? `${time} that day` : issuedOn === londonMidnight(day.start - 1) ? `${time} the day before` : instantLabel(at)
  return many ? `${when} (${n})` : when
}

export function IssuePanel({ ctx }: { ctx: PageContext }) {
  const model = modelOf(ctx)
  if (!model || !ctx.window || (!model.margin && !model.lolp)) {
    return <p className="gf-hint">Nothing is held in this window, so there is no issue to read and no day to summarise.</p>
  }
  const issue = issueStats(model)
  const days = daysOf(model, ctx.window)
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const one = noun.replace(/s$/, '')
  const unit = model.margin?.unit
  const has = (d: Day) => d.held > 0
  const firstHeld = days.findIndex(has)
  const lead = firstHeld === -1 ? 0 : firstHeld
  const shown = lead >= 2 ? days.slice(lead) : days
  const heldDays = days.filter(has)
  const last = heldDays.at(-1)
  const lastHeld = [...model.rows].reverse().find((r) => typeof r.l === 'number')
  const lastPartial = last && last.expected !== null && last.held < last.expected
  const endsOnNewest = Boolean(issue && lastHeld && Math.round(lastHeld.t - (lastHeld.l ?? 0) * HOUR_MS) === issue.newest)
  // A day whose figures all come from issues made on earlier days.
  const aheadOnly = heldDays.filter((d) => d.issues.length > 0 && d.issues.every((x) => londonMidnight(x.at) < d.start))
  // A run of days opening in part: the issues that reach a day's first half-hours come from a fetch not held.
  const first = firstHeld >= 0 ? days[firstHeld] : null
  const firstRow = first ? model.rows.find((r) => r.t >= first.start && (typeof r.m === 'number' || typeof r.p === 'number')) : undefined
  const openingGap = first && firstRow && model.stepMs ? Math.round((firstRow.t - first.start) / model.stepMs) : 0
  const cols = 5
  const held = (d: Day) => (d.expected !== null && d.held < d.expected ? `${d.held} of ${d.expected}` : String(d.held))
  const range = (d: Day) => (d.mLow && d.mHigh && unit ? `${unit.plain(d.mLow.v)} to ${unit.plain(d.mHigh.v)}` : dash)
  const lolpCell = (d: Day) => {
    if (!d.lolpHeld || !d.lolpHigh) return dash
    return d.lolpAbove > 0 ? `${lolpText(d.lolpHigh.v)} (${d.lolpAbove} above 0)` : '0'
  }

  return (
    <>
      {ctx.mode === 'chart' && issue && (
        <>
          <KeyList items={[{ key: 'l', mark: { kind: 'bars', color: COLORS.lead, shape: 'rise' }, label: 'Hours before each half-hour the figures drawn for it were issued' }]} />
          <SeriesChart
            panels={[
              {
                rows: model.rows,
                series: [{ key: 'lead', field: 'l', column: 'published_at', group: null, label: 'Issued ahead', color: COLORS.lead, unit: LEAD_UNIT, from: 'lead', count: issue.count, mean: null, min: null, max: null, signed: false }],
                mark: 'bars',
                unit: LEAD_UNIT,
                stepMs: model.stepMs,
                bucketed: model.bucketed,
                settlement: model.settlement,
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
            Each bar is one half-hour: how long before it the issue drawn for it was made. Within one issue the bars rise, as its later half-hours were forecast further ahead; a drop is where another issue takes over. The taller the bar, the
            further ahead the figures were forecast.
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
                Margin, lowest to highest, GW
              </th>
              <th scope="col" className="is-num">
                Highest probability
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
              if (!has(d)) {
                return (
                  <tr key={d.date} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={cols - 2}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              return (
                <tr key={d.date} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{held(d)}</td>
                  <td className="is-num">{range(d)}</td>
                  <td className="is-num">{lolpCell(d)}</td>
                  <td>{d.issues.length ? d.issues.map((x) => issueWords(d, x.at, x.n, d.issues.length > 1)).join('; ') : dash}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {noun} held; a day held in part is summarised in part, over the {noun} it holds. Highest probability is the day’s highest loss of load probability as held, with how many {noun} sit above 0; a 0 is held as 0. Issued
        names the issue each day’s figures come from, with how many {noun} each gives when there is more than one.
        {first && openingGap > 0 ? ` ${dayLabel(first.start)} lacks its first ${plural(openingGap, one, noun)}: the issues that reach them come from a fetch that isn’t held locally.` : ''}
        {aheadOnly.length > 0
          ? ` ${listText(aheadOnly.map((d) => dayLabel(d.start)))} ${aheadOnly.length === 1 ? 'holds' : 'hold'} only figures issued on an earlier day.`
          : ''}
        {lastPartial && endsOnNewest && last ? ` ${dayLabel(last.start)} is held in part because the newest issue held runs no further.` : ''}
        {ctx.mode === 'chart' ? ' Select a day to mark it on the charts.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
