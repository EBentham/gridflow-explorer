/**
 * How much of the window carries a carbon intensity, in plain words. First,
 * measured from this page's rows: the half-hours (or hours of means) with a
 * price that also carry a forecast and an actual intensity. Then, from NESO's
 * national intensity read beside the page, which days of the window hold it
 * and which don't, as runs of days, and how many days it holds locally in all
 * between its first and last. The template's own line above names only that
 * first and last day, which reads as if every day between were held; this
 * one says where the holes are. An empty panel reads as not held here, never
 * as no carbon.
 */
import { plural } from '../../../design/format'
import { rangeText } from '../../../design/time'
import type { PageContext } from '../../define'
import { intensityDepth, intensityRuns } from './figures'

function spanDays(first: string, last: string): number {
  return Math.round((Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000) + 1
}

/** Which days of the window hold national intensity, and how many it holds locally in all. */
function heldText(ctx: PageContext): string {
  const out: string[] = []
  const runs = intensityRuns(ctx)
  if (runs && runs.held === 0) out.push(`NESO's national carbon intensity holds no day of this window.`)
  else if (runs && runs.held < runs.days) {
    out.push(`NESO's national carbon intensity holds ${runs.held} of the ${runs.days} days in this window: ${runs.heldRuns.join(', ')}; none on ${runs.emptyRuns.join(', ')}.`)
  } else if (runs) out.push(`NESO's national carbon intensity holds every day of this window, though some may be held in part.`)
  const depth = intensityDepth(ctx)
  if (depth?.first_day && depth.last_day) {
    const between = rangeText(depth.first_day, depth.last_day).replace(' – ', ' and ')
    const span = spanDays(depth.first_day, depth.last_day)
    const count = depth.day_count
    if (count && count < span) out.push(`Locally it is held on ${plural(count, 'day', 'days')} between ${between}, not on every day between.`)
    else if (count) out.push(`Locally it is held on every day between ${between}.`)
  }
  return out.join(' ')
}

export function IntensityWords({ ctx, cover, steps = 'half-hours', labelled = false, table = false }: { ctx: PageContext; cover: { priced: number; forecast: number; actual: number } | null; steps?: string; labelled?: boolean; table?: boolean }) {
  const held = heldText(ctx)
  if (!cover || !cover.priced) return held ? <p className="gf-hint">{held}</p> : null
  const n = (x: number) => x.toLocaleString('en-GB')
  if (cover.forecast === 0 && cover.actual === 0) {
    return (
      <p className="gf-hint">
        No {steps.replace(/s$/, '')} in this window carries a carbon intensity{table ? '' : ", so its panel isn't drawn"}. That is intensity not held here, never an intensity of zero. {held}
      </p>
    )
  }
  const actual = cover.actual === cover.forecast ? '' : ` The actual is joined to ${n(cover.actual)} of them.`
  const which = labelled ? " The intensity panel's labelled highest and lowest are the forecast's." : ''
  if (cover.forecast === cover.priced) {
    return (
      <p className="gf-hint">
        Carbon intensity is joined to every one of the {n(cover.priced)} {steps} with a price in this window.{actual}
        {which}
      </p>
    )
  }
  return (
    <p className="gf-hint">
      Carbon intensity is joined to {n(cover.forecast)} of the {n(cover.priced)} {steps} with a price in this window; the rest show {table ? 'a dash in its columns' : 'as gaps in its panel'}.{actual}
      {which} {held}
    </p>
  )
}
