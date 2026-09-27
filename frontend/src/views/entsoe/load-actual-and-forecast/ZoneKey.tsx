/**
 * The key, on both datasets: the template's key (each zone with its latest
 * quarter-hour held, select one to draw it alone), then for the zone the
 * working panel reads, the window's peak and trough of the page's own
 * dataset and the quarter-hours where actual load ran furthest above and
 * below the forecast. Every figure is read from the rows; a miss only where
 * both datasets hold the quarter-hour.
 */
import { stepNoun } from '../../../design/time'
import { SeriesKey } from '../../_template/panels'
import { extremesOf, periodName } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { ERROR_UNIT, joinZone, pairOf, sameClock, zoneDef, zoneInView, zoneName } from './figures'

export function ZoneKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const zone = zoneInView(ctx)
  const own = zone ? zoneDef(model, zone) : undefined
  if (!model || !zone || !own || !own.count) return <SeriesKey ctx={ctx} />
  const { actual, forecast, ownIsActual } = pairOf(ctx)
  const aDef = zoneDef(actual, zone)
  const fDef = zoneDef(forecast, zone)
  const join = actual && forecast && aDef && fDef && sameClock(actual, forecast) ? joinZone(actual, aDef, forecast, fDef) : null
  const ex = extremesOf(model.rows, own)
  const step = model.stepMs
  const when = (t: number) => periodName(t, step, model.settlement)
  const noun = model.bucketed && step ? meansText(step) : stepNoun(step)
  const signedMw = (v: number) => `${v > 0 ? '+' : ''}${ERROR_UNIT.format(v)}`

  return (
    <>
      <SeriesKey ctx={ctx} />
      <p className="gf-hint">
        {zoneName(zone)}, {ownIsActual ? 'actual load' : 'the forecast'} over the window{ctx.focus ? '' : ', the first in the key'}:
      </p>
      <dl className="gf-stats">
        {ex && (
          <>
            <div>
              <dt>Peak</dt>
              <dd>
                {own.unit.format(ex.high.v)}
                <span className="gf-stat-when">{when(ex.high.t)}</span>
              </dd>
            </div>
            <div>
              <dt>Trough</dt>
              <dd>
                {own.unit.format(ex.low.v)}
                <span className="gf-stat-when">{when(ex.low.t)}</span>
              </dd>
            </div>
          </>
        )}
        {join?.stats.above && (
          <div>
            <dt>Most above forecast</dt>
            <dd>
              {signedMw(join.stats.above.v)}
              <span className="gf-stat-when">{when(join.stats.above.t)}</span>
            </dd>
          </div>
        )}
        {join?.stats.below && (
          <div>
            <dt>Most below forecast</dt>
            <dd>
              {signedMw(join.stats.below.v)}
              <span className="gf-stat-when">{when(join.stats.below.t)}</span>
            </dd>
          </div>
        )}
      </dl>
      <p className="gf-hint">
        Peak and trough are of the {own.count.toLocaleString('en-GB')} {noun} held.
        {join && join.stats.count > 0 ? ` Above and below compare actual load with the forecast at the ${join.stats.count.toLocaleString('en-GB')} ${noun} both hold.` : ` Actual load and the forecast hold no ${noun} in common, so there is no miss to name.`}
      </p>
    </>
  )
}
