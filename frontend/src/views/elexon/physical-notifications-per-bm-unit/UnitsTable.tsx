/**
 * The default working panel: the top units, ranked by their mean start
 * level in the window, each with its fuel, the half-hours it holds, its
 * mean, lowest and highest start level, and how many of its half-hours sat
 * at zero. Select a unit to draw it alone on the chart; open one to read it
 * on its own, set against the price.
 */
import { plural } from '../../../design/format'
import { daySummaries } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { MW, UNIT_PARAM, levelsOf, unitLines } from './figures'

export function UnitsTable({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const lines = unitLines(ctx).filter((l) => l.def.count > 0)
  if (!model || !ctx.window || !lines.length) return <p className="gf-hint">No unit holds a start level in this window, so there are no units to list.</p>
  const ranked = [...lines].sort((a, b) => (b.def.mean ?? -Infinity) - (a.def.mean ?? -Infinity))
  const days = daySummaries(model, ctx.window)
  const expected = days.every((d) => d.expected !== null) ? days.reduce((s, d) => s + (d.expected ?? 0), 0) : null
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : 'half-hours'
  const fmt = (v: number | null) => (v === null ? '–' : MW.plain(v))
  const open = (id: string) => {
    ctx.setFocus(undefined)
    ctx.setParam(UNIT_PARAM, id)
  }
  return (
    <>
      <div className="gf-days gf-pn-units">
        <table>
          <thead>
            <tr>
              <th scope="col">Unit</th>
              <th scope="col">Fuel</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Mean, {MW.label}
              </th>
              <th scope="col" className="is-num">
                Lowest
              </th>
              <th scope="col" className="is-num">
                Highest
              </th>
              <th scope="col" className="is-num">
                At zero
              </th>
              <th scope="col">
                <span className="gf-pn-hidden">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((l) => {
              const on = ctx.focus === l.id
              const lv = levelsOf(model, l.def)
              const partial = expected !== null && lv.held < expected
              return (
                <tr key={l.id} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.setFocus(on ? undefined : l.id)}>
                      <code>{l.id}</code>
                    </button>
                  </th>
                  <td>
                    <span className="gf-pn-fuelcell">
                      <span className="gf-swatch" style={{ background: l.fuel.color }} aria-hidden="true" />
                      {l.fuel.label}
                    </span>
                  </td>
                  <td className={partial ? 'is-num is-flag' : 'is-num'}>{expected === null || !partial ? lv.held : `${lv.held} of ${expected}`}</td>
                  <td className="is-num">{fmt(l.def.mean)}</td>
                  <td className="is-num">{fmt(l.def.min)}</td>
                  <td className="is-num">{fmt(l.def.max)}</td>
                  <td className="is-num">{lv.zero}</td>
                  <td>
                    <button type="button" className="gf-pn-open" aria-label={`Open ${l.id} on its own`} onClick={() => open(l.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        {plural(ranked.length, 'unit', 'units')}, ranked by their mean start level in the window. Held counts the {noun} with a start level
        {expected !== null ? `, of ${expected.toLocaleString('en-GB')} in the window` : ''}; the mean, lowest and highest are of those, in MW, and a count in bold is a unit held for part of the window only. The backend picks the top units by their mean end level as kept, so its order can differ a little from this one.{' '}
        {ctx.mode === 'chart' ? 'Select a unit to draw it alone on the chart; open one to read it on its own, set against the price.' : 'Open a unit to read it on its own, set against the price.'}
      </p>
    </>
  )
}
