/**
 * The main panel: the template's series body (embedded wind and solar
 * forecasts stacked per half-hour, or every half-hour as a row), with the
 * embedded-wind hatch it paints with, and under it a sentence naming the
 * forecast behind the window: when it was issued and how far ahead of the
 * half-hours it was made. The table has no issue column, so the sentence
 * shows in both views.
 */
import { SeriesBody } from '../../_template/SeriesBody'
import type { PageContext } from '../../define'
import { issuesOf, vintageText } from './figures'
import { WindHatch } from './WindHatch'

export function ForecastBody({ ctx }: { ctx: PageContext }) {
  const issues = ctx.state === 'data' ? issuesOf(ctx.response) : null
  return (
    <>
      <WindHatch />
      <SeriesBody ctx={ctx} />
      {issues && (
        <p className="gf-hint">
          {vintageText(issues)}
          {ctx.mode === 'chart' && ' Wind and solar are stacked, so the top of the band is the embedded generation forecast in all. Solar reads zero overnight: those are zeros in the forecast, not gaps.'}
        </p>
      )}
      {ctx.state === 'data' && !issues && <p className="gf-hint">The rows in this window carry no issue time, so this page can’t say which forecast they come from.</p>}
    </>
  )
}
