/**
 * The by-fuel side panel: the key's delivery day code by code, as Elexon
 * lists them, in stack order: each code with the fuel it folds into and its
 * forecast usable output in MW. The interconnectors are listed one link at a
 * time, by Elexon's code.
 */
import { fmtDay } from '../../../design/time'
import type { PageContext } from '../../define'
import { MW, bandOf, codeName, daysOf, keyDay } from './figures'

export function FuelCodes({ ctx }: { ctx: PageContext }) {
  const days = daysOf(ctx.response, ctx.window, 'code')
  const day = keyDay(ctx, days)
  if (ctx.state === 'empty' || !day) return <p className="gf-hint">No forecast is held for any delivery day in this window, so there are no codes to list.</p>
  const codes = [...day.items.entries()].sort(([a], [b]) => bandOf(a).order - bandOf(b).order || a.localeCompare(b))
  return (
    <>
      <div className="gf-days is-tight gf-av-codes">
        <table>
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Fuel</th>
              <th scope="col" className="is-num">
                {MW.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {codes.map(([code, mw]) => (
              <tr key={code}>
                <th scope="row">
                  <code>{code}</code>
                </th>
                <td>{codeName(code)}</td>
                <td className="is-num">{MW.plain(mw)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        {fmtDay(day.date)}, {codes.length} codes, bottom of the stack first. Each interconnector is one link, named by Elexon’s code for it.
      </p>
    </>
  )
}
