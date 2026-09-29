/**
 * The key: the line's mark and what it is, the latest day held with its
 * figure, the mean over the 7 days ending on it (only the days held, and
 * said so when fewer), the warmest and coolest days in the window, and how
 * many of the window's days hold a figure. Every figure is read from the
 * rows (`ctx.series`); the unit stays unconfirmed.
 */
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { datesBetween, dayLabel } from '../../../design/time'
import { extremesOf } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { TEMP, daysAt, heldFigures, seriesOf, sevenDayMean, tempText } from './figures'

export function TempKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const def = seriesOf(model, TEMP)
  if (!model || !ctx.window || !def || !def.count) {
    return <p className="gf-hint">No temperature is held for any day in this window, so there is nothing to key.</p>
  }
  const held = heldFigures(model, def)
  const latest = held[held.length - 1]
  const span = sevenDayMean(held, ctx.window)
  const ex = extremesOf(model.rows, def)
  const ranged = Boolean(ex && ex.high.t !== ex.low.t)
  const days = datesBetween(ctx.window.start, ctx.window.end).length
  const spanLabel = span ? (span.held === 7 ? '7-day mean' : `Mean of ${span.held} days held`) : null
  const spanWhen = span
    ? span.held === span.days
      ? `the ${span.days} days to ${dayLabel(span.last)}`
      : `of the ${plural(span.days, 'day', 'days')} to ${dayLabel(span.last)}${span.days < 7 ? ' in this window' : ''}`
    : null

  return (
    <>
      <KeyList items={[{ key: 'temp', mark: { kind: 'line', color: def.color, dashed: ctx.fixture }, label: `${def.label}, one figure per day, unit unconfirmed` }]} />
      <dl className="gf-stats">
        <div>
          <dt>Latest day</dt>
          <dd>
            {tempText(latest.v)}
            <span className="gf-stat-when">{dayLabel(latest.day)}</span>
          </dd>
        </div>
        {span && spanLabel && (
          <div>
            <dt>{spanLabel}</dt>
            <dd>
              {tempText(span.mean)}
              <span className="gf-stat-when">{spanWhen}</span>
            </dd>
          </div>
        )}
        {ranged && ex && (
          <>
            <div>
              <dt>Warmest day</dt>
              <dd>
                {tempText(ex.high.v)}
                <span className="gf-stat-when">{daysAt(held, ex.high.v, dayLabel)}</span>
              </dd>
            </div>
            <div>
              <dt>Coolest day</dt>
              <dd>
                {tempText(ex.low.v)}
                <span className="gf-stat-when">{daysAt(held, ex.low.v, dayLabel)}</span>
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>Days held</dt>
          <dd>
            {def.count}
            <span className="gf-stat-when">of the {plural(days, 'day', 'days')} in this window</span>
          </dd>
        </div>
      </dl>
      <p className="gf-hint">
        Figures are as published, with no unit: the rows carry none, and the degrees Celsius in gridflow’s notes on this dataset aren’t confirmed by the data.
        {ranged ? ' Warmest and coolest are of the days held in this window.' : ''}
        {span && span.held < span.days ? ' The mean leaves out the days not held.' : ''}
      </p>
    </>
  )
}
