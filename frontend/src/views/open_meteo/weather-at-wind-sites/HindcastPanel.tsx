/**
 * The hindcast's working panel: the forecast model's rerun of each hour set
 * against the reanalysis of the same hour, at 100 m (the mean of the sites,
 * or the site picked in the key). In the Chart view, both as lines on the
 * main chart's clock; then each UK day: the hours both hold, each one's
 * mean, and the mean difference. Hours only one holds are left out of the
 * comparison, never filled.
 */
import { plural } from '../../../design/format'
import { dayLabel, stepNoun, windowDomain } from '../../../design/time'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { ErrorWords } from '../../_template/panels'
import type { WideRow } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { REANALYSIS_KEY, focusedSite, heldSites, madeSeries, speedByDay, speedPoints, statsOf, type Point } from './figures'

const HIND = 'hind'
const REAN = 'rean'

export function HindcastPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const sites = heldSites(model)
  if (!model || !ctx.window || !sites.length) {
    return <p className="gf-hint">No wind speed is held at any site in this window, so there is nothing to compare or summarise by day.</p>
  }
  const rel = ctx.related[REANALYSIS_KEY]
  const rean = rel?.series ?? null
  const unit = sites[0].unit
  const site = focusedSite(ctx, model)
  const who = site ? site.label : 'the mean of the sites'
  const hind = speedPoints(model, site)
  const reanSite = site && rean ? heldSites(rean).find((d) => d.group === site.group) : undefined
  const reanPoints = rean ? (site ? (reanSite ? speedPoints(rean, reanSite) : []) : speedPoints(rean)) : []
  const sameClock = rean !== null && rean.stepMs === model.stepMs && rean.bucketed === model.bucketed
  const reanAt = new Map(reanPoints.map((p) => [p.t, p.v]))
  const diffs: Point[] = sameClock ? hind.flatMap((p) => (reanAt.has(p.t) ? [{ t: p.t, v: p.v - (reanAt.get(p.t) ?? 0) }] : [])) : []
  const abs = statsOf(diffs.map((d) => ({ t: d.t, v: Math.abs(d.v) })))
  const diff = statsOf(diffs)
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)

  const hindDays = speedByDay(model, ctx.window, hind)
  const pairedHind = hind.filter((p) => reanAt.has(p.t))
  const hindTimes = new Set(hind.map((p) => p.t))
  const pairedRean = sameClock ? reanPoints.filter((p) => hindTimes.has(p.t)) : []
  const hDays = speedByDay(model, ctx.window, pairedHind)
  const rDays = speedByDay(model, ctx.window, pairedRean)
  const dDays = speedByDay(model, ctx.window, diffs)

  let chart = null
  if (ctx.mode === 'chart' && sameClock && (hind.length || reanPoints.length)) {
    const rowsAt = new Map<number, WideRow>()
    for (const r of model.rows) rowsAt.set(r.t, { t: r.t, [HIND]: null, [REAN]: null })
    for (const r of rean.rows) if (!rowsAt.has(r.t)) rowsAt.set(r.t, { t: r.t, [HIND]: null, [REAN]: null })
    for (const p of hind) (rowsAt.get(p.t) as WideRow)[HIND] = p.v
    for (const p of reanPoints) (rowsAt.get(p.t) as WideRow)[REAN] = p.v
    const rows = [...rowsAt.values()].sort((a, b) => a.t - b.t)
    const series = [
      madeSeries(sites[0], HIND, site ? `${site.label}, hindcast` : 'Hindcast, mean of the sites', 'var(--chart-fan)', hind),
      madeSeries(sites[0], REAN, site ? `${site.label}, reanalysis` : 'Reanalysis, mean of the sites', 'var(--chart-actual)', reanPoints),
    ]
    const panel: ChartPanel = { rows, series, mark: 'line', unit, stepMs: model.stepMs, bucketed: model.bucketed, height: 220 }
    chart = <SeriesChart panels={[panel]} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
  }

  let note = null
  if (!rel) note = null
  else if (rel.state === 'error' || rel.state === 'refreshing') {
    note = (
      <p className="gf-hint">
        The reanalysis couldn’t be read, so there is nothing to compare with. <ErrorWords error={rel.error} />
      </p>
    )
  } else if (!reanPoints.length) note = <p className="gf-hint">The reanalysis holds no speed for {who} in this window, so there is nothing to compare with.</p>
  else if (!sameClock) note = <p className="gf-hint">The reanalysis comes back on another clock than the hindcast in this window, so the two aren’t compared. Try a shorter window.</p>

  return (
    <>
      {chart}
      {note}
      {diffs.length > 0 && diff.mean !== null && abs.mean !== null && (
        <p className="gf-hint">
          Over the {plural(diffs.length, noun.replace(/s$/, ''), noun)} both hold, the hindcast of {who} runs {unit.format(Math.abs(diff.mean))} {diff.mean >= 0 ? 'above' : 'below'} the reanalysis on average, and {unit.format(abs.mean)} apart on average either way.
        </p>
      )}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Both held
              </th>
              <th scope="col" className="is-num">
                Hindcast, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Reanalysis
              </th>
              <th scope="col" className="is-num">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {hindDays.map((d, i) => {
              const both = dDays[i].speed.count
              if (d.speed.count === 0 && both === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={3}>no hindcast held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && both < d.expected
              const m = (x: number | null) => (x === null ? '–' : unit.plain(x))
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.expected === null || !partial ? both : `${both} of ${d.expected}`}</td>
                  <td className="is-num">{m(hDays[i].speed.mean)}</td>
                  <td className="is-num">{m(rDays[i].speed.mean)}</td>
                  <td className="is-num">{m(dDays[i].speed.mean)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {hindDays.length > 8 && <p className="gf-hint">{plural(hindDays.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Means of {who} over the {noun} both hold that day. Difference is the hindcast less the reanalysis.{' '}
        {ctx.mode === 'chart' ? 'Select a day to mark it on both charts.' : 'Select a day to mark it.'}
      </p>
    </>
  )
}
