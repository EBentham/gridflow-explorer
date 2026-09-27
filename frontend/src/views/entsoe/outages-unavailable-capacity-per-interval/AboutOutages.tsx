/**
 * The side panel: the template's About, then one line on its "Held locally"
 * dates. The source list dates these rows by their blocks' starts, which
 * run years either side of today, while this page reads them by
 * publication; the line gives the publication run the rows endpoint
 * reports. See NEEDS.md.
 */
import { About } from '../../_template/panels'
import { isoDayText } from '../../_template/text'
import type { PageContext } from '../../define'

export function AboutOutages({ ctx }: { ctx: PageContext }) {
  const cov = ctx.response?.coverage
  const first = cov?.first_day ? isoDayText(`${cov.first_day}T12:00:00Z`) : null
  const last = cov?.last_day ? isoDayText(`${cov.last_day}T12:00:00Z`) : null
  return (
    <>
      <About ctx={ctx} />
      {ctx.dataset.held && (
        <p className="gf-hint">
          The dates held locally, above, are the days the outage blocks start on, not the days the notices were published.
          {first && last ? ` The notices themselves were published from ${first} to ${last}.` : ''}
        </p>
      )}
    </>
  )
}
