/**
 * The main panel. In the Chart view, by default, the forecast available
 * capacity of every unit the window holds, summed per day in GW and held
 * flat across the day, with GB wind output on the same axis, half-hour by
 * half-hour; with one unit asked for (`?unit=`), that unit's figure in MW.
 * In the Table view, every unit's figure for every held day
 * (`UnitsMatrix`), or the one unit's rows.
 */
import { plural } from '../../../design/format'
import { datesBetween, windowDomain } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { ErrorWords } from '../../_template/panels'
import type { PageContext } from '../../define'
import { MW, OUTPUT_KEY, captureFrom, dayText, outputCover, outputSeries, totalPanel, unitMissing, unitPanel, unitShown } from './figures'
import { UnitRows } from './UnitRows'
import { UnitsMatrix } from './UnitsMatrix'

function OutputWords({ ctx }: { ctx: PageContext }) {
  const rel = ctx.related[OUTPUT_KEY]
  if (!rel || outputSeries(ctx)) return null
  if (rel.state === 'error' || rel.state === 'refreshing') {
    return (
      <p className="gf-hint">
        GB wind output couldn’t be read, so none is drawn beside the forecast. <ErrorWords error={rel.error} />
      </p>
    )
  }
  return <p className="gf-hint">No GB wind output is held in this window, so none is drawn beside the forecast.</p>
}

export function AvailabilityMain({ ctx }: { ctx: PageContext }) {
  const cap = captureFrom(ctx)
  const w = ctx.window
  const missing = unitMissing(ctx)
  if (missing) {
    return (
      <p className="gf-state">
        No unit <code>{missing}</code> in this window’s rows. Pick one from the list in the toolbar, or go back to all units.
      </p>
    )
  }
  const one = unitShown(ctx)
  if (ctx.mode === 'table') return one ? <UnitRows ctx={ctx} unit={one} /> : <UnitsMatrix ctx={ctx} />
  if (!cap || !w || !cap.units.length) return <p className="gf-state">Rows are held for this window, but none names a unit, so there is nothing to draw.</p>
  const domain = windowDomain(w.start, w.end)
  if (one) {
    const flat = one.low && one.high && one.low.v === one.high.v
    return (
      <>
        <SeriesChart panels={[unitPanel(one, w, flat ? 180 : 420)]} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
        <p className="gf-hint">
          <code>{one.id}</code>’s forecast available capacity for each day, in MW, held flat from midnight to midnight as it is one figure for the whole day
          {flat && one.low ? `: ${MW.format(one.low.v)} on every day it holds` : ''}. A gap is a day with no figure held. It has a figure on {one.held} of the {plural(cap.days.length, 'day', 'days')} in this window that hold rows.
        </p>
      </>
    )
  }
  const output = outputSeries(ctx)
  const partial = cap.totals.filter((t) => !t.full)
  const cover = output ? outputCover(output, w) : null
  const windowDays = datesBetween(w.start, w.end).length
  return (
    <>
      <SeriesChart panels={[totalPanel(cap, w, output, 460)]} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      <p className="gf-hint">
        The forecast line is the sum of every unit’s forecast available capacity for the day, in GW, held flat from midnight to midnight as each figure is for the whole day. A gap is a day with no rows held.
        {partial.length > 0 &&
          ` It is left out on ${partial.map((t) => dayText(t.day)).join(', ')}, where only ${partial.map((t) => t.held.toLocaleString('en-GB')).join(', ')} of the ${cap.units.length} units hold a figure: the working panel gives those days’ sums.`}
        {output &&
          ` GB wind output is the wind generation Elexon meters, each half-hour, in GW${cover && cover.days < windowDays ? `; it is held on ${cover.days} of the window’s ${windowDays} days` : ''}. The two are set side by side on one axis, not divided one by the other (see the notes above).`}
      </p>
      <OutputWords ctx={ctx} />
    </>
  )
}
