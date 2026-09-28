/**
 * The output-by-unit working panel. In the Chart view, every unit of the
 * zone and type summed, in GW, on the main chart's clock: drawn only at the
 * steps every unit holds, so a unit missing a step leaves a gap rather than
 * a dip. Then every unit over the window, largest mean output first: steps
 * held, mean, lowest, highest and latest, in MW. Selecting a unit draws it
 * alone above; the drawn ones carry their chart colour.
 */
import { plural } from '../../../design/format'
import { periodLabel, windowDomain } from '../../../design/time'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { seriesId, type SeriesDef, type WideRow } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, markGaps, perText, pointsOf, stepWords } from './figures'
import { TOTAL_UNIT, unitsOf } from './units'

const dash = '–'

export function UnitsPanel({ ctx }: { ctx: PageContext }) {
  const window = ctx.window
  const u = unitsOf(ctx)
  if (!u || !window || !u.units.length) {
    return <p className="gf-hint">No unit of this type holds output in this zone in this window, so there is nothing to list.</p>
  }
  const mw = u.units[0].track.def.unit
  const plain = (v: number | null | undefined) => (v === null || v === undefined ? dash : mw.plain(v))
  const total = u.total
  const possible = total?.step ? Math.max(...u.units.map((r) => r.track.points.length)) : null

  let chart = null
  if (ctx.mode === 'chart' && total && total.points.length > 1) {
    const def: SeriesDef = { ...u.units[0].track.def, key: 'sum', field: 'sum', from: 'sum', label: `All ${u.type.label.toLowerCase()} units, ${u.zone.label}`, color: u.type.color, unit: TOTAL_UNIT }
    const domain = windowDomain(window.start, window.end)
    const wide: WideRow[] = total.points.map((p) => ({ t: p.t, sum: p.v * TOTAL_UNIT.factor }))
    const panel: ChartPanel = {
      rows: markGaps(wide, [{ def, step: total.step, points: pointsOf(wide, def) }], domain),
      series: [def],
      mark: 'line',
      unit: TOTAL_UNIT,
      stepMs: total.step,
      bucketed: u.bucketed,
      height: 170,
      zero: true,
      axisWidth: AXIS_WIDTH,
    }
    chart = <SeriesChart panels={[panel]} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} syncId="gen-units-total" />
  }

  return (
    <>
      {chart}
      {ctx.mode === 'chart' && (!total || total.points.length < 2) && <p className="gf-hint">The units hold too few steps in common in this window to draw their sum.</p>}
      {ctx.mode === 'chart' && total && total.points.length > 1 && (
        <p className="gf-hint">
          Above, every {u.type.label.toLowerCase()} unit in {u.zone.prose} summed, {perText(total.step, u.bucketed)}, at the {plural(total.points.length, stepWords(total.step, u.bucketed).replace(/s$/, ''), stepWords(total.step, u.bucketed))} they all hold
          {possible && possible > total.points.length ? ` (the unit holding most holds ${possible.toLocaleString('en-GB')})` : ''}. It is the units ENTSO-E lists, not the zone’s whole {u.type.label.toLowerCase()} output.
        </p>
      )}
      <p className="gf-hint">Every unit over the window, largest mean output first:</p>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Unit</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Mean, {mw.label}
              </th>
              <th scope="col" className="is-num">
                Lowest, {mw.label}
              </th>
              <th scope="col" className="is-num">
                Highest, {mw.label}
              </th>
              <th scope="col" className="is-num">
                Latest, {mw.label}
              </th>
              <th scope="col">Latest held</th>
            </tr>
          </thead>
          <tbody>
            {u.units.map((r) => {
              const id = seriesId(r.track.def)
              const on = ctx.focus === id
              return (
                <tr key={id} className={on ? 'is-on' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.setFocus(on ? undefined : id)}>
                      {r.drawn && <span className="gf-swatch" style={{ background: r.drawn.color }} aria-hidden="true" />} <code>{r.track.def.label}</code>
                    </button>
                  </th>
                  <td className="is-num">{r.stats.count.toLocaleString('en-GB')}</td>
                  <td className="is-num">{plain(r.stats.mean)}</td>
                  <td className="is-num">{plain(r.stats.low?.v)}</td>
                  <td className="is-num">{plain(r.stats.high?.v)}</td>
                  <td className="is-num">{plain(r.latest?.v)}</td>
                  <td>{r.latest ? periodLabel(r.latest.t, r.track.step) : dash}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {u.units.length > 8 && <p className="gf-hint">{plural(u.units.length, 'unit', 'units')}. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts each unit’s steps with a value, on its own clock; its mean, lowest and highest are over those. A coloured mark is a unit drawn above. {ctx.mode === 'chart' ? 'Select a unit to draw it alone above.' : 'Select a unit to mark its row.'}
      </p>
    </>
  )
}
