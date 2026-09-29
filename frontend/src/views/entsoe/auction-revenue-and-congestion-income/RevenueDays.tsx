/**
 * The working panel: each UK day of the window, with each border's hours
 * held, its revenue over them and its highest hour, then both borders
 * together on a day both hold. A day held in part is shaded and says how
 * many of its hours it holds; a day with nothing held says so. Select a day
 * to mark it on the chart.
 */
import { plural } from '../../../design/format'
import { clock, dayLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { bordersOf, dayTallies, heldText, isPartial, totalsReadable } from './figures'

export function RevenueDays({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const w = ctx.window
  const borders = bordersOf(model)
  if (!model || !w || !borders.length) return <p className="gf-hint">No border holds revenue in this window, so there are no days to total.</p>
  if (!totalsReadable(model)) return <p className="gf-hint">The rows came back as means, not each hour as published, so no day is totalled. A window of 30 days or fewer reads every hour.</p>
  const unit = borders[0].unit
  const perBorder = borders.map((d) => ({ def: d, days: dayTallies(model, d, w) }))
  const days = perBorder[0].days
  const two = borders.length > 1

  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Day
              </th>
              {perBorder.map(({ def }) => (
                <th key={def.key} scope="colgroup" colSpan={3}>
                  {def.label}
                </th>
              ))}
              {two && (
                <th scope="col" rowSpan={2} className="is-num">
                  Both, {unit.label}
                </th>
              )}
            </tr>
            <tr>
              {perBorder.map(({ def }) => [
                <th key={`${def.key}:h`} scope="col" className="is-num">
                  Hours
                </th>,
                <th key={`${def.key}:t`} scope="col" className="is-num">
                  Total, {unit.label}
                </th>,
                <th key={`${def.key}:x`} scope="col" className="is-num">
                  Highest hour
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {days.map((d, i) => {
              const cells = perBorder.map((b) => b.days[i])
              if (cells.every((c) => c.held === 0)) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td colSpan={cells.length * 3 + (two ? 1 : 0)}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = cells.some((c) => isPartial(c) || c.held === 0)
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  {cells.map((c, j) => [
                    <td key={`${j}:h`} className="is-num">
                      {c.held === 0 && c.expected !== null ? `0 of ${c.expected}` : heldText(c)}
                    </td>,
                    <td key={`${j}:t`} className="is-num">
                      {c.held ? unit.plain(c.total) : '–'}
                    </td>,
                    <td key={`${j}:x`} className="is-num">
                      {!c.high ? '–' : c.high.v === 0 ? 'all at 0' : `${unit.plain(c.high.v)} at ${clock(c.high.t)}`}
                    </td>,
                  ])}
                  {two && <td className="is-num">{cells.every((c) => c.held > 0) ? unit.plain(cells.reduce((s, c) => s + c.total, 0)) : '–'}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Each total adds up the hours held that UK day; a shaded day holds only some of its hours, so its total is of those alone.{two ? ' Both borders are added up only on a day both hold.' : ''} ENTSO-E’s
        days run midnight to midnight Central European time, 23:00 to 23:00 on the UK clock, so a UK day’s total isn’t the total of ENTSO-E’s day.
      </p>
    </>
  )
}
