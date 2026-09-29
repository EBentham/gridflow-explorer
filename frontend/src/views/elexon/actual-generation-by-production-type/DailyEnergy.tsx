/**
 * agws's working panel: each UK day's energy by type, in GWh. The chart
 * draws the days every type holds whole, a bar per type (offshore wind
 * hatched, with the patterns the main panel draws); a day held in part is left off the chart, where its sum would
 * read as a still or dull day, and listed in the table with the half-hours it
 * holds. Then the windiest and stillest whole day, and the sunniest.
 */
import { KeyList } from '../../../design/charts'
import { DAY_MS, dayLabel, windowDomain } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import type { SeriesDef, WideRow } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import { displayUnit } from '../../_template/units'
import type { PageContext } from '../../define'
import { energyDays, wholeSum, type EnergyDay } from './energy'
import { halfHourly } from './figures'
import { AXIS_WIDTH, fillOf, heldTypes, swatchOf } from './types'

const GWH = displayUnit('GWh')
const WIND = ['Wind Onshore', 'Wind Offshore']
const SOLAR = ['Solar']

const dash = <span className="gf-cell-missing">–</span>

function extremes(days: EnergyDay[], groups: string[]) {
  let hi: { d: EnergyDay; v: number } | null = null
  let lo: { d: EnergyDay; v: number } | null = null
  for (const d of days) {
    const v = wholeSum(d, groups)
    if (v === null) continue
    if (!hi || v > hi.v) hi = { d, v }
    if (!lo || v < lo.v) lo = { d, v }
  }
  return { hi, lo }
}

export function DailyEnergy({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model || ctx.state === 'empty' || !ctx.window) return <p className="gf-hint">No figure is held in this window, so there is no day to add up.</p>
  if (!halfHourly(model)) {
    return <p className="gf-hint">This window is read as {model.stepMs ? meansText(model.stepMs) : 'means'}, not half-hours, so its days aren’t added up here. Choose a window of 30 days or less.</p>
  }
  const defs = heldTypes(model)
  if (!defs.length) return <p className="gf-hint">No figure is held in this window, so there is no day to add up.</p>
  const days = energyDays(model, defs, ctx.window)
  const whole = days.filter((d) => d.whole)
  const series: SeriesDef[] = defs.map((d) => ({ ...d, color: fillOf(d), unit: GWH }))
  // A day's bars sit at its middle, so they fall between the day rules; the tooltip names the day.
  const rows: WideRow[] = whole.map((d) => {
    const r: WideRow = { t: d.start + DAY_MS / 2 }
    for (const x of d.types) r[x.def.field] = x.gwh
    return r
  })
  const wind = extremes(days, WIND)
  const solar = extremes(days, SOLAR)
  const hasWind = defs.some((d) => d.group !== null && WIND.includes(d.group))
  const hasSolar = defs.some((d) => d.group === 'Solar')
  const partial = days.filter((d) => !d.whole && d.types.some((x) => x.held > 0))
  const sentences: string[] = []
  if (hasWind && wind.hi && wind.lo) {
    sentences.push(
      wind.hi.d === wind.lo.d
        ? `Wind, onshore and offshore together, made ${GWH.format(wind.hi.v)} on ${dayLabel(wind.hi.d.start)}.`
        : `Wind, onshore and offshore together, made the most on ${dayLabel(wind.hi.d.start)}, ${GWH.format(wind.hi.v)}, and the least on ${dayLabel(wind.lo.d.start)}, ${GWH.format(wind.lo.v)}.`,
    )
  }
  if (hasSolar && solar.hi) sentences.push(`Solar made the most on ${dayLabel(solar.hi.d.start)}, ${GWH.format(solar.hi.v)}.`)

  return (
    <>
      {whole.length > 0 ? (
        <>
          <SeriesChart
            panels={[{ rows, series, mark: 'bars', unit: GWH, stepMs: DAY_MS, height: 220, zero: true, axisWidth: AXIS_WIDTH }]}
            domain={windowDomain(ctx.window.start, ctx.window.end)}
            fixture={ctx.fixture}
            syncId="agws-energy"
          />
          <KeyList items={defs.map((d) => ({ key: d.key, mark: { kind: 'swatch' as const, color: swatchOf(d) }, label: d.label }))} />
          <p className="gf-hint">
            {whole.length === days.length ? 'Every day of the window is held whole.' : `The chart draws the ${whole.length} of ${days.length} days every type holds whole.`} {sentences.join(' ')}
          </p>
        </>
      ) : (
        <p className="gf-hint">No day in this window is held whole for every type, so none is drawn; the table gives what each holds.</p>
      )}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Half-hours held
              </th>
              {defs.map((d) => (
                <th key={d.key} scope="col" className="is-num">
                  {d.label}, GWh
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const held = Math.min(...d.types.map((x) => x.held))
              const most = Math.max(...d.types.map((x) => x.held))
              const none = most === 0
              return (
                <tr key={d.day} className={none ? 'is-missing' : !d.whole ? 'is-partial' : undefined}>
                  <th scope="row">{dayLabel(d.start)}</th>
                  <td className="is-num">{none ? 'none held' : held === most ? `${held} of ${d.expected}` : `${held}–${most} of ${d.expected}`}</td>
                  {d.types.map((x) => (
                    <td key={x.def.key} className="is-num">
                      {x.gwh === null ? dash : GWH.plain(x.gwh)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Each day’s energy is its half-hours’ MW figures times half an hour, added up over the half-hours it holds{partial.length > 0 ? `; ${partial.length === 1 ? 'one day is' : `${partial.length} days are`} held in part and summed over what they hold, not scaled up` : ''}. UK days, midnight to midnight.
      </p>
    </>
  )
}
