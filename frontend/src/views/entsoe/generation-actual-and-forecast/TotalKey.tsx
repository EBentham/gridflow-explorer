/**
 * The total generation forecast's key: the template's key (each zone with
 * its latest forecast held, select one to draw it alone), then for the zone
 * the working panel reads, its highest and lowest forecast over the window
 * and the steps where forecast generation ran furthest above and below
 * forecast load. Every figure is read from the rows, on the zone's own clock.
 */
import { periodLabel } from '../../../design/time'
import { SeriesKey } from '../../_template/panels'
import type { PageContext } from '../../define'
import { statsOf, stepWords } from './figures'
import { zoneForecasts, zoneInView } from './total'

export function TotalKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const zones = zoneForecasts(ctx)
  const z = zoneInView(ctx, zones)
  if (!model || !z?.gen) return <SeriesKey ctx={ctx} />
  const unit = z.gen.def.unit
  const own = statsOf(z.gen.points)
  const diff = z.pair ? statsOf(z.pair.both) : null
  const when = (step: number | null) => (t: number) => periodLabel(t, step)
  const genWhen = when(z.gen.step)
  const pairWhen = when(z.pair?.step ?? null)

  return (
    <>
      <SeriesKey ctx={ctx} />
      <p className="gf-hint">
        {z.zone.label} over the window{ctx.focus ? '' : ', the first in the key'}:
      </p>
      <dl className="gf-stats">
        {own.high && (
          <div>
            <dt>Highest forecast</dt>
            <dd>
              {unit.format(own.high.v)}
              <span className="gf-stat-when">{genWhen(own.high.t)}</span>
            </dd>
          </div>
        )}
        {own.low && (
          <div>
            <dt>Lowest forecast</dt>
            <dd>
              {unit.format(own.low.v)}
              <span className="gf-stat-when">{genWhen(own.low.t)}</span>
            </dd>
          </div>
        )}
        {diff?.high && (
          <div>
            <dt>Generation less load, highest</dt>
            <dd>
              {unit.format(diff.high.v)}
              <span className="gf-stat-when">{pairWhen(diff.high.t)}</span>
            </dd>
          </div>
        )}
        {diff?.low && (
          <div>
            <dt>Generation less load, lowest</dt>
            <dd>
              {unit.format(diff.low.v)}
              <span className="gf-stat-when">{pairWhen(diff.low.t)}</span>
            </dd>
          </div>
        )}
      </dl>
      <p className="gf-hint">
        Highest and lowest of the {own.count.toLocaleString('en-GB')} {stepWords(z.gen.step, model.bucketed)} held.
        {diff && diff.count > 0
          ? ` Generation less load is the generation forecast minus the load forecast, at the ${diff.count.toLocaleString('en-GB')} ${stepWords(z.pair?.step ?? null, model.bucketed)} both hold; below zero, less generation was forecast than load.`
          : ` No load forecast is held beside it at the same steps, so there is no difference to name.`}
      </p>
    </>
  )
}
