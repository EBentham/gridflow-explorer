/**
 * The working panel. In the Chart view, each forecast against NESO's own
 * figure for the same half-hours from its historic generation mix: embedded
 * wind against the mix's embedded wind, and solar against the mix's solar,
 * on the main chart's clock. Then each UK day: the half-hours held, wind's
 * mean and solar's peak, forecast and mix side by side, and the energy of
 * wind and solar together. The mix is read for the same window; if it fails
 * or holds nothing, the panel says so and shows the forecast alone.
 */
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { dayLabel, stepsInDay, windowDomain } from '../../../design/time'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { ErrorWords } from '../../_template/panels'
import type { SeriesDef, SeriesModel, WideRow } from '../../_template/seriesModel'
import { displayUnit } from '../../_template/units'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, MIX_KEY, MIX_SOLAR, MIX_WIND, SOLAR_COLOR, SOLAR_FC, WIND_COLOR, WIND_FC, dayFigures, seriesOf, type DayFigures } from './figures'

const GWH = displayUnit('GWh')

/** Both models' rows on one clock: a row per time, with each model's own fields (they are namespaced). */
function merged(own: SeriesModel, other: SeriesModel | null | undefined): WideRow[] {
  if (!other) return own.rows
  const byT = new Map<number, WideRow>()
  for (const r of own.rows) byT.set(r.t, { ...r })
  for (const r of other.rows) byT.set(r.t, { ...(byT.get(r.t) ?? { t: r.t }), ...r })
  return [...byT.values()].sort((a, b) => a.t - b.t)
}

function pair(ctx: PageContext, rows: WideRow[], forecast: SeriesDef, recorded: SeriesDef | undefined, color: string, name: string, model: SeriesModel) {
  const fc: SeriesDef = { ...forecast, color, label: `${name}, forecast` }
  const series = recorded && recorded.count ? [{ ...recorded, label: `${name}, generation mix` }, fc] : [fc]
  const panel: ChartPanel = {
    rows,
    series,
    mark: 'line',
    unit: forecast.unit,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    height: 170,
    zero: true,
    axisWidth: AXIS_WIDTH,
  }
  const items = series.map((d) => ({ key: d.key, mark: { kind: 'line' as const, color: d.color, dashed: ctx.fixture && d.from === 'self' }, label: d.label }))
  return { panel, items }
}

const cell = (v: number | null | undefined, plain: (x: number) => string) => (v === null || v === undefined ? '–' : plain(v))

export function RecordedPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const wind = seriesOf(model, WIND_FC)
  const solar = seriesOf(model, SOLAR_FC)
  if (!model || !ctx.window || ctx.state === 'empty' || !wind || !solar || (!wind.count && !solar.count)) {
    return <p className="gf-hint">No forecast is held in this window, so there is nothing to set against the generation mix or to sum by day.</p>
  }
  const rel = ctx.related[MIX_KEY]
  const mix = rel?.state === 'data' ? rel.series : null
  const mixWind = seriesOf(mix, MIX_WIND)
  const mixSolar = seriesOf(mix, MIX_SOLAR)
  const mixHeld = Boolean(mixWind?.count || mixSolar?.count)
  const rows = merged(model, mix)
  const domain = windowDomain(ctx.window.start, ctx.window.end)
  const windPair = pair(ctx, rows, wind, mixWind, WIND_COLOR, 'Embedded wind', model)
  const solarPair = pair(ctx, rows, solar, mixSolar, SOLAR_COLOR, 'Solar', model)

  const fw = dayFigures(model, ctx.window, wind)
  const fs = dayFigures(model, ctx.window, solar)
  const mw = mix ? dayFigures(mix, ctx.window, mixWind) : null
  const ms = mix ? dayFigures(mix, ctx.window, mixSolar) : null
  const energy = (a: DayFigures | undefined, b: DayFigures | undefined) => (a?.energy == null || b?.energy == null ? null : (a.energy + b.energy) / 1000)
  const u = wind.unit
  const days = [...fw.keys()]
  const noun = model.bucketed ? 'means' : 'half-hours'

  return (
    <>
      {ctx.mode === 'chart' && (
        <>
          <KeyList items={windPair.items} />
          <SeriesChart panels={[windPair.panel]} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
          <KeyList items={solarPair.items} />
          <SeriesChart panels={[solarPair.panel]} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
        </>
      )}
      {rel && rel.state === 'error' && (
        <p className="gf-hint">
          The generation mix couldn’t be read for this window, so the forecast is shown alone: <ErrorWords error={rel.error} />
        </p>
      )}
      {rel && rel.state !== 'error' && !mixHeld && <p className="gf-hint">The generation mix holds nothing for this window, so the forecast is shown alone.</p>}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Wind mean, forecast
              </th>
              <th scope="col" className="is-num">
                Wind mean, mix
              </th>
              <th scope="col" className="is-num">
                Solar peak, forecast
              </th>
              <th scope="col" className="is-num">
                Solar peak, mix
              </th>
              <th scope="col" className="is-num">
                Wind and solar, forecast
              </th>
              <th scope="col" className="is-num">
                Wind and solar, mix
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((start) => {
              const w = fw.get(start)
              const s = fs.get(start)
              const held = Math.max(w?.held ?? 0, s?.held ?? 0)
              const expected = stepsInDay(start, model.stepMs)
              if (held === 0) {
                return (
                  <tr key={start} className="is-missing">
                    <th scope="row">{dayLabel(start)}</th>
                    <td className="is-num">{expected === null ? '0' : `0 of ${expected}`}</td>
                    <td colSpan={6}>not held locally</td>
                  </tr>
                )
              }
              const on = start === ctx.picked
              const partial = expected !== null && held < expected
              return (
                <tr key={start} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : start)}>
                      {dayLabel(start)}
                    </button>
                  </th>
                  <td className="is-num">{expected === null || !partial ? held : `${held} of ${expected}`}</td>
                  <td className="is-num">{cell(w?.mean, u.plain)}</td>
                  <td className="is-num">{cell(mw?.get(start)?.mean, u.plain)}</td>
                  <td className="is-num">{cell(s?.peak?.v, u.plain)}</td>
                  <td className="is-num">{cell(ms?.get(start)?.peak?.v, u.plain)}</td>
                  <td className="is-num">{cell(energy(w, s), GWH.plain)}</td>
                  <td className="is-num">{cell(mw && ms ? energy(mw.get(start), ms.get(start)) : null, GWH.plain)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Means and peaks in {u.label}; wind and solar together in {GWH.label}, the {noun} held summed, so a day held in part sums in part.
        {model.bucketed && ' The window is read as means, so nothing is summed.'} The mix is NESO’s figure for each half-hour from its historic generation mix; its solar isn’t split into embedded and
        transmission-connected, so it is set beside the embedded forecast for comparison only.
        {ctx.mode === 'chart' ? ' Select a day to mark it on the charts.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
