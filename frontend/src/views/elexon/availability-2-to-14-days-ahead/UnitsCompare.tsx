/**
 * The by-unit side panel: the key's delivery day fuel by fuel, the units'
 * sum set against Elexon's own by-fuel figure, and the difference in MW
 * where both hold one, with the issue behind each side. The two forecasts
 * are issued apart, so a difference can be the issue as much as a unit left
 * off the list.
 */
import { fmtDay, instantLabel } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import type { PageContext } from '../../define'
import { FUEL_KEY, GW, compareDay, daysOf, issuedRange, keyDay, signedPlain, unitShown } from './figures'

const gw = (mw: number | null) => (mw === null ? '–' : GW.plain(mw * GW.factor))

export function UnitsCompare({ ctx }: { ctx: PageContext }) {
  const rel = ctx.related[FUEL_KEY]
  const days = daysOf(ctx.response, ctx.window, 'unit')
  const day = keyDay(ctx, days)
  if (ctx.state === 'empty' || !day) return <p className="gf-hint">No unit is listed for any delivery day in this window, so there is nothing to set against the by-fuel figure.</p>
  if (rel && (rel.state === 'error' || rel.state === 'refreshing')) {
    return (
      <p className="gf-hint">
        Elexon’s by-fuel forecast couldn’t be read, so the units aren’t set against it. <ErrorWords error={rel.error} />
      </p>
    )
  }
  const fuelDay = daysOf(rel?.response, ctx.window, 'code').find((d) => d.date === day.date)
  if (!fuelDay || fuelDay.held === 0) return <p className="gf-hint">Elexon’s by-fuel forecast holds nothing for {fmtDay(day.date)}, so there is nothing to set the units against.</p>
  const rows = compareDay(day, fuelDay)
  const one = unitShown(ctx)
  return (
    <>
      <div className="gf-days is-tight gf-av-compare">
        <table>
          <thead>
            <tr>
              <th scope="col">Fuel</th>
              <th scope="col" className="is-num">
                Units
                <br />
                GW
              </th>
              <th scope="col" className="is-num">
                By fuel
                <br />
                GW
              </th>
              <th scope="col" className="is-num">
                Less
                <br />
                MW
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.band.key} className={one && one.band.key === r.band.key ? 'is-on' : undefined}>
                <th scope="row">{r.band.label}</th>
                <td className="is-num">{gw(r.units)}</td>
                <td className="is-num">{gw(r.fuel)}</td>
                <td className="is-num">{r.diff === null ? '–' : signedPlain(r.diff)}</td>
              </tr>
            ))}
            {day.total !== null && fuelDay.total !== null && (
              <tr className="gf-av-sum">
                <th scope="row">Total</th>
                <td className="is-num">{gw(day.total)}</td>
                <td className="is-num">{gw(fuelDay.total)}</td>
                <td className="is-num">{signedPlain(day.total - fuelDay.total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        {fmtDay(day.date)}, in GW: the units listing each fuel summed, and Elexon’s by-fuel figure; then the units less the figure, in MW. The units were issued {issuedRange(day.issued, instantLabel)}, the by-fuel figure {issuedRange(fuelDay.issued, instantLabel)}.
        {one ? ` The row of ${one.id}’s fuel is marked.` : ''}
      </p>
    </>
  )
}
