/**
 * The working panel: time outside the bands, UK day by UK day, counted from
 * the readings held; the longest spells outside the narrower band; and the
 * runs of missing readings, which are counted as gaps, never as time inside
 * or outside a band.
 *
 * A window the backend reads as means has no readings to count:
 * a mean can sit inside the band while readings in it went outside. The
 * panel then lists the periods held per day and says why it counts
 * nothing.
 */
import { useMemo } from 'react'
import { fmtN, plural } from '../../../design/format'
import { fmtDay, instantLabel, periodLabel } from '../../../design/time'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { NARROW, STATUTORY, bandText, freqDays, freqDef, gapRuns, periodNoun, spanText, spellsOutside, type FreqDay, type GapRun } from './figures'
import './page.css'

const SPELLS_SHOWN = 8
const GAPS_SHOWN = 6

const clockS = (t: number) =>
  instantLabel(t, { seconds: true })
    .replace(/^.*, /, '')
    .replace(/ (BST|GMT)$/, '')

function heldCell(d: FreqDay) {
  if (d.expected === null) return d.held.toLocaleString('en-GB')
  return `${d.held.toLocaleString('en-GB')} of ${d.expected.toLocaleString('en-GB')}`
}

function rowClass(d: FreqDay) {
  if (d.held === 0) return 'is-missing'
  if (d.expected !== null && d.held < d.expected) return 'is-partial'
  return undefined
}

type DayItem = { kind: 'day'; d: FreqDay } | { kind: 'none'; first: FreqDay; last: FreqDay; n: number }

/** The days in order, with each run of two or more days holding no reading folded into one row. */
function dayItems(days: FreqDay[]): DayItem[] {
  const out: DayItem[] = []
  let i = 0
  while (i < days.length) {
    let j = i
    while (j < days.length && days[j].held === 0) j += 1
    if (j - i >= 2) {
      out.push({ kind: 'none', first: days[i], last: days[j - 1], n: j - i })
      i = j
    } else {
      out.push({ kind: 'day', d: days[i] })
      i += 1
    }
  }
  return out
}

function NoneRow({ item, cols }: { item: Extract<DayItem, { kind: 'none' }>; cols: number }) {
  return (
    <tr className="is-missing">
      <th scope="row">
        {fmtDay(item.first.day)} to {fmtDay(item.last.day)}
      </th>
      <td className="is-num">none</td>
      <td colSpan={cols}>No reading held on any of these {item.n} days</td>
    </tr>
  )
}

function gapText(g: GapRun, stepMs: number, windowEnd: number): string {
  const end = g.last + stepMs
  const to = end >= windowEnd ? 'the end of the window' : instantLabel(end, { seconds: true })
  return `${instantLabel(g.start, { seconds: true })} to ${to} (${plural(g.n, 'reading', 'readings')}, ${spanText(g.n * stepMs)})`
}

