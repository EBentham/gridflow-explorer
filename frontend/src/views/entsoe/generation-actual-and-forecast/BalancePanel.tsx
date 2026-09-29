/**
 * The total generation forecast's working panel: forecast generation against
 * forecast load, both made the day before. In the Chart view, one zone's two
 * forecasts on one axis, with generation less load as bars under them, on
 * the main chart's clock. Then every zone over the window, and the zone's UK
 * days. The zone is the one selected in the key, else the first; a zone's row
 * in the table selects it too. Every figure is read at the steps both hold,
 * on the coarser of the two clocks (Belgium's hourly generation forecast
 * against the mean of its four quarter-hours of load, where all four are
 * held); a step either lacks is a gap.
 */
import type { ReactNode } from 'react'
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { dayLabel, londonMidnight, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { seriesId, type SeriesDef, type WideRow } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, LOAD_KEY, markGaps, perText, pointsOf, statsOf, stepWords, trackDays, type Point } from './figures'
import { zoneForecasts, zoneInView, type ZoneForecast } from './total'

const dash = '–'
const AVG = 'A series held more often is averaged into each longer step it holds in full.'
/** Generation takes its zone's own colour, as in the chart above; load and the difference take tokens no zone line uses, in either theme. */
const MEASURE = { load: 'var(--fuel-imports)', diff: 'var(--fuel-other)' } as const

const meanOf = (points: Point[]) => (points.length ? points.reduce((s, p) => s + p.v, 0) / points.length : null)

