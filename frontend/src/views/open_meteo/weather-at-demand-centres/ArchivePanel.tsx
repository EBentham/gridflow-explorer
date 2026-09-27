/**
 * The hindcast's working panel. In the Chart view, the reanalysis
 * temperature at each city (`historical_demand`, read beside the hindcast)
 * on the main chart's clock, so the two can be read hour against hour. Then
 * each city: the hours both hold, the two means over those hours, the mean
 * difference and the widest one. The difference is between two after-the-
 * fact estimates of the same hours; it is not a forecast error, and the
 * panel says so.
 */
import { windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { periodName, seriesId } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { ARCHIVE_KEY, AXIS_WIDTH, TEMP, cityGaps, cityName, citySeries, cityStepsText } from './figures'

const signedText = (plain: string, v: number) => (v > 0 && plain !== '0.0' ? `+${plain}` : plain)

export function ArchivePanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const temps = citySeries(model, TEMP)
  if (!model || !ctx.window || !temps.length) {
    return <p className="gf-hint">No hindcast is held in this window, so there is nothing to set beside the reanalysis.</p>
  }
  const rel = ctx.related[ARCHIVE_KEY]
  const aModel = rel?.series ?? null
  const archive = citySeries(aModel, TEMP).filter((d) => d.count > 0)
  const unit = temps[0].unit
  const sameClock = aModel !== null && aModel.stepMs === model.stepMs && aModel.bucketed === model.bucketed
  const gaps = aModel && sameClock ? cityGaps(model, aModel) : []
  const both = gaps.reduce((n, g) => n + g.both, 0)
  const panel: ChartPanel | null =
    aModel && archive.length
      ? {
          rows: aModel.rows,
          series: archive,
          mark: 'line',
          unit: archive[0].unit,
          stepMs: aModel.stepMs,
          bucketed: aModel.bucketed,
          settlement: null,
          height: 220,
          axisWidth: AXIS_WIDTH,
        }
      : null
  const when = (t: number) => periodName(t, model.stepMs, null)
  // The key's focus names a hindcast series; draw the same city's reanalysis line alone.
  const focusGroup = temps.find((d) => seriesId(d) === ctx.focus)?.group
  const focusArchive = archive.find((d) => d.group === focusGroup)

  return (
    <>
      {ctx.mode === 'chart' && panel && (
        <SeriesChart
          panels={[panel]}
          domain={windowDomain(ctx.window.start, ctx.window.end)}
          focus={focusArchive ? seriesId(focusArchive) : undefined}
          picked={ctx.picked}
          onPick={ctx.pick}
          fixture={ctx.fixture}
        />
      )}
      {rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          The reanalysis could not be read: <ErrorWords error={rel.error} />
        </p>
      )}
      {rel && (rel.state === 'empty' || (rel.state === 'data' && !archive.length)) && <p className="gf-hint">No reanalysis temperature is held in this window, so there is nothing to compare.</p>}
      {aModel && !sameClock && archive.length > 0 && (
        <p className="gf-hint">The two datasets came back on different clocks in this window, so they are drawn but not compared hour by hour. A shorter window reads both at full detail.</p>
      )}
      {gaps.length > 0 && (
        <div className="gf-days">
          <table>
            <thead>
              <tr>
                <th scope="col">City</th>
                <th scope="col" className="is-num">
                  Hours both hold
                </th>
                <th scope="col" className="is-num">
                  Hindcast mean, {unit.label ?? 'unit unconfirmed'}
                </th>
                <th scope="col" className="is-num">
                  Reanalysis mean
                </th>
                <th scope="col" className="is-num">
                  Mean difference
                </th>
                <th scope="col" className="is-num">
                  Widest difference
                </th>
              </tr>
            </thead>
            <tbody>
              {gaps.map((g) => (
                <tr key={g.def.key} className={g.both === 0 ? 'is-missing' : undefined}>
                  <th scope="row">{cityName(g.def)}</th>
                  <td className="is-num">{g.both.toLocaleString('en-GB')}</td>
                  {g.both === 0 || g.hindcast === null || g.archive === null || g.diff === null ? (
                    <td colSpan={4}>no hour held by both</td>
                  ) : (
                    <>
                      <td className="is-num">{unit.plain(g.hindcast)}</td>
                      <td className="is-num">{unit.plain(g.archive)}</td>
                      <td className="is-num">{signedText(unit.plain(g.diff), g.diff)}</td>
                      <td className="is-num">{g.widest ? `${signedText(unit.plain(g.widest.v), g.widest.v)}, ${when(g.widest.t)}` : '–'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="gf-hint">
        {gaps.length > 0
          ? `Read at the ${cityStepsText(both, model)} that both datasets hold; an hour either lacks is left out, not filled. A difference is the hindcast less the reanalysis. `
          : ''}
        Both are estimates made after the hours had passed, so the difference shows how far two weather models disagree, not how far a forecast missed.
        {ctx.mode === 'chart' && panel ? ' Select a city in the key to draw it alone on both charts.' : ''}
      </p>
    </>
  )
}
