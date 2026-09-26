/**
 * FIXTURE demo: a page's own working panel. The price's lowest and highest
 * held periods in the window, side by side, read from the series model the
 * template built (`ctx.series`). It sorts the held values and computes nothing.
 */
import { periodLabel } from '../../../design/time'
import type { PageContext } from '../../define'

const SHOWN = 5

export function PriceExtremes({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const def = model?.drawn[0]
  if (!model || !def) return <p className="gf-hint">Nothing is held in this window, so there is nothing to rank.</p>
  const held = model.rows.flatMap((r) => {
    const v = r[def.field]
    return typeof v === 'number' ? [{ t: r.t, v }] : []
  })
  const sorted = [...held].sort((a, b) => a.v - b.v || a.t - b.t)
  const n = Math.min(SHOWN, Math.floor(sorted.length / 2))
  const low = sorted.slice(0, n)
  const high = sorted.slice(-n).reverse()
  const when = (x: { t: number }) => periodLabel(x.t, model.stepMs)
  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Lowest</th>
              <th scope="col" className="is-num">
                {def.unit.label ?? 'Value'}
              </th>
              <th scope="col">Highest</th>
              <th scope="col" className="is-num">
                {def.unit.label ?? 'Value'}
              </th>
            </tr>
          </thead>
          <tbody>
            {low.map((x, i) => (
              <tr key={x.t}>
                <td>{when(x)}</td>
                <td className="is-num">{def.unit.plain(x.v)}</td>
                <td>{when(high[i])}</td>
                <td className="is-num">{def.unit.plain(high[i].v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Out of {held.length.toLocaleString('en-GB')} held {model.bucketed ? 'period means' : 'half-hours'}. A page's own panel: it replaces the working panel through the view config.
      </p>
    </>
  )
}
