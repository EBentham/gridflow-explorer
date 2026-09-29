/**
 * The key for both datasets: each type, top of the stack first, with its
 * swatch (hatched as in the chart) and its figure at the latest half-hour
 * held; select one to draw it alone. Then the types added together, at that
 * half-hour and at their highest and lowest in the window, read only where
 * every type holds a figure, so a missing one is never counted as zero.
 */
import { KeyList } from '../../../design/charts'
import { listText } from '../../../design/format'
import { latestValue, periodName, seriesId } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { inRuns, sumOf, zeroRuns } from './figures'
import { heldTypes, swatchOf } from './types'

function Stat({ label, v, when }: { label: string; v: string; when?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {v}
        {when && <span className="gf-stat-when">{when}</span>}
      </dd>
    </div>
  )
}

export function StackKey({ ctx, sumLabel }: { ctx: PageContext; sumLabel: string }) {
  const model = ctx.series
  const held = model ? heldTypes(model) : []
  if (!model || !held.length) return <p className="gf-hint">No figure is held in this window, so there is nothing to key.</p>
  const unit = held[0].unit
  const name = (t: number) => periodName(t, model.stepMs, model.settlement)
  const latest = new Map(held.map((d) => [d.key, latestValue(model, d)]))
  const stamp = Math.max(...[...latest.values()].map((l) => l?.t ?? -Infinity))
  const pickable = held.length > 1
  const sum = sumOf(model, held)
  const sumNow = sum.points.at(-1)
  let hi = sum.points[0]
  let lo = sum.points[0]
  for (const p of sum.points) {
    if (p.v > hi.v) hi = p
    if (p.v < lo.v) lo = p
  }
  const zeros = held.filter((d) => d.min === 0 && d.max === 0).map((d, i) => (i === 0 ? d.label : d.label.toLowerCase()))
  const runs = zeroRuns(model)
  const empty = model.empty.filter((d) => d.from === 'self').map((d) => d.label)
  const figure = model.bucketed && model.stepMs ? meansText(model.stepMs).replace(/s$/, '') : 'half-hour'

  return (
    <>
      <ul className="gf-series-key">
        {[...held].reverse().map((d) => {
          const id = seriesId(d)
          const on = ctx.focus === id
          const l = latest.get(d.key)
          return (
            <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <KeyList items={[{ key: id, mark: { kind: 'swatch', color: swatchOf(d) }, label: <span className="gf-series-name">{d.label}</span> }]} />
                <span className="gf-series-value">{l ? unit.format(l.v) : '–'}</span>
              </button>
              {l && l.t !== stamp && <span className="gf-series-when">{name(l.t)}</span>}
            </li>
          )
        })}
      </ul>
      <p className="gf-hint">
        {unit.label ?? 'Unit unconfirmed'}, the latest {figure} held: {name(stamp)}. {pickable ? (ctx.focus ? 'Select the type again to draw the stack.' : 'Select a type to draw it on its own.') : ''}
      </p>
      {zeros.length > 0 && <p className="gf-hint">{listText(zeros)} {zeros.length > 1 ? 'are' : 'is'} zero at every {figure} held in this window.</p>}
      {empty.length > 0 && <p className="gf-hint">No figure held in this window: {listText(empty)}.</p>}
      {sum.points.length > 0 && hi && lo ? (
        <>
          <dl className="gf-stats">
            <Stat label={sumLabel} v={sumNow ? unit.format(sumNow.v) : '–'} when={sumNow && sumNow.t !== stamp ? name(sumNow.t) : undefined} />
            <Stat label="Highest" v={unit.format(hi.v)} when={name(hi.t)} />
            {lo.t !== hi.t && <Stat label="Lowest" v={unit.format(lo.v)} when={name(lo.t)} />}
          </dl>
          <p className="gf-hint">
            {sumLabel} adds every type up, at the {sum.points.length.toLocaleString('en-GB')} of {sum.anyHeld.toLocaleString('en-GB')} {figure}s where each holds a figure; highest and lowest are over those.
            {inRuns(runs, lo.t) ? ' The lowest falls where every type but wind and solar holds zero (see the main panel).' : ''}
          </p>
        </>
      ) : (
        <p className="gf-hint">No {figure} in this window holds a figure for every type, so they aren’t added up.</p>
      )}
    </>
  )
}
