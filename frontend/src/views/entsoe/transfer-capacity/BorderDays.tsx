/**
 * The working panel: each UK day of the window on the selected border (or
 * the first), counted on the border's own step: the values held of those the
 * day fits, their mean, lowest and highest, and how many were zero; on GB's
 * borders, the mean of each measure read beside it. A day with nothing held
 * says so. Select a day to mark it on the chart.
 */
import { plural } from '../../../design/format'
import { dayLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { daysOf, heldDayStarts, heldText, isPartial } from './figures'
import { bordersOf, countStep, focusedBorder, measureOf } from './model'
import { figureText, stepWords } from './words'

export function BorderDays({ ctx }: { ctx: PageContext }) {
  const w = ctx.window
  const own = measureOf(ctx)
  const borders = bordersOf(ctx)
  const b = focusedBorder(ctx, borders)
  if (!w || !b) return <p className="gf-hint">{own.whenSet ? 'No limit is held in this window, so there are no days to summarise.' : 'No border holds a value in this window, so there are no days to summarise.'}</p>
  const unit = b.own.def.unit
  const days = daysOf(b.own.points, countStep(own, b.own), w)
  const besides = b.beside.map((x) => ({ ...x, days: daysOf(x.line.points, countStep(x.measure, x.line), w) }))
  const fmt = (x: { v: number } | null) => (x ? figureText(unit, x.v, true) : '–')
  // The cells after Held: mean, lowest, highest and zeros, and a mean per measure beside.
  const rest = 4 + besides.length
  const anyHeld = heldDayStarts(borders.flatMap((x) => [x.own.points, ...x.beside.map((y) => y.line.points)]))
  const noneText = (start: number) => (anyHeld.has(start) ? `no ${own.whenSet ? 'limit' : 'value'} held on this border` : 'not held locally')

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
                Mean, {unit.label ?? 'unit unconfirmed'}
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
              {besides.map((x) => (
                <th key={x.measure.key} scope="col" className="is-num">
                  {x.measure.short}, mean
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => {
              const beside = besides.map((x) => x.days[i])
              if (d.held === 0 && beside.every((s) => !s.held)) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={rest}>{noneText(d.start)}</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              return (
                <tr key={d.day} className={on ? 'is-on' : !own.whenSet && (isPartial(d) || d.held === 0) ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.held === 0 && d.expected !== null ? `0 of ${d.expected}` : heldText(d)}</td>
                  <td className="is-num">{d.mean === null ? '–' : figureText(unit, d.mean, true)}</td>
                  <td className="is-num">{fmt(d.low)}</td>
                  <td className="is-num">{fmt(d.high)}</td>
                  <td className="is-num">{d.held ? d.zero.toLocaleString('en-GB') : '–'}</td>
                  {besides.map((x, j) => {
                    const s = beside[j]
                    return (
                      <td key={x.measure.key} className="is-num">
                        {s.mean === null ? '–' : figureText(x.line.def.unit, s.mean, true)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        {own.whenSet
          ? 'Held counts the limits published that day: a limit comes only when one is set, so there is no full day to count against. '
          : b.own.step === null
            ? `${b.name} holds too few values in this window to read its step, so Held counts them without a full day to count against. `
            : `Held counts the ${stepWords(b.own.step)} with a value, of those the day holds on ${b.name}’s own step; a day held in part is set in bold. `}
        Means are of the values held, each counted once.
        {besides.length ? ' A mean beside it is of that measure’s own values held that day on the same border.' : ''}
        {ctx.mode === 'chart' ? ' Select a day to mark it on the chart.' : ' Select a day to mark it.'}
        {borders.length > 1 ? ' Select a border in the key to read another.' : ''}
      </p>
    </>
  )
}
