/**
 * The wind and solar forecast's working panel: the zone's wind and solar
 * forecast, summed, set against its total generation forecast. In the Chart
 * view, the two as lines on one axis and the total less wind and solar as
 * bars under them, on the main chart's clock. Then the window in a sentence,
 * and each UK day: the mean forecast of each, and the total less wind and
 * solar. Everything is read at the steps both hold, on the coarser of the
 * two clocks; a step either lacks is a gap. The two are separate ENTSO-E
 * forecasts: where wind and solar come out above the total, those steps are
 * counted, never clipped.
 */
import type { ReactNode } from 'react'
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { dayLabel, londonMidnight, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import type { SeriesDef, WideRow } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, markGaps, perText, pointsOf, statsOf, stepWords, trackDays, type Point } from './figures'
import { windSolarOf } from './windSolar'

const dash = '–'
const AVG = 'A series held more often is averaged into each longer step it holds in full.'
const MEASURE = { total: 'var(--chart-actual)', sum: 'var(--chart-fan)', diff: 'var(--fuel-other)' } as const

function meanOf(points: Point[]): number | null {
  return points.length ? points.reduce((s, p) => s + p.v, 0) / points.length : null
}

export function WindSolarPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  const ws = windSolarOf(ctx)
  if (!model || !window || !ws || !ws.held.length) {
    return <p className="gf-hint">No wind or solar forecast is held for this zone in this window, so there is nothing to set against the total.</p>
  }
  const zone = ws.zone
  const unit = ws.held[0].def.unit
  const plain = (v: number | null) => (v === null ? dash : unit.plain(v))
  const read = ws.totalRead
  const failed = read && (read.state === 'error' || read.state === 'refreshing')
  const pair = ws.pair
  const both = pair?.both ?? []
  const noun = stepWords(pair?.step ?? null, ws.bucketed)

  let lead: ReactNode = null
  if (failed) {
    lead = (
      <p className="gf-hint">
        The total generation forecast could not be read beside it, so there is nothing to set wind and solar against: <ErrorWords error={read.error} />
      </p>
    )
  } else if (!ws.total) {
    lead = <p className="gf-hint">No total generation forecast is held for {zone.prose} in this window, so the days below give wind and solar alone.</p>
  } else if (!pair) {
    lead = <p className="gf-hint">The total and the wind and solar forecast come on clocks that don’t nest in this window, so they are not set against each other. Choose a shorter window.</p>
  } else if (!both.length) {
    lead = <p className="gf-hint">{zone.label} holds no step with both the total and every wind and solar type in this window, so there is nothing to set against each other.</p>
  }

  let chart: ReactNode = null
  if (ctx.mode === 'chart' && pair && both.length && ws.total) {
    const base: SeriesDef = ws.total.def
    const def = (key: string, label: string, color: string): SeriesDef => ({ ...base, key, field: key, label, color, from: key })
    const domain = windowDomain(window.start, window.end)
    const lines = [def('a', `Total generation forecast`, MEASURE.total), def('b', 'Wind and solar forecast', MEASURE.sum)]
    const bars = [def('d', 'Total less wind and solar', MEASURE.diff)]
    const wide: WideRow[] = pair.rows.map((r) => ({ t: r.t, a: r.a, b: r.b, d: r.d }))
    const rows = markGaps(
      wide,
      [...lines, ...bars].map((d) => ({ def: d, step: pair.step, points: pointsOf(wide, d) })),
      domain,
    )
    const panels: ChartPanel[] = [
      { rows, series: lines, mark: 'line', unit, stepMs: pair.step, bucketed: ws.bucketed, height: 200, axisWidth: AXIS_WIDTH },
      { rows, series: bars, mark: 'bars', unit, stepMs: pair.step, bucketed: ws.bucketed, height: 130, zero: true, axisWidth: AXIS_WIDTH },
    ]
    chart = (
      <>
        <KeyList
          items={[
            { key: 'a', mark: { kind: 'line', color: MEASURE.total, dashed: ctx.fixture }, label: `${zone.label}, total generation forecast, ${unit.label}` },
            { key: 'b', mark: { kind: 'line', color: MEASURE.sum, dashed: ctx.fixture }, label: `${zone.label}, wind and solar forecast, ${unit.label}` },
            { key: 'd', mark: { kind: 'bars', color: MEASURE.diff, shape: 'rise' }, label: `Total less wind and solar, ${unit.label}, lower chart` },
          ]}
        />
        <SeriesChart panels={panels} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      </>
    )
  }

  const diff = statsOf(both)
  const above = both.filter((p) => p.v < 0).length
  const sumMean = meanOf(pair ? pair.rows.flatMap((r) => (r.a !== null && r.b !== null ? [{ t: r.t, v: r.b }] : [])) : [])
  const totalMean = meanOf(pair ? pair.rows.flatMap((r) => (r.a !== null && r.b !== null ? [{ t: r.t, v: r.a }] : [])) : [])
  const summary =
    both.length > 0 && diff.low && diff.high && sumMean !== null && totalMean !== null ? (
      <p className="gf-hint">
        At the {plural(both.length, noun.replace(/s$/, ''), noun)} both hold, {zone.prose}’s wind and solar forecast averaged {unit.format(sumMean)} against a total of {unit.format(totalMean)}. The total less wind and solar ran from {unit.format(diff.low.v)} to {unit.format(diff.high.v)}.
        {above > 0 ? ` At ${plural(above, noun.replace(/s$/, ''), noun)} the wind and solar forecast is the larger of the two, so the difference is below zero there.` : ''}
      </p>
    ) : null

  const days = trackDays(ws.sum?.points ?? [], ws.sum?.step ?? null, window, ws.bucketed)
  const dayOf = (points: Point[] | undefined, start: number) => (points ?? []).filter((p) => londonMidnight(p.t) === start)
  const firstHeld = days.findIndex((d) => d.held > 0)
  const lead0 = firstHeld === -1 ? 0 : firstHeld
  const shown = lead0 >= 2 ? days.slice(lead0) : days

  return (
    <>
      {lead}
      {chart}
      {summary}
      <p className="gf-hint">{zone.label}, each UK day:</p>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held, all types
              </th>
              <th scope="col" className="is-num">
                Mean wind, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Mean solar, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Mean total, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Total less wind and solar, mean, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Wind and solar above total
              </th>
            </tr>
          </thead>
          <tbody>
            {lead0 >= 2 && (
              <tr className="is-missing">
                <th scope="row">
                  {dayLabel(days[0].start)} – {dayLabel(days[lead0 - 1].start)}
                </th>
                <td className="is-num">0</td>
                <td colSpan={5}>not held locally, {plural(lead0, 'day', 'days')}</td>
              </tr>
            )}
            {shown.map((d) => {
              const wind = dayOf(ws.wind?.points, d.start)
              const solar = dayOf(ws.solar?.points, d.start)
              const total = dayOf(ws.total?.points, d.start)
              const bothDay = dayOf(both, d.start)
              if (d.held === 0 && !wind.length && !solar.length && !total.length) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={5}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.expected === null || !partial ? d.held : `${d.held} of ${d.expected}`}</td>
                  <td className="is-num">{plain(meanOf(wind))}</td>
                  <td className="is-num">{plain(meanOf(solar))}</td>
                  <td className="is-num">{plain(meanOf(total))}</td>
                  <td className="is-num">{plain(meanOf(bothDay))}</td>
                  <td className="is-num">{bothDay.length ? bothDay.filter((p) => p.v < 0).length : dash}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {stepWords(ws.sum?.step ?? null, ws.bucketed)} with a forecast for every type {zone.prose} holds. Each mean is over the steps that series holds that day; the difference, and the count above the total, over the steps both hold. {zone.label}’s wind and solar come {perText(ws.sum?.step ?? null, ws.bucketed)}
        {ws.total ? `, its total ${perText(ws.total.step, ws.bucketed)}` : ''}.{ws.total && ws.sum && ws.total.step !== ws.sum.step ? ` ${AVG}` : ''} The total is a separate ENTSO-E forecast, and the rows don’t say whether it counts the same wind and solar, so the difference is not a forecast of any other kind of plant.
        {ctx.mode === 'chart' ? ' Select a day to mark it on every chart.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
