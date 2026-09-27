/**
 * How much of the window carries a carbon intensity, in plain words, measured
 * from the rows: the half-hours with a price that also carry a forecast and
 * an actual intensity. When none do, it says where NESO's national intensity
 * is held locally (from gridflow's source list), so an empty panel reads as
 * not held here rather than as no carbon.
 */
import { plural } from '../../../design/format'
import { rangeText } from '../../../design/time'
import type { PageContext } from '../../define'
import { intensityDepth } from './figures'

export function IntensityWords({ ctx, cover }: { ctx: PageContext; cover: { priced: number; forecast: number; actual: number } }) {
  if (!cover.priced) return null
  const depth = intensityDepth(ctx)
  const where =
    depth?.first_day && depth.last_day
      ? ` NESO's national carbon intensity is held locally ${depth.day_count ? `on ${plural(depth.day_count, 'day', 'days')} ` : ''}between ${rangeText(depth.first_day, depth.last_day).replace(' – ', ' and ')}.`
      : ''
  if (cover.forecast === 0 && cover.actual === 0) {
    return (
      <p className="gf-hint">
        No half-hour in this window carries a carbon intensity, so its panel isn't drawn. That is intensity not held here, never an intensity of zero.{where}
      </p>
    )
  }
  const actual = cover.actual === cover.forecast ? '' : ` The actual is joined to ${cover.actual.toLocaleString('en-GB')} of them.`
  if (cover.forecast === cover.priced) {
    return <p className="gf-hint">Carbon intensity is joined to every one of the {cover.priced.toLocaleString('en-GB')} half-hours with a price in this window.{actual}</p>
  }
  return (
    <p className="gf-hint">
      Carbon intensity is joined to {cover.forecast.toLocaleString('en-GB')} of the {cover.priced.toLocaleString('en-GB')} half-hours with a price in this window; the rest show as gaps in its panel.{actual}
      {cover.forecast * 4 < cover.priced ? where : ''}
    </p>
  )
}
