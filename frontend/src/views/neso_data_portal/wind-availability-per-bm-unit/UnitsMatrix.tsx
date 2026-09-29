/**
 * The Table view for all units: one row per unit, one column per day the
 * window holds, each cell the unit's forecast available capacity for that
 * day in MW. A figure that differs from the unit's figure on the day before
 * is set in bold, so the few units that change stand out of the 276 that
 * mostly don't. Sorted by the mean, largest first; every column sorts.
 */
import { dayTick } from '../../../design/time'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { MW, UNIT_PARAM, captureFrom, midnightOf, type Unit } from './figures'

const cell = (v: number | null | undefined) => (typeof v === 'number' ? MW.plain(v) : '–')

export function UnitsMatrix({ ctx }: { ctx: PageContext }) {
  const cap = captureFrom(ctx)
  if (!cap || !cap.units.length) return <p className="gf-state">Rows are held for this window, but none names a unit, so there is nothing to list.</p>
  const open = (id: string) => ctx.setParam(UNIT_PARAM, id)
  const dayCols: TableCol<Unit>[] = cap.days.map((day, i) => {
    const prev = i > 0 ? cap.days[i - 1] : null
    return {
      key: day,
      label: dayTick(midnightOf(day)),
      num: true,
      sortValue: (u) => u.values.get(day) ?? null,
      render: (u) => {
        const v = u.values.get(day)
        const before = prev ? u.values.get(prev) : undefined
        const changed = typeof v === 'number' && typeof before === 'number' && v !== before
        return changed ? <strong className="gf-wa-changed">{cell(v)}</strong> : cell(v)
      },
    }
  })
  const columns: TableCol<Unit>[] = [
    {
      key: 'id',
      label: 'Unit',
      sortValue: (u) => u.id,
      render: (u) => (
        <button type="button" className="gf-wa-open" onClick={() => open(u.id)} aria-label={`Read ${u.id} on its own`}>
          <code>{u.id}</code>
        </button>
      ),
    },
    { key: 'mean', label: `Mean, ${MW.label}`, num: true, sortValue: (u) => u.mean, render: (u) => (u.mean === null ? '–' : MW.plain(u.mean)) },
    ...dayCols,
    { key: 'changes', label: 'Changes', num: true, sortValue: (u) => u.changes, render: (u) => u.changes.toLocaleString('en-GB') },
  ]
  return (
    <>
      <WindowedTable
        columns={columns}
        rows={cap.units}
        rowKey={(u) => u.id}
        initialSort={{ key: 'mean', dir: 'desc' }}
        maxHeight={520}
        caption={`${cap.units.length.toLocaleString('en-GB')} units, one column for each of the ${cap.days.length.toLocaleString('en-GB')} days in this window that hold rows, in MW`}
      />
      <p className="gf-hint">
        Each cell is the unit’s forecast available capacity for that day, in MW, as published. A bold figure differs from the unit’s figure on the day before; Changes counts them. A dash is a day with no figure held. Only days holding rows get a column. Select a unit’s id to read it on its own.
      </p>
    </>
  )
}
