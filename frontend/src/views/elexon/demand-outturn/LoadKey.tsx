/**
 * Total load's key: the template's key (the line, its latest value and
 * period), then how much of the window the rows hold, counted from the rows
 * read: total load holds only some half-hours of each day, and the key says
 * how many, so the gaps in the line read as gaps, not as a quiet spell.
 */
import { pct } from '../../../design/format'
import { stepNoun } from '../../../design/time'
import { heldDays } from '../../_template/panelHelpers'
import { SeriesKey } from '../../_template/panels'
import type { PageContext } from '../../define'

export function LoadKey({ ctx }: { ctx: PageContext }) {
  const days = heldDays(ctx)
  const model = ctx.series
  const complete = days.length > 0 && days.every((d) => d.expected !== null) && !model?.bucketed
  const held = days.reduce((n, d) => n + d.held, 0)
  const expected = complete ? days.reduce((n, d) => n + (d.expected ?? 0), 0) : 0
  const noun = stepNoun(model?.stepMs ?? null)
  const fullDays = complete ? days.filter((d) => d.held > 0 && d.held === d.expected).length : 0
  const heldAny = days.filter((d) => d.held > 0).length

  return (
    <>
      <SeriesKey ctx={ctx} />
      {complete && expected > 0 && (
        <>
          <dl className="gf-stats">
            <div>
              <dt>Held</dt>
              <dd>
                {held.toLocaleString('en-GB')} of {expected.toLocaleString('en-GB')}
                <span className="gf-stat-when">
                  {pct(held / expected)} of the {noun} in {ctx.windowText}
                </span>
              </dd>
            </div>
            <div>
              <dt>Complete days</dt>
              <dd>
                {fullDays}
                <span className="gf-stat-when">of the {heldAny} days holding any</span>
              </dd>
            </div>
          </dl>
          <p className="gf-hint">Counted from the rows read. A {noun.replace(/s$/, '')} not held is a gap in the line, never a zero.</p>
        </>
      )}
    </>
  )
}
