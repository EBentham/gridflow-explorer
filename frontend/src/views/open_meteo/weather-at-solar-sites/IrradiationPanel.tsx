/**
 * The archive's working panel: each UK day of the window, the hours held,
 * each site's irradiation on the tilted panel (its hourly W/m² summed over
 * the day, as kWh/m²), and GB solar generation's energy over the same day
 * (NESO's half-hourly MW, times half an hour, summed, as GWh). A reader can
 * set a sunny day at the sites against the output it came with. Only days
 * holding every step are totalled; a window read as bucket means gives each
 * site's highest mean instead, since means don't sum to a day's energy.
 */
import { plural } from '../../../design/format'
import { dayLabel } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { daySummaries } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { GTI, OUTPUT_KEY, SOLAR_MW, completeSum, halfHourly, hourly, kwhM2, seriesOf, siteLabel, sitesOf, totalsByDay } from './figures'

export function IrradiationPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const sites = sitesOf(model, GTI).filter((d) => d.count > 0)
  if (!model || !ctx.window || !sites.length) {
    return <p className="gf-hint">No tilted irradiance is held in this window, so there are no days to total.</p>
  }
  const window = ctx.window
  const summed = hourly(model)
  const perSite = sites.map((d) => ({ def: d, days: totalsByDay(model, window, d) }))
  const days = daySummaries(model, window)

  const rel = ctx.related[OUTPUT_KEY]
  const oModel = rel?.series ?? null
  const oDef = seriesOf(oModel, SOLAR_MW)
  const oSummed = Boolean(oModel && oDef && halfHourly(oModel))
  const oDays = oModel && oDef && oSummed ? totalsByDay(oModel, window, oDef) : null
  const unit = sites[0].unit

  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                {summed ? 'Hours, any site' : 'Means, any site'}
              </th>
              {sites.map((d) => (
                <th key={d.key} scope="col" className="is-num">
                  {siteLabel(d.group)}
                </th>
              ))}
              {oDef && (
                <th scope="col" className="is-num">
                  GB solar, GWh
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((day) => {
              const o = oDays?.get(day.start)
              // GW back to energy: each half-hour's GW times half an hour, on days holding every half-hour.
              const oSum = completeSum(o)
              const gwh = oSum === null ? null : oSum * 0.5
              if (day.held === 0 && !o?.held) {
                return (
                  <tr key={day.day} className="is-missing">
                    <th scope="row">{dayLabel(day.start)}</th>
                    <td className="is-num">{day.expected === null ? '0' : `0 of ${day.expected}`}</td>
                    <td colSpan={sites.length + (oDef ? 1 : 0)}>not held locally</td>
                  </tr>
                )
              }
              const on = day.start === ctx.picked
              const partial = day.expected !== null && day.held < day.expected
              return (
                <tr key={day.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : day.start)}>
                      {dayLabel(day.start)}
                    </button>
                  </th>
                  <td className="is-num">{day.expected === null || !partial ? day.held : `${day.held} of ${day.expected}`}</td>
                  {perSite.map(({ def, days: totals }) => {
                    const t = totals.get(day.start)
                    if (summed) {
                      const s = completeSum(t)
                      return (
                        <td key={def.key} className="is-num">
                          {s === null ? '–' : kwhM2(s)}
                        </td>
                      )
                    }
                    return (
                      <td key={def.key} className="is-num">
                        {t?.peak ? unit.plain(t.peak.v) : '–'}
                      </td>
                    )
                  })}
                  {oDef &&
                    (gwh === null && o && o.held > 0 ? (
                      <td className="is-num is-flag">{o.expected === null ? `${o.held} held` : `${o.held} of ${o.expected}`}</td>
                    ) : (
                      <td className="is-num">{gwh === null ? '–' : gwh.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      {rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          GB solar generation could not be read beside it: <ErrorWords error={rel.error} />
        </p>
      )}
      <p className="gf-hint">
        {summed
          ? 'Each site’s figure is its tilted irradiance, kWh/m²: every hour stamped in the UK day, its mean W/m² counted for one hour, summed. Hours, any site counts the hours at least one site holds; a site short of any hour that day gets a dash, not a total.'
          : `The window is read as ${model.stepMs ? meansText(model.stepMs) : 'means'}, which don’t sum to a day’s irradiation, so each site’s figure is its highest mean that day, ${unit.label ?? 'unit unconfirmed'}. A shorter window reads the hours as held, and totals them.`}
        {oDef && (oSummed ? ' GB solar is NESO’s half-hourly generation, each half-hour’s MW times half an hour, summed over the UK day, on days holding every half-hour; a day held in part shows the half-hours it holds instead.' : ' GB solar generation comes back as means over this window, so its energy per day is not summed.')}
        {ctx.mode === 'chart' ? ' Select a day to mark it on the chart.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
