/**
 * The output-by-unit key: the units the chart draws, largest mean output
 * first, each with its colour, its code and its latest output held; select
 * one to draw it alone. Then how many units hold output, how many held none
 * above zero at any step, and the units' summed output at its highest and
 * lowest, read only at the steps every unit holds.
 */
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { periodLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { seriesId } from '../../_template/seriesModel'
import { commonLatest, statsOf, stepWords } from './figures'
import { TOTAL_UNIT, unitsOf } from './units'

export function UnitsKey({ ctx }: { ctx: PageContext }) {
  const u = unitsOf(ctx)
  if (!u || !u.units.length) return <p className="gf-hint">No unit of this type holds output in this zone in this window, so there is nothing to key.</p>
  const drawn = u.units.filter((r) => r.drawn)
  const idle = u.units.filter((r) => r.idle).length
  const total = u.total ? statsOf(u.total.points) : null
  const when = (t: number) => periodLabel(t, u.total?.step ?? null)
  const undrawn = u.units.length - drawn.length
  // The latest time most drawn units share is said once, under the list; a unit held to another time names its own.
  const stamp = commonLatest(drawn.map((r) => r.latest?.t))
  const stampStep = drawn.find((r) => r.latest?.t === stamp)?.track.step ?? null
  return (
    <>
      <ul className="gf-series-key">
        {drawn.map((r) => {
          const d = r.drawn
          if (!d) return null
          const id = seriesId(r.track.def)
          const on = ctx.focus === id
          return (
            <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={u.units.length < 2} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <KeyList items={[{ key: id, mark: { kind: 'line', color: d.color, dashed: ctx.fixture }, label: <code className="gf-series-name">{d.label}</code> }]} />
                <span className="gf-series-value">{r.latest ? d.unit.format(r.latest.v) : '–'}</span>
              </button>
              {r.latest && r.latest.t !== stamp && <span className="gf-series-when">{periodLabel(r.latest.t, r.track.step)}</span>}
            </li>
          )
        })}
      </ul>
      {stamp !== undefined && <p className="gf-hint">Latest held: {periodLabel(stamp, stampStep)}.</p>}
      {u.units.length > 1 && <p className="gf-hint">{ctx.focus ? 'Select it again to draw the largest units.' : 'Select a unit to draw it on its own.'}</p>}
      {undrawn > 0 && <p className="gf-hint">{plural(undrawn, 'more unit is', 'more units are')} not drawn, to keep the chart readable; the working panel lists every unit, and selecting one there draws it.</p>}
      <dl className="gf-stats">
        <div>
          <dt>Units holding output</dt>
          <dd>{u.units.length.toLocaleString('en-GB')}</dd>
        </div>
        <div>
          <dt>None above zero</dt>
          <dd>{idle.toLocaleString('en-GB')}</dd>
        </div>
        {total?.high && (
          <div>
            <dt>All units, highest</dt>
            <dd>
              {TOTAL_UNIT.format(total.high.v * TOTAL_UNIT.factor)}
              <span className="gf-stat-when">{when(total.high.t)}</span>
            </dd>
          </div>
        )}
        {total?.low && (
          <div>
            <dt>All units, lowest</dt>
            <dd>
              {TOTAL_UNIT.format(total.low.v * TOTAL_UNIT.factor)}
              <span className="gf-stat-when">{when(total.low.t)}</span>
            </dd>
          </div>
        )}
      </dl>
      <p className="gf-hint">
        None above zero counts units whose every value held in the window is zero or less.
        {total && total.count > 0 ? ` All units sums every unit at the ${total.count.toLocaleString('en-GB')} ${stepWords(u.total?.step ?? null, u.bucketed)} they all hold.` : ' The units hold no step in common, so there is no sum to give.'}
      </p>
    </>
  )
}
