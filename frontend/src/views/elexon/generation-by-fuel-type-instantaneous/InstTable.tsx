/**
 * Every reading as a row, a column per fuel code as Elexon sends it, in MW
 * (tables keep MW): the codes the chart folds are all here, interconnectors
 * signed. Native rows are named by their stamp; the backend's means by
 * their period.
 */
import { instantLabel, periodLabel } from '../../../design/time'
import type { WideRow } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import { displayUnit } from '../../_template/units'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { codeDefs, codeLabel, codeOrder } from './fuels'

const MW = displayUnit('MW', 'MW')
const dash = <span className="gf-cell-missing">–</span>

export function InstTable({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model) return null
  const defs = codeDefs(model)
  const codes = codeOrder([...defs.keys()])
  const bucketed = model.bucketed && model.stepMs !== null
  const time: TableCol<WideRow> = {
    key: 't',
    label: bucketed ? 'Period (means)' : 'Stamped',
    render: (r) => (bucketed ? periodLabel(r.t, model.stepMs) : instantLabel(r.t)),
    sortValue: (r) => r.t,
  }
  const columns: TableCol<WideRow>[] = [
    time,
    ...codes.map<TableCol<WideRow>>((code) => {
      const d = defs.get(code)
      const field = d?.field ?? ''
      const factor = d?.unit.factor ?? 1
      const name = codeLabel(code)
      const mw = (r: WideRow) => {
        const v = r[field]
        return typeof v === 'number' ? v / factor : null
      }
      return {
        key: code,
        label: name ? `${name}, MW` : (
          <>
            <code>{code}</code>, MW
          </>
        ),
        num: true,
        render: (r) => {
          const v = mw(r)
          return v === null ? dash : MW.plain(v)
        },
        sortValue: mw,
      }
    }),
  ]
  const noun = bucketed && model.stepMs ? meansText(model.stepMs) : 'readings'
  const caption = `Generation by fuel code, ${ctx.windowText}: ${model.rows.length.toLocaleString('en-GB')} ${noun}, a column per code as Elexon sends it, interconnectors signed (below zero is GB exporting). Select a column heading to sort.`
  return <WindowedTable columns={columns} rows={model.rows} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => r.t} />
}
