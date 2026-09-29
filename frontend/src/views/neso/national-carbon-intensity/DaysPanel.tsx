/**
 * The working panel: the forecast set against NESO's own estimate. In the
 * Chart view, the estimate less the forecast per half-hour as bars, on the
 * main chart's clock; a half-hour missing either is a gap, never a zero.
 * Then every UK day of the window: the half-hours held, the day's mean
 * forecast and mean estimate, the mean and mean absolute difference over the
 * half-hours holding both, and how many half-hours NESO graded each way.
 * A day held in part is summarised in part, and says so in its Held column.
 */
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { dayLabel, stepNoun, stepsInDay, windowDomain } from '../../../design/time'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { periodName, type SeriesDef } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { SeriesRowsResponse } from '../../contract'
import type { PageContext } from '../../define'
import { ACTUAL, AXIS_WIDTH, COLORS, FORECAST, GRADES, dayFigures, gradeOf, gradesByTime, missRows, seriesOf, signed } from './figures'

const dash = '–'
const MISS = 'miss'

export function DaysPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const forecast = seriesOf(model, FORECAST)
  const actual = seriesOf(model, ACTUAL)
  if (!model || !ctx.window || !forecast || !actual || (!forecast.count && !actual.count)) {
    return <p className="gf-hint">No carbon intensity is held in this window, so there are no days to compare.</p>
  }
  const step = model.stepMs
  const noun = model.bucketed && step ? meansText(step) : stepNoun(step)
  const one = noun.replace(/s$/, '')
  const unit = actual.unit
  const rows = missRows(model, forecast, actual, MISS)
  const missDef: SeriesDef = { ...actual, key: MISS, field: MISS, label: 'Estimate less forecast', color: COLORS.miss, from: MISS }
  let above: { t: number; v: number } | null = null
  let below: { t: number; v: number } | null = null
  for (const r of rows) {
    const v = r[MISS]
    if (typeof v !== 'number') continue
    if (v > 0 && (!above || v > above.v)) above = { t: r.t, v }
    if (v < 0 && (!below || v < below.v)) below = { t: r.t, v }
  }
  const panels: ChartPanel[] = [
    { rows, series: [missDef], mark: 'bars', unit, stepMs: step, bucketed: model.bucketed, settlement: model.settlement, height: 170, zero: true, axisWidth: AXIS_WIDTH },
  ]
  const grades = gradesByTime(ctx.response as SeriesRowsResponse | null)
  const days = dayFigures(model, ctx.window, forecast, actual, grades)
  const gradeCols = GRADES.filter((g) => days.some((d) => d.grades.has(g.value)))
  const otherGrades = [...new Set(days.flatMap((d) => [...d.grades.keys()]))].filter((v) => !gradeOf(v))
  const cols = [...gradeCols.map((g) => ({ value: g.value, label: g.label })), ...otherGrades.map((v) => ({ value: v, label: v }))]
  // A long window opening on days not fetched lists them as one row, so the held days aren't below the fold.
  const firstHeld = days.findIndex((d) => d.forecastHeld + d.actualHeld > 0)
  const lead = firstHeld === -1 ? 0 : firstHeld
  const shown = lead >= 2 ? days.slice(lead) : days
  const span = 5 + cols.length
  const fmt = (v: number | null) => (v === null ? dash : unit.plain(v))
  const anyBoth = days.some((d) => d.bothHeld > 0)

  return (
    <>
      {ctx.mode === 'chart' && anyBoth && (
        <>
          <KeyList items={[{ key: MISS, mark: { kind: 'bars', color: COLORS.miss, shape: 'rise' }, label: `Estimated actual less forecast, ${unit.label ?? 'unit unconfirmed'}` }]} />
          <SeriesChart panels={panels} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
        </>
      )}
      {(above || below) && (
        <p className="gf-hint">
          {above ? `The estimate ran furthest above the forecast at ${periodName(above.t, step, model.settlement)}, by ${signed(above.v)} ${unit.label ?? ''}` : ''}
          {above && below ? '; ' : ''}
          {below ? `${above ? 'furthest' : 'The estimate ran furthest'} below it at ${periodName(below.t, step, model.settlement)}, by ${signed(below.v)} ${unit.label ?? ''}` : ''}.
        </p>
      )}
      {!anyBoth && <p className="gf-hint">No {one} in this window holds both a forecast and an estimate, so there is no difference to show.</p>}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Forecast, mean
              </th>
              <th scope="col" className="is-num">
                Actual, mean
              </th>
              <th scope="col" className="is-num">
                Actual less forecast, mean
              </th>
              <th scope="col" className="is-num">
                Mean absolute difference
              </th>
              {cols.map((c) => (
                <th key={c.value} scope="col" className="is-num">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lead >= 2 && (
              <tr className="is-missing">
                <th scope="row">
                  {dayLabel(days[0].start)} – {dayLabel(days[lead - 1].start)}
                </th>
                <td className="is-num">0</td>
                <td colSpan={span - 1}>not held locally, {plural(lead, 'day', 'days')}</td>
              </tr>
            )}
            {shown.map((d) => {
              const expected = model.bucketed ? null : stepsInDay(d.start, step)
              const held = Math.max(d.forecastHeld, d.actualHeld)
              if (held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{expected === null ? '0' : `0 of ${expected}`}</td>
                    <td colSpan={span - 1}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = expected !== null && held < expected
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{expected === null || !partial ? held : `${held} of ${expected}`}</td>
                  <td className="is-num">{fmt(d.forecastMean)}</td>
                  <td className="is-num">{d.actualHeld < d.forecastHeld && d.actualMean !== null ? `${fmt(d.actualMean)}, over ${d.actualHeld}` : fmt(d.actualMean)}</td>
                  <td className="is-num">{d.missMean === null ? dash : signed(d.missMean)}</td>
                  <td className="is-num">{fmt(d.missAbsMean)}</td>
                  {cols.map((c) => (
                    <td key={c.value} className="is-num">
                      {d.grades.get(c.value) ?? dash}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        In {unit.label ?? 'the unit as published'}. Held counts the {noun} held, so a day held in part is summarised in part. The differences are the estimated actual less the forecast, over the {noun} holding both: above zero, the estimate came in higher.
        {cols.length > 0 ? ` The last ${cols.length === 1 ? 'column counts the' : `${cols.length} columns count the`} ${noun} NESO graded each way.` : ''}
        {model.bucketed ? ` This window is read as ${noun}, so the differences are between means, and a mean carries no grade.` : ''}
        {ctx.mode === 'chart' ? ' Select a day to mark it on both charts.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