function ZoneTable({ ctx, zones, current }: { ctx: PageContext; zones: ZoneForecast[]; current: ZoneForecast }) {
  const unit = current.gen?.def.unit
  const plain = (v: number | null) => (v === null || !unit ? dash : unit.plain(v))
  return (
    <div className="gf-days">
      <table>
        <thead>
          <tr>
            <th scope="col">Zone</th>
            <th scope="col" className="is-num">
              Held by both
            </th>
            <th scope="col" className="is-num">
              Mean generation forecast, {unit?.label}
            </th>
            <th scope="col" className="is-num">
              Mean load forecast, {unit?.label}
            </th>
            <th scope="col" className="is-num">
              Generation less load, mean, {unit?.label}
            </th>
            <th scope="col" className="is-num">
              Below zero
            </th>
          </tr>
        </thead>
        <tbody>
          {zones.map((z) => {
            const on = z === current
            if (!z.gen) {
              return (
                <tr key={z.zone.value} className="is-missing">
                  <th scope="row">{z.zone.label}</th>
                  <td className="is-num">0</td>
                  <td colSpan={4}>no generation forecast held in this window</td>
                </tr>
              )
            }
            const id = seriesId(z.gen.def)
            const both = z.pair?.both ?? []
            const genMean = meanOf(z.pair ? z.pair.rows.flatMap((r) => (r.d !== null && r.a !== null ? [{ t: r.t, v: r.a }] : [])) : [])
            const loadMean = meanOf(z.pair ? z.pair.rows.flatMap((r) => (r.d !== null && r.b !== null ? [{ t: r.t, v: r.b }] : [])) : [])
            return (
              <tr key={z.zone.value} className={on ? 'is-on' : undefined}>
                <th scope="row">
                  <button type="button" aria-pressed={on} onClick={() => ctx.setFocus(on && ctx.focus ? undefined : id)}>
                    {z.zone.label}
                  </button>
                </th>
                <td className="is-num">{both.length.toLocaleString('en-GB')}</td>
                {both.length ? (
                  <>
                    <td className="is-num">{plain(genMean)}</td>
                    <td className="is-num">{plain(loadMean)}</td>
                    <td className="is-num">{plain(meanOf(both))}</td>
                    <td className="is-num">{both.filter((p) => p.v < 0).length.toLocaleString('en-GB')}</td>
                  </>
                ) : (
                  <td colSpan={4}>{z.load ? 'no step held by both in this window' : 'no load forecast held in this window'}</td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function BalancePanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  const zones = zoneForecasts(ctx)
  const z = zoneInView(ctx, zones)
  if (!model || !window || !z?.gen) {
    return <p className="gf-hint">Nothing is held in this window, so there is no forecast to set against load.</p>
  }
  const load = ctx.related[LOAD_KEY]
  const gen = z.gen
  const unit = gen.def.unit
  const plain = (v: number | null) => (v === null ? dash : unit.plain(v))
  const name = z.zone.label
  const pair = z.pair
  const both = pair?.both ?? []
  const noun = stepWords(pair?.step ?? gen.step, model.bucketed)

  let lead: ReactNode = null
  if (load && (load.state === 'error' || load.state === 'refreshing')) {
    lead = (
      <p className="gf-hint">
        The load forecast could not be read beside it, so there is nothing to set generation against: <ErrorWords error={load.error} />
      </p>
    )
  } else if (!z.load) {
    lead = <p className="gf-hint">No load forecast is held for {z.zone.prose} in this window, so there is nothing to set its generation forecast against.</p>
  } else if (!pair) {
    lead = <p className="gf-hint">{name}’s two forecasts come on clocks that don’t nest in this window, so they are not set against each other.</p>
  }

  let chart: ReactNode = null
  if (ctx.mode === 'chart' && pair && both.length) {
    const def = (key: string, label: string, color: string): SeriesDef => ({ ...gen.def, key, field: key, label, color, from: key })
    const domain = windowDomain(window.start, window.end)
    const lines = [def('a', `${name}, generation forecast`, z.zone.color), def('b', `${name}, load forecast`, MEASURE.load)]
    const bars = [def('d', 'Generation less load', MEASURE.diff)]
    const wide: WideRow[] = pair.rows.map((r) => ({ t: r.t, a: r.a, b: r.b, d: r.d }))
    const rows = markGaps(
      wide,
      [...lines, ...bars].map((d) => ({ def: d, step: pair.step, points: pointsOf(wide, d) })),
      domain,
    )
    const panels: ChartPanel[] = [
      { rows, series: lines, mark: 'line', unit, stepMs: pair.step, bucketed: model.bucketed, height: 200, axisWidth: AXIS_WIDTH },
      { rows, series: bars, mark: 'bars', unit, stepMs: pair.step, bucketed: model.bucketed, height: 130, zero: true, axisWidth: AXIS_WIDTH },
    ]
    chart = (
      <>
        <KeyList
          items={[
            { key: 'a', mark: { kind: 'line', color: z.zone.color, dashed: ctx.fixture }, label: `${name}, generation forecast, ${unit.label}` },
            { key: 'b', mark: { kind: 'line', color: MEASURE.load, dashed: ctx.fixture }, label: `${name}, load forecast, ${unit.label}` },
            { key: 'd', mark: { kind: 'bars', color: MEASURE.diff, shape: 'rise' }, label: `Generation less load, ${unit.label}, lower chart` },
          ]}
        />
        <SeriesChart panels={panels} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      </>
    )
  } else if (ctx.mode === 'chart' && pair && !both.length) {
    chart = <p className="gf-hint">{name} holds no step with both forecasts in this window, so there is nothing to draw.</p>
  }

  // Every cell of a day's row is read over the same steps, which Held counts: those holding both
  // forecasts, or the generation forecast alone when no load forecast is held beside it.
  const joined = pair ? pair.rows.filter((r) => r.d !== null) : []
  const useJoin = joined.length > 0
  const baseStep = useJoin ? (pair?.step ?? null) : gen.step
  const base: Point[] = useJoin ? joined.map((r) => ({ t: r.t, v: r.a as number })) : gen.points
  const joinAt = new Map(joined.map((r) => [r.t, r]))
  const days = trackDays(base, baseStep, window, model.bucketed)
  const firstHeld = days.findIndex((d) => d.held > 0)
  const lead0 = firstHeld === -1 ? 0 : firstHeld
  const shown = lead0 >= 2 ? days.slice(lead0) : days
  const cols = useJoin ? 5 : 3
  const genOn = (start: number) => gen.points.filter((p) => londonMidnight(p.t) === start).length

  return (
    <>
      {lead}
      {chart}
      <p className="gf-hint">Each zone, over the window:</p>
      <ZoneTable ctx={ctx} zones={zones} current={z} />
      <p className="gf-hint">{name}, each UK day:</p>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                {useJoin ? 'Held by both' : 'Held'}
              </th>
              <th scope="col" className="is-num">
                Mean generation forecast, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Lowest, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Highest, {unit.label}
              </th>
              {useJoin && (
                <>
                  <th scope="col" className="is-num">
                    Mean load forecast, {unit.label}
                  </th>
                  <th scope="col" className="is-num">
                    Generation less load, mean, {unit.label}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lead0 >= 2 && (
              <tr className="is-missing">
                <th scope="row">
                  {dayLabel(days[0].start)} – {dayLabel(days[lead0 - 1].start)}
                </th>
                <td className="is-num">0</td>
                <td colSpan={cols}>not held locally, {plural(lead0, 'day', 'days')}</td>
              </tr>
            )}
            {shown.map((d) => {
              if (d.held === 0) {
                const own = genOn(d.start)
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={cols}>{own ? `no step with both forecasts held; the generation forecast holds ${plural(own, stepWords(gen.step, model.bucketed).replace(/s$/, ''), stepWords(gen.step, model.bucketed))}` : 'not held locally'}</td>
                  </tr>
                )
              }
              const s = statsOf(d.points)
              const loads = d.points.flatMap((p) => {
                const r = joinAt.get(p.t)
                return r && r.b !== null ? [{ t: p.t, v: r.b }] : []
              })
              const diffs = d.points.flatMap((p) => {
                const r = joinAt.get(p.t)
                return r && r.d !== null ? [{ t: p.t, v: r.d }] : []
              })
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
                  <td className="is-num">{plain(s.mean)}</td>
                  <td className="is-num">{plain(s.low?.v ?? null)}</td>
                  <td className="is-num">{plain(s.high?.v ?? null)}</td>
                  {useJoin && (
                    <>
                      <td className="is-num">{plain(meanOf(loads))}</td>
                      <td className="is-num">{plain(meanOf(diffs))}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        {name}’s generation is forecast {perText(gen.step, model.bucketed)}
        {z.load ? `, its load ${perText(z.load.step, model.bucketed)}` : ''}
        {useJoin ? `; the two are set against each other on the coarser clock, over the ${noun} both hold.` : '.'}
        {useJoin && z.load && z.load.step !== gen.step ? ` ${AVG}` : ''} Every figure in a day’s row, and in a zone’s row above, is read over the same steps, which Held counts
        {useJoin ? ': those holding both forecasts' : ''}. A day held in part is summarised in part, and its Held count says so.
        {z.load ? ' The two are separate ENTSO-E forecasts, and the rows don’t say whether they count the same plant and the same demand, so generation less load is not a forecast of exports or imports.' : ''}
        {ctx.mode === 'chart' ? ' Select a zone to draw it here and alone above, and a day to mark it on every chart.' : ' Select a zone to read its days, and a day to mark it.'}
      </p>
    </>
  )
}
