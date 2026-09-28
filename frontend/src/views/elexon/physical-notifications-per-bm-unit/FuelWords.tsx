/**
 * Where each unit's fuel comes from, in a sentence under a panel: Elexon's
 * 2 to 14 day availability forecast, read beside the page, and the units
 * it lists no fuel for (or more than one). When the forecast can't be read,
 * or holds nothing for the window, it says so, and every unit shows as
 * fuel not listed.
 */
import { Fragment } from 'react'
import { ErrorWords } from '../../_template/panels'
import type { PageContext } from '../../define'
import { NO_FUEL, fuelLookup, type UnitLine } from './figures'

/** `A`, `A and B`, `A, B and C`, the ids in mono. */
export function Ids({ ids }: { ids: string[] }) {
  return ids.map((id, i) => (
    <Fragment key={id}>
      {i > 0 && (i === ids.length - 1 ? ' and ' : ', ')}
      <code>{id}</code>
    </Fragment>
  ))
}

export function FuelWords({ ctx, lines }: { ctx: PageContext; lines: UnitLine[] }) {
  const { rel, codes } = fuelLookup(ctx)
  if (!rel) return null
  if (rel.state === 'error' || rel.state === 'refreshing') {
    return (
      <p className="gf-hint">
        No fuel is named: Elexon’s availability forecast, which lists each unit’s fuel, couldn’t be read. <ErrorWords error={rel.error} />
      </p>
    )
  }
  if (!codes.size) return <p className="gf-hint">No fuel is named: Elexon’s availability forecast, which lists each unit’s fuel, holds no rows for this window.</p>
  const none = lines.filter((l) => l.fuel === NO_FUEL).map((l) => l.id)
  const many = lines.filter((l) => l.fuel !== NO_FUEL && l.fuel.code === null).map((l) => l.id)
  return (
    <p className="gf-hint">
      Fuel as Elexon’s 2 to 14 day availability forecast lists {lines.length === 1 ? 'the unit' : 'each unit'} for these days.
      {none.length > 0 && (
        <>
          {' '}
          It lists none for <Ids ids={none} />.
        </>
      )}
      {many.length > 0 && (
        <>
          {' '}
          It lists more than one for <Ids ids={many} />.
        </>
      )}
    </p>
  )
}
