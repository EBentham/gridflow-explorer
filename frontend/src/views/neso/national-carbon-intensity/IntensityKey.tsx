/**
 * The key: the two lines with their latest values (select one to draw it
 * alone), the latest half-hour's NESO grade, the window's lowest, highest
 * and mean of each line over the half-hours it holds, and the grades the
 * strip draws with how many half-hours hold each. Every figure is read from
 * the rows; the means are of the half-hours held, unweighted.
 */
import './page.css'
import { listText, plural } from '../../../design/format'
import { stepNoun } from '../../../design/time'
import { SeriesKey } from '../../_template/panels'
import { extremesOf, latestValue, periodName } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { SeriesRowsResponse } from '../../contract'
import type { PageContext } from '../../define'
import { ACTUAL, COLORS, FORECAST, GRADES, gradeCounts, gradeOf, gradesByTime, seriesOf } from './figures'

export function IntensityKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const forecast = seriesOf(model, FORECAST)
  const actual = seriesOf(model, ACTUAL)
  if (!model || !forecast || !actual || (!forecast.count && !actual.count)) {
    return <p className="gf-hint">No carbon intensity is held in this window, so there is nothing to key.</p>
  }
  const step = model.stepMs
  const noun = model.bucketed && step ? meansText(step) : stepNoun(step)
  const when = (t: number) => periodName(t, step, model.settlement)
  const grades = gradesByTime(ctx.response as SeriesRowsResponse | null)
  const counts = gradeCounts(grades.values())
  const latestT = Math.max(latestValue(model, forecast)?.t ?? -Infinity, latestValue(model, actual)?.t ?? -Infinity)
  const latestGrade = Number.isFinite(latestT) ? grades.get(latestT) : undefined
  const unit = actual.unit
  const absent = GRADES.filter((g) => !counts.some((c) => c.value === g.value)).map((g) => g.label.toLowerCase())
  const lines = [actual, forecast].map((d) => ({ d, ex: extremesOf(model.rows, d) }))

  return (
    <>
      <SeriesKey ctx={ctx} />
      {latestGrade && (
        <dl className="gf-stats">
          <div>
            <dt>Latest index</dt>
            <dd>
              {gradeOf(latestGrade)?.label ?? latestGrade}
              <span className="gf-stat-when">{when(latestT)}</span>
            </dd>
          </div>
        </dl>
      )}
      <div className="gf-days is-tight nci-key-table">
        <table>
          <thead>
            <tr>
              <th scope="col">{unit.label ?? 'Unit unconfirmed'}</th>
              {lines.map(({ d }) => (
                <th key={d.key} scope="col" className="is-num">
                  {d.column === ACTUAL ? 'Estimate' : 'Forecast'}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(['low', 'high'] as const).map((k) => (
              <tr key={k}>
                <th scope="row">{k === 'low' ? 'Lowest' : 'Highest'}</th>
                {lines.map(({ d, ex }) => (
                  <td key={d.key} className="is-num">
                    {ex ? d.unit.plain(ex[k].v) : '–'}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">Mean</th>
              {lines.map(({ d }) => (
                <td key={d.key} className="is-num">
                  {d.mean === null ? '–' : d.unit.plain(d.mean)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Held</th>
              {lines.map(({ d }) => (
                <td key={d.key} className="is-num">
                  {d.count.toLocaleString('en-GB')}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Over the {noun} each holds in {ctx.windowText}; the mean is of those {noun}.
        {lines[0].ex ? ` The estimate was highest ${when(lines[0].ex.high.t)} and lowest ${when(lines[0].ex.low.t)}.` : ''}
      </p>
      {counts.length > 0 ? (
        <>
          <ul className="gf-key nci-grades">
            {counts.map((c) => {
              const g = gradeOf(c.value)
              return (
                <li key={c.value}>
                  <span className="nci-grade-swatch" style={{ background: COLORS.grade, opacity: g?.opacity ?? 0 }} aria-hidden="true" />
                  <span className="nci-grade-name">{g?.label ?? c.value}</span>
                  <span className="nci-grade-count">{plural(c.n, stepNoun(step).replace(/s$/, ''), stepNoun(step))}</span>
                </li>
              )
            })}
          </ul>
          <p className="gf-hint">
            {ctx.mode === 'chart' ? 'NESO’s index, as published with each half-hour: the strip over the chart.' : 'NESO’s index, as published with each half-hour: the table’s last column.'}
            {absent.length ? ` ${absent.length === 1 ? 'Its other grade' : 'Its other grades'}, ${listText(absent)}, ${absent.length === 1 ? 'isn’t' : 'aren’t'} held in this window.` : ''}
          </p>
        </>
      ) : (
        <p className="gf-hint">{model.bucketed ? 'The index isn’t keyed: a mean carries no grade.' : 'No half-hour held in this window carries NESO’s index.'}</p>
      )}
    </>
  )
}
