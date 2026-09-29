/**
 * The wind and solar forecast's key: each type, top of the stack first, with
 * its swatch (offshore wind hatched, as in the chart) and its latest
 * forecast held; select one to draw it alone. Then the window's figures for
 * the zone: wind's highest and lowest forecast, solar's highest, and wind
 * and solar together at their highest. A sum is read only at the steps every
 * part of it holds.
 */
import { KeyList } from '../../../design/charts'
import { periodLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { latestValue, seriesId } from '../../_template/seriesModel'
import { commonLatest, statsOf, stepWords, type Point } from './figures'
import { windSolarOf } from './windSolar'

function Stat({ label, point, format, when }: { label: string; point: Point | null; format: (v: number) => string; when: (t: number) => string }) {
  if (!point) return null
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {format(point.v)}
        <span className="gf-stat-when">{when(point.t)}</span>
      </dd>
    </div>
  )
}

export function WindSolarKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const ws = windSolarOf(ctx)
  if (!model || !ws || !ws.held.length) return <p className="gf-hint">No wind or solar forecast is held for this zone in this window, so there is nothing to key.</p>
  const unit = ws.held[0].def.unit
  const pickable = ws.held.length > 1
  const wind = ws.wind ? statsOf(ws.wind.points) : null
  const solar = ws.solar ? statsOf(ws.solar.points) : null
  const sum = ws.sum ? statsOf(ws.sum.points) : null
  const when = (step: number | null) => (t: number) => periodLabel(t, step)
  // The latest time most types share is said once, under the list; a type held to another time names its own.
  const stamp = commonLatest(ws.held.map((k) => k.points.at(-1)?.t))
  const windWord = ws.types.filter((x) => x.track && x.type.code !== 'B16').length > 1 ? 'Wind, onshore and offshore' : 'Wind'

  return (
    <>
      <ul className="gf-series-key">
        {[...ws.types].reverse().map(({ type, track }) => {
          if (!track) {
            return (
              <li key={type.code} className="is-muted">
                <button type="button" disabled>
                  <KeyList items={[{ key: type.code, mark: { kind: 'swatch', color: type.swatch }, label: <span className="gf-series-name">{type.label}</span> }]} />
                  <span className="gf-series-value">not held</span>
                </button>
              </li>
            )
          }
          const id = seriesId(track.def)
          const on = ctx.focus === id
          const latest = latestValue(model, track.def)
          return (
            <li key={type.code} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <KeyList items={[{ key: id, mark: { kind: 'swatch', color: type.swatch }, label: <span className="gf-series-name">{type.label}</span> }]} />
                <span className="gf-series-value">{latest ? unit.format(latest.v) : '–'}</span>
              </button>
              {latest && latest.t !== stamp && <span className="gf-series-when">{periodLabel(latest.t, track.step)}</span>}
            </li>
          )
        })}
      </ul>
      {stamp !== undefined && <p className="gf-hint">Latest held: {periodLabel(stamp, ws.held[0].step)}.</p>}
      {ws.total && ctx.mode === 'chart' && <KeyList items={[{ key: 'total', mark: { kind: 'line', color: 'var(--chart-actual)', dashed: ctx.fixture }, label: `Total generation forecast, lower chart` }]} />}
      {pickable && <p className="gf-hint">{ctx.focus ? 'Select it again to draw the stack.' : 'Select a type to draw it on its own.'}</p>}
      <p className="gf-hint">{ws.zone.label}, over the window:</p>
      <dl className="gf-stats">
        <Stat label={`${windWord}, highest`} point={wind?.high ?? null} format={unit.format} when={when(ws.wind?.step ?? null)} />
        <Stat label={`${windWord}, lowest`} point={wind?.low ?? null} format={unit.format} when={when(ws.wind?.step ?? null)} />
        <Stat label="Solar, highest" point={solar?.high ?? null} format={unit.format} when={when(ws.solar?.step ?? null)} />
        {ws.held.length > 1 && <Stat label="Wind and solar, highest" point={sum?.high ?? null} format={unit.format} when={when(ws.sum?.step ?? null)} />}
      </dl>
      <p className="gf-hint">
        Read from the {stepWords(ws.sum?.step ?? null, ws.bucketed)} held
        {ws.held.length > 1 && sum ? `; a sum only where every part of it is held, ${sum.count.toLocaleString('en-GB')} of them for wind and solar together` : ''}.
      </p>
    </>
  )
}
