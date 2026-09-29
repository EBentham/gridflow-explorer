/**
 * The working panel. By default: each day the window holds, with its total,
 * how it moved on the day before and how many units moved it; beside it, the
 * units whose figure changes over the window, the ones that move the total.
 * For one unit in the Chart view: its days (`UnitRows`); in the Table view,
 * where the main panel already lists them, the days of all units.
 */
import { plural } from '../../../design/format'
import type { PageContext } from '../../define'
import { GW, MW, UNIT_PARAM, captureFrom, dayText, midnightOf, signedMw, unitMissing, unitShown, type Capture } from './figures'
import { UnitRows } from './UnitRows'

function DaysTable({ ctx, cap }: { ctx: PageContext; cap: Capture }) {
  let prev: { day: string; sum: number; full: boolean } | null = null
  const rows = cap.totals.map((t, i) => {
    const change = prev && prev.full && t.full ? t.sum - prev.sum : null
    const before = i > 0 ? cap.days[i - 1] : null
    const moved = before ? cap.units.filter((u) => typeof u.values.get(t.day) === 'number' && typeof u.values.get(before) === 'number' && u.values.get(t.day) !== u.values.get(before)).length : null
    prev = t
    return { ...t, change, moved }
  })
  return (
    <div>
      <p className="gf-hint gf-wa-head">The days</p>
      <div className="gf-days gf-wa-long">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Units held
              </th>
              <th scope="col" className="is-num">
                All units, {GW.label}
              </th>
              <th scope="col" className="is-num">
                Change on the day before
              </th>
              <th scope="col" className="is-num">
                Units moved
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const on = ctx.picked === midnightOf(r.day)
              return (
                <tr key={r.day} className={on ? 'is-on' : !r.full ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : midnightOf(r.day))}>
                      {dayText(r.day)}
                    </button>
                  </th>
                  <td className={r.full ? 'is-num' : 'is-num is-flag'}>{r.full ? r.held.toLocaleString('en-GB') : `${r.held.toLocaleString('en-GB')} of ${cap.units.length.toLocaleString('en-GB')}`}</td>
                  <td className="is-num">{r.full ? GW.plain(r.sum * GW.factor) : `${GW.plain(r.sum * GW.factor)} for ${r.held.toLocaleString('en-GB')}`}</td>
                  <td className={r.change ? 'is-num is-flag' : 'is-num'}>{r.change === null ? '–' : signedMw(r.change)}</td>
                  <td className="is-num">{r.moved === null ? '–' : r.moved.toLocaleString('en-GB')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        One row for each day holding rows. The total is every unit’s figure summed, in GW; the change on the day before is in MW, where both days’ totals are whole. Units moved counts the units whose figure differs from the day before.{ctx.mode === 'chart' ? ' Select a day to band it on the chart.' : ''}
      </p>
    </div>
  )
}

function ChangingUnits({ ctx, cap }: { ctx: PageContext; cap: Capture }) {
  const changing = cap.units.filter((u) => u.changes > 0)
  const open = (id: string) => ctx.setParam(UNIT_PARAM, id)
  return (
    <div>
      <p className="gf-hint gf-wa-head">Units whose figure changes</p>
      {cap.days.length < 2 ? (
        <p className="gf-hint">One day in this window holds rows, so there is no day before to set it against.</p>
      ) : changing.length === 0 ? (
        <p className="gf-hint">Every unit holds the same figure on every day it holds in this window, so none moves the total.</p>
      ) : (
        <>
          <div className="gf-days gf-wa-whole">
            <table>
              <thead>
                <tr>
                  <th scope="col">Unit</th>
                  <th scope="col" className="is-num">
                    First day, {MW.label}
                  </th>
                  <th scope="col" className="is-num">
                    Last day
                  </th>
                  <th scope="col" className="is-num">
                    Lowest
                  </th>
                  <th scope="col" className="is-num">
                    Highest
                  </th>
                  <th scope="col" className="is-num">
                    Changes
                  </th>
                </tr>
              </thead>
              <tbody>
                {changing.map((u) => (
                  <tr key={u.id}>
                    <th scope="row">
                      <button type="button" onClick={() => open(u.id)} aria-label={`Read ${u.id} on its own`}>
                        <code className="gf-wa-id">{u.id}</code>
                      </button>
                    </th>
                    <td className="is-num">{u.first ? MW.plain(u.first.v) : '–'}</td>
                    <td className="is-num">{u.last ? MW.plain(u.last.v) : '–'}</td>
                    <td className="is-num">{u.low ? MW.plain(u.low.v) : '–'}</td>
                    <td className="is-num">{u.high ? MW.plain(u.high.v) : '–'}</td>
                    <td className="is-num">{u.changes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="gf-hint">
            {plural(changing.length, 'unit', 'units')} of {cap.units.length}, largest mean first, in MW. The rest hold one figure all window. Select a unit to read it on its own.
          </p>
        </>
      )}
    </div>
  )
}

export function Working({ ctx }: { ctx: PageContext }) {
  const cap = captureFrom(ctx)
  const missing = unitMissing(ctx)
  if (ctx.state === 'empty' || !cap || !cap.units.length) return <p className="gf-hint">Nothing is held in this window, so there are no days or units to list.</p>
  if (missing) {
    return (
      <p className="gf-hint">
        No unit <code>{missing}</code> in this window’s rows, so there are no days to list.
      </p>
    )
  }
  const one = unitShown(ctx)
  if (one && ctx.mode === 'chart') return <UnitRows ctx={ctx} unit={one} />
  return (
    <div className="gf-wa-pair">
      <DaysTable ctx={ctx} cap={cap} />
      <ChangingUnits ctx={ctx} cap={cap} />
    </div>
  )
}
