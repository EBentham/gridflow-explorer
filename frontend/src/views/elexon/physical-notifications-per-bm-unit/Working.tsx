/**
 * The working panel: the top units listed (`UnitsTable`), or, for one
 * unit, its levels against the price and its days (`UnitPrice`).
 */
import type { PageContext } from '../../define'
import { unitShown } from './figures'
import { UnitPrice } from './UnitPrice'
import { UnitsTable } from './UnitsTable'

export function Working({ ctx }: { ctx: PageContext }) {
  return unitShown(ctx) ? <UnitPrice ctx={ctx} /> : <UnitsTable ctx={ctx} />
}
