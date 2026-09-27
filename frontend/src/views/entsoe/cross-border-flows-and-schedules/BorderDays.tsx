/**
 * The working panel of the flows and the schedules: each UK day of the
 * window on the selected border (or the first), counted on the border's own
 * step: the values held of those the day fits, their mean, lowest and
 * highest, and how many were zero; on GB's borders, the other dataset's
 * values held and mean beside them. A day with nothing held says so. Select
 * a day to mark it on the chart.
 */
import { plural } from '../../../design/format'
import { dayLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { daysOf, heldText, isPartial } from './figures'
import { bordersOf, focusedBorder, roleOf } from './model'
import { stepWords } from './words'

const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`

export function BorderDays({ ctx }: { ctx: PageContext }) {
  const w = ctx.window
  const role = roleOf(ctx)
  const borders = bordersOf(ctx)
  const b = focusedBorder(ctx, borders)
  if (!w || !b?.own) return <p className="gf-hint">No border holds a value in this window, so there are no days to summarise.</p>
  const unit = b.own.def.unit
  const days = daysOf(b.own.points, b.own.step, w)
  const besideDays = b.beside ? daysOf(b.beside.points, b.beside.step, w) : null
  const besideUnit = b.beside?.def.unit
  const fmt = (x: { v: number } | null) => (x ? unit.plain(x.v) : '–')
  // The cells after Held: mean, lowest, highest and zeros, and the two beside.
  const rest = besideDays ? 6 : 4

  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Mean, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Lowest
              </th>
              <th scope="col" className="is-num">
                Highest
              </th>
              <th scope="col" className="is-num">
                At zero
              </th>
              {besideDays && (
                <>
                  <th scope="col" className="is-num">
                    {cap(role.beside)}, held
                  </th>
                  <th scope="col" className="is-num">
                    {cap(role.beside)}, mean
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => {
              const s = besideDays?.[i]
              if (d.held === 0 && !s?.held) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={rest}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              return (
                <tr key={d.day} className={on ? 'is-on' : isPartial(d) || d.held === 0 ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.held === 0 && d.expected !== null ? `0 of ${d.expected}` : heldText(d)}</td>
                  <td className="is-num">{d.mean === null ? '–' : unit.plain(d.mean)}</td>
                  <td className="is-num">{fmt(d.low)}</td>
                  <td className="is-num">{fmt(d.high)}</td>
                  <td className="is-num">{d.held ? d.zero.toLocaleString('en-GB') : '–'}</td>
                  {s && (
                    <>
                      <td className="is-num">{s.held ? heldText(s) : s.expected === null ? '0' : `0 of ${s.expected}`}</td>
                      <td className="is-num">{s.mean === null || !besideUnit ? '–' : besideUnit.plain(s.mean)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {stepWords(b.own.step)} with a value, of those the day holds on {b.name}’s own step; a day held in part is set in bold. Means are of the values held, each counted once.
        {besideDays ? ` The ${role.beside} is counted on its own step, on the same border.` : ''}
        {ctx.mode === 'chart' ? ' Select a day to mark it on the chart.' : ' Select a day to mark it.'}
        {borders.length > 1 ? ' Select a border in the key to read another.' : ''}
      </p>
    </>
  )
}
