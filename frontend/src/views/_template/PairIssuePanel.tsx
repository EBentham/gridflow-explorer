/**
 * The working panel of an issued pair (`issuePair.ts`). In the Chart view,
 * how far ahead each half-hour's figure was issued, as bars on the main
 * chart's clock and value-axis width: what the page shows for a half-hour is
 * one issue among several, and this says which. Then each UK day: the
 * half-hours held, each held side's lowest and highest, and the issues the
 * day's figures come from. A side that isn't held has no column.
 */
import { KeyList } from '../../design/charts'
import { DASH, plural } from '../../design/format'
import { HOUR_MS, dayLabel, stepNoun, windowDomain } from '../../design/time'
import type { PageContext } from '../define'
import { LEAD_UNIT, issueStats, issuesIn, issueWords } from './issues'
import { pairDays, type Pair, type PairDay } from './issuePair'
import { SeriesChart } from './SeriesChart'
import { meansText } from './text'

export interface PairIssueProps {
  ctx: PageContext
  pair: Pair
  /** The page's own measure, in lower case: `demand`. */
  own: string
  /** Each side's day-table heading, before ", lowest to highest, GW". */
  heads: { a: string; b: string }
  /** The order the sides' columns take, as in the main table. */
  order: ('a' | 'b')[]
  /** Where the figures are for, sentence case: `Boundary N`. */
  where: string
  /** A sentence on how a side's range reads, when it needs one (a flipped side). */
  note?: string
  /** The lead bars' colour, and the value-axis width the page's charts share. */
  leadColor: string
  axisWidth: number
}

export function PairIssuePanel({ ctx, pair, own, heads, order, where, note, leadColor, axisWidth }: PairIssueProps) {
  if (!ctx.window || (!pair.a && !pair.b)) {
    return <p className="gf-hint">Nothing is held in this window, so there is no issue to read and no day to summarise.</p>
  }
  const issue = issueStats(issuesIn(pair.rows))
  const days = pairDays(pair, ctx.window)
  const noun = pair.bucketed && pair.stepMs ? meansText(pair.stepMs) : stepNoun(pair.stepMs)
  const unit = (pair.a ?? pair.b)?.unit
  const range = (lo: { v: number } | null, hi: { v: number } | null) => (lo && hi && unit ? `${unit.plain(lo.v)} to ${unit.plain(hi.v)}` : DASH)
  const sides = order.filter((s) => pair[s] !== null)
  const has = (d: PairDay) => d.aHeld > 0 || d.bHeld > 0
  const heldDays = days.filter(has)
  const firstHeld = days.findIndex(has)
  const lead = firstHeld === -1 ? 0 : firstHeld
  const shown = lead >= 2 ? days.slice(lead) : days
  const last = heldDays.at(-1)
  const lastHeld = [...pair.rows].reverse().find((r) => typeof r.l === 'number')
  const lastPartial = last && last.expected !== null && Math.max(last.aHeld, last.bHeld) < last.expected
  const endsOnNewest = Boolean(issue && lastHeld && Math.round(lastHeld.t - (lastHeld.l ?? 0) * HOUR_MS) === issue.newest)
  const both = sides.length === 2
  const held = (d: PairDay) => {
    const count = (n: number) => (d.expected !== null && n < d.expected ? `${n} of ${d.expected}` : String(n))
    return d.aHeld === d.bHeld || !both ? count(Math.max(d.aHeld, d.bHeld)) : `${count(d.aHeld)} and ${count(d.bHeld)}`
  }
  const cols = 3 + sides.length
  // A run of days opening in part: the day before, whose issue gives a day's first half-hours, holds nothing.
  const first = firstHeld > 0 ? days[firstHeld] : null
  const firstRow = first ? pair.rows.find((r) => r.t >= first.start && (typeof r.a === 'number' || typeof r.b === 'number')) : undefined
  const openingGap = first && firstRow && pair.stepMs ? Math.round((firstRow.t - first.start) / pair.stepMs) : 0
  const cell = (d: PairDay, s: 'a' | 'b') => (
    <td key={s} className="is-num">
      {s === 'a' ? range(d.aLow, d.aHigh) : range(d.bLow, d.bHigh)}
    </td>
  )

  return (
    <>
      {ctx.mode === 'chart' && issue && (
        <>
          <KeyList items={[{ key: 'l', mark: { kind: 'bars', color: leadColor, shape: 'rise' }, label: `Hours before each half-hour the ${own} figure drawn for it was issued` }]} />
          <SeriesChart
            panels={[
              {
                rows: pair.rows,
                series: [{ key: 'lead', field: 'l', column: 'published_at', group: null, label: 'Issued ahead', color: leadColor, unit: LEAD_UNIT, from: 'lead', count: issue.count, mean: null, min: null, max: null, signed: false }],
                mark: 'bars',
                unit: LEAD_UNIT,
                stepMs: pair.stepMs,
                bucketed: pair.bucketed,
                settlement: pair.settlement,
                height: 150,
                zero: true,
                axisWidth,
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
              {sides.map((s) => (
                <th key={s} scope="col" className="is-num">
                  {heads[s]}, lowest to highest, GW
                </th>
              ))}
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
              const partial = d.expected !== null && Math.max(d.aHeld, d.bHeld) < d.expected
              return (
                <tr key={d.date} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{held(d)}</td>
                  {sides.map((s) => cell(d, s))}
                  <td>{d.issues.length ? d.issues.map((x) => issueWords(d.start, x.at, x.n, d.issues.length > 1)).join('; ') : DASH}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        {where}. Held counts the {noun} held{both ? ', one figure for both when they agree' : ''}; a day held in part is summarised in part{note ? `. ${note}; each` : ', and each'} range runs over the half-hours held that day. Issued names the issue each day’s {own} figures come from, with how many {noun} each
        gives when there is more than one.
        {first && openingGap > 0
          ? ` ${dayLabel(first.start)} lacks its first ${plural(openingGap, noun.replace(/s$/, ''), noun)}, and the day before holds none: in the rows held, a day’s first three come from the issue made the day before.`
          : ''}
        {lastPartial && endsOnNewest && last ? ` ${dayLabel(last.start)} is held in part because the newest issue held runs no further.` : ''}
        {ctx.mode === 'chart' ? ' Select a day to mark it on the charts.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
