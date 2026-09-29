/**
 * The side panel: the template's About, then the rest of the family in
 * plain words, read from the source list: the datasets that serve only the
 * present moment (not held), and the held ones that ask NESO for the same
 * half-hours another way (left out), with the days they hold and any day
 * they hold that this dataset doesn't.
 */
import { Fragment } from 'react'
import { rangeText, shiftDate } from '../../../design/time'
import { About } from '../../_template/panels'
import type { ManifestDataset } from '../../contract'
import type { PageContext } from '../../define'

/** NESO serves these for the present moment only (gridflow's source notes); no request reaches back. */
const PRESENT_ONLY: Record<string, string> = {
  intensity_current: 'the present half-hour',
  intensity_today: 'the present day',
}

function Ids({ ds }: { ds: ManifestDataset[] }) {
  return ds.map((d, i) => (
    <Fragment key={d.id}>
      {i > 0 && (i === ds.length - 1 ? ' and ' : ', ')}
      <code>{d.id}</code>
    </Fragment>
  ))
}

export function FamilySide({ ctx }: { ctx: PageContext }) {
  const own = ctx.dataset
  const others = ctx.family.datasets.filter((d) => d.id !== own.id)
  const present = others.filter((d) => !d.held && d.id in PRESENT_ONLY)
  const held = others.filter((d) => d.held && d.coverage?.first_day && d.coverage.last_day)
  const first = held.map((d) => d.coverage?.first_day ?? '').sort()[0]
  const last = held.map((d) => d.coverage?.last_day ?? '').sort().at(-1)
  const ownFirst = own.coverage?.first_day
  const earlier = ownFirst ? held.filter((d) => (d.coverage?.first_day ?? '') < ownFirst) : []
  return (
    <>
      <About ctx={ctx} />
      {(present.length > 0 || held.length > 0) && (
        <dl className="gf-facts">
          {present.length > 0 && (
            <div>
              <dt>Not held</dt>
              <dd>
                <Ids ds={present} />: NESO serves {present.map((d) => PRESENT_ONLY[d.id]).join(' and ')} only, and gridflow hasn’t fetched {present.length > 1 ? 'them' : 'it'}, so no history is held.
              </dd>
            </div>
          )}
          {held.length > 0 && first && last && (
            <div>
              <dt>Held, not drawn</dt>
              <dd>
                <Ids ds={held} /> ask NESO for the same half-hours another way: one half-hour, one day, the 24 or 48 hours after a moment, or the 24 hours before one. They hold {rangeText(first, last)} only, and where their half-hours overlap this dataset’s the figures match.
                {earlier.length > 0 && ownFirst && (
                  <>
                    {' '}
                    <Ids ds={earlier} /> also {earlier.length > 1 ? 'hold' : 'holds'} {rangeText(earlier.map((d) => d.coverage?.first_day ?? '').sort()[0], shiftDate(ownFirst, -1))}, before this dataset’s first day.
                  </>
                )}
              </dd>
            </div>
          )}
        </dl>
      )}
    </>
  )
}
