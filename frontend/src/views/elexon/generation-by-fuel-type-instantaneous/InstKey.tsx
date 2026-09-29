/**
 * The key: the nine bands, top of the stack first, at the latest reading
 * held, as the Generation mix screen keys them; select one to draw it alone
 * and to set it against its half-hour below. Then the codes folded into
 * peaking and net imports at that reading, each signed, and total
 * generation there and at its highest and lowest in the window.
 */
import { FuelKey } from '../../../design/charts'
import { FUEL_BANDS } from '../../../design/fuels'
import { instantLabel, periodLabel } from '../../../design/time'
import { extremesOf } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import { displayUnit } from '../../_template/units'
import type { PageContext } from '../../define'
import './page.css'
import { bandField, bandOf, codeDefs, codeLabel, codeOrder, fold, latestRow, totalDef } from './fuels'

const MW = displayUnit('MW', 'MW')

export function InstKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const folded = model ? fold(model) : null
  const latest = folded ? latestRow(folded) : undefined
  if (!model || !folded || !latest) return <p className="gf-hint">No reading is held in this window, so there is nothing to key.</p>
  const bucketed = model.bucketed && model.stepMs !== null
  const when = (t: number) => (bucketed ? periodLabel(t, model.stepMs) : instantLabel(t))
  const bandRow: Record<string, number | null> & { t: number } = { t: latest.t }
  for (const b of FUEL_BANDS) {
    const v = latest[bandField(b.key)]
    bandRow[b.key] = typeof v === 'number' ? v : null
  }
  const total = totalDef(folded)
  const totalNow = latest[total.field]
  const ex = extremesOf(folded.rows, total)
  const defs = codeDefs(model)
  const raw = model.rows.find((r) => r.t === latest.t)
  const folds = codeOrder([...defs.keys()]).filter((c) => bandOf(c) === 'peaking' || bandOf(c) === 'imports')
  const mwOf = (code: string) => {
    const d = defs.get(code)
    const v = d && raw ? raw[d.field] : null
    return typeof v === 'number' && d ? v / d.unit.factor : null
  }

  return (
    <>
      <FuelKey latest={bandRow} focus={ctx.focus} onPick={ctx.setFocus} />
      <p className="gf-hint">
        GW, {bucketed ? `the latest ${meansText(model.stepMs as number).replace(/s$/, '')} held, ${when(latest.t)}` : `the latest reading held, stamped ${when(latest.t)}`}.{' '}
        {ctx.focus ? 'Select the fuel again to return to the full stack.' : bucketed ? 'Select a fuel to draw it on its own.' : 'Select a fuel to draw it on its own and to read it against its half-hour below.'}
      </p>
      <dl className="gf-stats">
        <div>
          <dt>Total generation</dt>
          <dd>{typeof totalNow === 'number' ? total.unit.format(totalNow) : '–'}</dd>
        </div>
        {ex && ex.high.t !== ex.low.t && (
          <>
            <div>
              <dt>Highest</dt>
              <dd>
                {total.unit.format(ex.high.v)}
                <span className="gf-stat-when">{when(ex.high.t)}</span>
              </dd>
            </div>
            <div>
              <dt>Lowest</dt>
              <dd>
                {total.unit.format(ex.low.v)}
                <span className="gf-stat-when">{when(ex.low.t)}</span>
              </dd>
            </div>
          </>
        )}
      </dl>
      <p className="gf-hint">Total generation adds up every band above zero, so exports and pumping don’t reduce it. Highest and lowest are over the {bucketed ? meansText(model.stepMs as number) : 'readings'} in the window.</p>
      {folds.length > 0 && (
        <div className="gf-days is-tight fi-whole">
          <table>
            <thead>
              <tr>
                <th scope="col">Folded code</th>
                <th scope="col" className="is-num">
                  MW
                </th>
              </tr>
            </thead>
            <tbody>
              {folds.map((code) => {
                const v = mwOf(code)
                const name = codeLabel(code)
                return (
                  <tr key={code} className={v === null ? 'is-missing' : undefined}>
                    <th scope="row">{name ? `${name}, peaking` : <code>{code}</code>}</th>
                    <td className="is-num">{v === null ? '–' : MW.plain(v)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="gf-hint">At the same {bucketed ? 'period' : 'reading'}. An interconnector code is below zero when GB exports over it; net imports is their sum.</p>
    </>
  )
}