function MeansDays({ ctx, days }: { ctx: PageContext; days: FreqDay[] }) {
  const step = ctx.series?.stepMs ?? null
  const period = periodNoun(step)
  return (
    <>
      <p className="gf-hint">
        This window is read as {step ? meansText(step) : 'means'} of the readings, not the readings themselves. A mean can sit inside {bandText(NARROW)} while readings in its {period} went outside, so
        no time outside is counted from them. A {period} next to a gap may hold only some of its readings; its mean is over those, and it counts here as held. Choose 7 days or fewer to count every
        reading.
      </p>
      <div className="gf-days sf-whole">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                {`${period[0].toUpperCase()}${period.slice(1)}s held`}
              </th>
              <th scope="col" className="is-num">
                Lowest mean, Hz
              </th>
              <th scope="col">At</th>
              <th scope="col" className="is-num">
                Highest mean, Hz
              </th>
              <th scope="col">At</th>
            </tr>
          </thead>
          <tbody>
            {dayItems(days).map((item) => {
              if (item.kind === 'none') return <NoneRow key={item.first.day} item={item} cols={4} />
              const d = item.d
              return (
                <tr key={d.day} className={rowClass(d)}>
                  <th scope="row">{fmtDay(d.day)}</th>
                  <td className="is-num">{heldCell(d)}</td>
                  <td className="is-num">{d.low ? fmtN(d.low.v, 3) : '–'}</td>
                  <td>{d.low ? periodLabel(d.low.t, step).replace(/^.*, /, '') : '–'}</td>
                  <td className="is-num">{d.high ? fmtN(d.high.v, 3) : '–'}</td>
                  <td>{d.high ? periodLabel(d.high.t, step).replace(/^.*, /, '') : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function Excursions({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const def = freqDef(model)
  const days = useMemo(() => (model && def && ctx.window ? freqDays(model, def, ctx.window) : []), [model, def, ctx.window])
  const stepMs = model?.stepMs ?? null
  const spells = useMemo(() => (model && def && stepMs && !model.bucketed ? spellsOutside(model.rows, def, stepMs) : []), [model, def, stepMs])
  const gaps = useMemo(() => (model && def ? gapRuns(model.rows, def) : []), [model, def])
  if (!model || !def || ctx.state === 'empty' || !ctx.window || !days.some((d) => d.held > 0))
    return <p className="gf-hint">No reading is held in this window, so there is no time outside to count.</p>
  if (model.bucketed) return <MeansDays ctx={ctx} days={days} />
  if (!stepMs) return <p className="gf-hint">The readings in this window are not on a regular clock, so the page can’t turn them into time.</p>

  const held = days.reduce((s, d) => s + d.held, 0)
  const narrow = days.reduce((s, d) => s + d.narrow, 0)
  const statutory = days.reduce((s, d) => s + d.statutory, 0)
  const missing = gaps.reduce((s, g) => s + g.n, 0)
  const longest = [...spells].sort((a, b) => b.n - a.n || a.start - b.start).slice(0, SPELLS_SHOWN)
  const windowEnd = model.rows.length ? model.rows[model.rows.length - 1].t + stepMs : 0
  const stepText = spanText(stepMs)

  return (
    <>
      <p className="gf-hint">
        {narrow === 0
          ? `None of the ${plural(held, 'reading', 'readings')} held was outside ${bandText(NARROW)}.`
          : `Over the ${plural(held, 'reading', 'readings')} held, ${plural(narrow, 'reading was', 'readings were')} outside ${bandText(NARROW)}, about ${spanText(narrow * stepMs)} at ${stepText} a reading, in ${plural(spells.length, 'spell', 'spells')}.`}{' '}
        {statutory === 0 && narrow === 0
          ? 'So none was outside the statutory range either.'
          : statutory === 0
            ? `None was outside the statutory ${bandText(STATUTORY)}.`
            : `${plural(statutory, 'reading was', 'readings were')} outside the statutory ${bandText(STATUTORY)}.`}{' '}
        {missing > 0 ? `${plural(missing, 'reading is', 'readings are')} missing and counted as neither.` : 'No reading is missing.'}
      </p>
      <div className="gf-days sf-whole">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Readings held
              </th>
              <th scope="col" className="is-num">
                Outside {bandText(NARROW)}
              </th>
              <th scope="col" className="is-num">
                Time outside
              </th>
              <th scope="col" className="is-num">
                Outside {bandText(STATUTORY)}
              </th>
              <th scope="col" className="is-num">
                Lowest, Hz
              </th>
              <th scope="col">At</th>
              <th scope="col" className="is-num">
                Highest, Hz
              </th>
              <th scope="col">At</th>
            </tr>
          </thead>
          <tbody>
            {dayItems(days).map((item) => {
              if (item.kind === 'none') return <NoneRow key={item.first.day} item={item} cols={7} />
              const d = item.d
              const none = d.held === 0
              return (
                <tr key={d.day} className={rowClass(d)}>
                  <th scope="row">{fmtDay(d.day)}</th>
                  <td className="is-num">{heldCell(d)}</td>
                  <td className="is-num">{none ? '–' : d.narrow.toLocaleString('en-GB')}</td>
                  <td className="is-num">{none ? '–' : spanText(d.narrow * stepMs)}</td>
                  <td className="is-num">{none ? '–' : d.statutory.toLocaleString('en-GB')}</td>
                  <td className="is-num">{d.low ? fmtN(d.low.v, 3) : '–'}</td>
                  <td>{d.low ? clockS(d.low.t) : '–'}</td>
                  <td className="is-num">{d.high ? fmtN(d.high.v, 3) : '–'}</td>
                  <td>{d.high ? clockS(d.high.t) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Readings outside a band are counted per UK day, and time outside is those readings at {stepText} each: what the frequency did between two readings isn’t in the rows. A day held in part is
        counted over its readings only.
      </p>
      <h3 className="sf-sub">Longest spells outside {bandText(NARROW)}</h3>
      {longest.length === 0 ? (
        <p className="gf-hint">No reading in this window was outside {bandText(NARROW)}.</p>
      ) : (
        <>
          <div className="gf-days sf-whole">
            <table>
              <thead>
                <tr>
                  <th scope="col">From</th>
                  <th scope="col" className="is-num">
                    Readings
                  </th>
                  <th scope="col" className="is-num">
                    About
                  </th>
                  <th scope="col">Side</th>
                  <th scope="col" className="is-num">
                    Furthest, Hz
                  </th>
                  <th scope="col">At</th>
                </tr>
              </thead>
              <tbody>
                {longest.map((s) => (
                  <tr key={s.start}>
                    <th scope="row">{instantLabel(s.start, { seconds: true })}</th>
                    <td className="is-num">{s.n}</td>
                    <td className="is-num">{spanText(s.n * stepMs)}</td>
                    <td>{s.side === 'low' ? `Below ${fmtN(NARROW[0], 1)} Hz` : `Above ${fmtN(NARROW[1], 1)} Hz`}</td>
                    <td className="is-num">{fmtN(s.furthest.v, 3)}</td>
                    <td>{clockS(s.furthest.t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="gf-hint">
            A spell is a run of consecutive readings outside the band on one side; a missing reading ends it.{' '}
            {spells.length > longest.length ? `The ${longest.length} longest of ${spells.length} spells, longest first.` : 'Every spell in the window, longest first.'}
          </p>
        </>
      )}
      <h3 className="sf-sub">Missing readings</h3>
      {gaps.length === 0 ? (
        <p className="gf-hint">Every reading on the {stepText} clock is held in this window.</p>
      ) : (
        <>
          <ul className="sf-gaps">
            {gaps.slice(0, GAPS_SHOWN).map((g) => (
              <li key={g.start}>{gapText(g, stepMs, windowEnd)}</li>
            ))}
          </ul>
          <p className="gf-hint">
            {gaps.length > GAPS_SHOWN ? `The first ${GAPS_SHOWN} of ${gaps.length} runs of missing readings. ` : ''}
            These times are not held locally; the page doesn’t say whether Elexon published readings for them.
          </p>
        </>
      )}
    </>
  )
}
