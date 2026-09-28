/**
 * The model re-run's working panel. The forecast model's irradiance for past
 * days, fetched after them, set against the historical archive for the same
 * hours: first each site over the days both hold in full, then one site day
 * by day (the site selected in the key, else the first). The difference is
 * the re-run less the archive. When the rows were fetched is read from the
 * rows themselves, so the reader can see the fetch came after the days.
 *
 * Nothing here is a forecast made in advance, and the panel never calls it
 * one. Totals follow the archive panel's rule: hourly rows as held, summed
 * only over days holding every hour.
 */
import { plural } from '../../../design/format'
import { dayLabel, instantLabel, toMs } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { seriesId } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { ARCHIVE_KEY, GTI, completeSum, hourly, isoValues, kwhDiff, kwhM2, seriesOf, siteLabel, sitesOf, totalsByDay } from './figures'

export function RerunPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  const rerun = sitesOf(model, GTI).filter((d) => d.count > 0)
  if (!model || !window || !rerun.length) {
    return <p className="gf-hint">No re-run irradiance is held in this window, so there is nothing to set against the archive.</p>
  }
  const rel = ctx.related[ARCHIVE_KEY]
  const aModel = rel?.series ?? null
  // Fetch times a few microseconds apart read as one minute: list the distinct minutes.
  const fetched = [...new Set((ctx.response ? isoValues(ctx.response.rows, 'available_at') : []).map((iso) => instantLabel(toMs(iso), { year: true })))]
  const fetchedText =
    fetched.length === 0
      ? null
      : fetched.length === 1
        ? `The re-run’s rows in this window were fetched at ${fetched[0]}.`
        : `The re-run’s rows in this window were fetched at ${plural(fetched.length, 'time', 'different times')}, from ${fetched[0]} to ${fetched[fetched.length - 1]}.`

  if (!aModel || !(hourly(model) && hourly(aModel))) {
    return (
      <>
        {rel && (rel.state === 'error' || rel.state === 'refreshing') ? (
          <p className="gf-hint">
            The archive could not be read beside it: <ErrorWords error={rel.error} />
          </p>
        ) : (
          <p className="gf-hint">
            {aModel ? 'This window is read as means, which don’t sum to a day’s irradiation, so the re-run and the archive are not totalled. A shorter window reads the hours as held.' : 'The archive holds nothing for this window, so there is nothing to set the re-run against.'}
          </p>
        )}
        {fetchedText && <p className="gf-hint">{fetchedText}</p>}
      </>
    )
  }

  const pairs = rerun.map((d) => {
    const a = seriesOf(aModel, GTI, d.group)
    const r = totalsByDay(model, window, d)
    const ar = a ? totalsByDay(aModel, window, a) : null
    let days = 0
    let rSum = 0
    let aSum = 0
    for (const [start, rt] of r) {
      const x = completeSum(rt)
      const y = completeSum(ar?.get(start))
      if (x === null || y === null) continue
      days += 1
      rSum += x
      aSum += y
    }
    return { def: d, archive: a, r, ar, days, rSum, aSum }
  })

  const focusGroup = [...rerun, ...sitesOf(aModel, GTI)].find((d) => seriesId(d) === ctx.focus)?.group
  const one = pairs.find((p) => p.def.group === focusGroup) ?? pairs[0]

  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Site</th>
              <th scope="col" className="is-num">
                Days in both
              </th>
              <th scope="col" className="is-num">
                Re-run, kWh/m²
              </th>
              <th scope="col" className="is-num">
                Archive, kWh/m²
              </th>
              <th scope="col" className="is-num">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.def.key} className={p.days === 0 ? 'is-missing' : p === one ? 'is-on' : undefined}>
                <th scope="row">{siteLabel(p.def.group)}</th>
                <td className="is-num">{p.days}</td>
                <td className="is-num">{p.days ? kwhM2(p.rSum) : '–'}</td>
                <td className="is-num">{p.days ? kwhM2(p.aSum) : '–'}</td>
                <td className="is-num">{p.days ? kwhDiff(p.rSum - p.aSum) : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Tilted irradiance summed over the days of {ctx.windowText} that both hold in full, for each site. The difference is the re-run less the archive.
      </p>
      <p className="gf-hint">Day by day at {siteLabel(one.def.group)}, the site marked above:</p>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Re-run hours
              </th>
              <th scope="col" className="is-num">
                Re-run, kWh/m²
              </th>
              <th scope="col" className="is-num">
                Archive, kWh/m²
              </th>
              <th scope="col" className="is-num">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {[...one.r.values()].map((rt) => {
              const at = one.ar?.get(rt.start)
              const x = completeSum(rt)
              const y = completeSum(at)
              const on = rt.start === ctx.picked
              if (rt.held === 0 && !at?.held) {
                return (
                  <tr key={rt.start} className="is-missing">
                    <th scope="row">{dayLabel(rt.start)}</th>
                    <td className="is-num">{rt.expected === null ? '0' : `0 of ${rt.expected}`}</td>
                    <td colSpan={3}>not held locally</td>
                  </tr>
                )
              }
              const partial = rt.expected !== null && rt.held < rt.expected
              return (
                <tr key={rt.start} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : rt.start)}>
                      {dayLabel(rt.start)}
                    </button>
                  </th>
                  <td className="is-num">{rt.expected === null || !partial ? rt.held : `${rt.held} of ${rt.expected}`}</td>
                  <td className="is-num">{x === null ? '–' : kwhM2(x)}</td>
                  <td className="is-num">{y === null ? '–' : kwhM2(y)}</td>
                  <td className="is-num">{x === null || y === null ? '–' : kwhDiff(x - y)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {one.r.size > 8 && <p className="gf-hint">{plural(one.r.size, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Each figure is the hourly W/m² stamped in the UK day, each counted for one hour, summed; a day short of any hour gets a dash. Select a site in the key to read it day by day{ctx.mode === 'chart' ? ', and a day to mark it on the chart' : ''}.
      </p>
      {fetchedText && <p className="gf-hint">{fetchedText} Each fetch replaces the last, and no issue time is kept.</p>}
    </>
  )
}
