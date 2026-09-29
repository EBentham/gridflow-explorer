/**
 * The by-fuel working panel: every delivery day of the window, the issue
 * behind it and how many days ahead that was, each fuel band's forecast
 * usable output, and the total. A day holding fewer fuel codes than the
 * window's fullest day is flagged; a day with no forecast held says so.
 */
import { plural } from '../../../design/format'
import { fmtDay, instantLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { GW, bandsIn, daysAhead, daysOf, heldShape } from './figures'

const dash = '–'
const gw = (mw: number | null | undefined) => (mw === null || mw === undefined ? dash : GW.plain(mw * GW.factor))

export function FuelDays({ ctx }: { ctx: PageContext }) {
  const days = daysOf(ctx.response, ctx.window, 'code')
  if (!days.length || ctx.state === 'empty') return <p className="gf-hint">No delivery day in this window holds a forecast, so there is nothing to list.</p>
  const bands = bandsIn(days)
  const most = Math.max(...days.map((d) => d.held))
  const thin = days.filter((d) => d.held > 0 && d.held < most).length
  // Codes held per day only earns a column when some day holds fewer than another.
  const counts = thin > 0
  return (
    <>
      <div className="gf-days gf-av-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Delivery day</th>
              <th scope="col">Issued</th>
              <th scope="col" className="is-num">
                Ahead
              </th>
              {bands.map((b) => (
                <th key={b.key} scope="col" className="is-num">
                  {b.label}
                </th>
              ))}
              <th scope="col" className="is-num">
                Total, GW
              </th>
              {counts && (
                <th scope="col" className="is-num">
                  Codes
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const on = d.start === ctx.picked
              const partial = d.held > 0 && d.held < most
              const issued = d.issued.length ? d.issued[d.issued.length - 1] : null
              return (
                <tr key={d.date} className={on ? 'is-on' : d.held === 0 ? 'is-missing' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {fmtDay(d.date)}
                    </button>
                  </th>
                  <td>{d.held === 0 ? 'not held locally' : issued === null ? dash : `${instantLabel(issued)}${d.issued.length > 1 ? ', and earlier' : ''}`}</td>
                  <td className="is-num">{issued === null ? dash : daysAhead(d.date, issued)}</td>
                  {bands.map((b) => (
                    <td key={b.key} className="is-num">
                      {d.held === 0 ? dash : gw(d.bands.get(b.key)?.mw)}
                    </td>
                  ))}
                  <td className="is-num">{gw(d.total)}</td>
                  {counts && <td className={partial ? 'is-num is-flag' : 'is-num'}>{d.held === 0 ? dash : partial ? `${d.held} of ${most}` : d.held}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Each fuel in GW, summed over its codes held that day. Issued is the issue behind the day on the UK clock, and ahead counts whole UK days from it to the delivery day. {counts
          ? `Codes counts the fuel codes held; ${plural(thin, 'day holds', 'days hold')} fewer than the window’s fullest day, in bold, and ${thin === 1 ? 'its' : 'their'} totals leave the missing codes out.`
          : `Every day holding a forecast holds all ${most} fuel codes.`} {heldShape(days).held <= 1 ? '' : ctx.mode === 'chart' ? 'Select a day to mark it on the chart and read it in the key.' : 'Select a day to read it in the key.'}
      </p>
    </>
  )
}
