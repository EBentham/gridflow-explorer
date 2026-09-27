/**
 * The Table view of the flows and the schedules: one row per time any border
 * holds a value, a column per border, named by its in and out area. Borders
 * come on different steps, so a row is named by the time it starts, and a
 * border's cell is blank at the times it holds no value (between the hours,
 * for one held hourly). Nothing is filled in.
 */
import { instantLabel } from '../../../design/time'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { WideRow } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { bordersOf, roleOf } from './model'
import { cadenceSentence } from './words'

const dash = <span className="gf-cell-missing">–</span>

export function BorderTable({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const role = roleOf(ctx)
  const borders = bordersOf(ctx).filter((b) => b.own)
  if (!model || !borders.length) return <p className="gf-state">Rows are held for this window, but no border holds a value.</p>
  const columns: TableCol<WideRow>[] = [
    { key: 't', label: 'Starts', render: (r) => instantLabel(r.t), sortValue: (r) => r.t },
    ...borders.map((b) => {
      const def = b.own?.def
      const value = (r: WideRow) => {
        const v = def ? r[def.field] : undefined
        return typeof v === 'number' ? v : null
      }
      return {
        key: b.id,
        label: `${b.name}, ${def?.unit.label ?? 'unit unconfirmed'}`,
        num: true,
        render: (r: WideRow) => {
          const v = value(r)
          return v === null || !def ? dash : def.unit.plain(v)
        },
        sortValue: value,
      }
    }),
  ]
  const measure = `${role.own[0].toUpperCase()}${role.own.slice(1)}`
  const caption = `${measure}, ${ctx.windowText}: ${model.rows.length.toLocaleString('en-GB')} times with a value. Select a column heading to sort.`
  return (
    <>
      <WindowedTable columns={columns} rows={model.rows} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => r.t} />
      <p className="gf-hint">
        Each value holds for its border’s own step from the time it starts. {cadenceSentence(borders.map((b) => ({ name: b.name, line: b.own })))} A dash is a time the border holds no value at.
      </p>
    </>
  )
}
