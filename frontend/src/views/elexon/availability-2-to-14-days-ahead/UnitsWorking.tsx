/**
 * The by-unit working panel. By default: every unit the forecast lists in
 * the window, searchable by id or fuel, each with its fuel, the delivery days
 * it is listed for, its figure on the key's day, and its lowest and highest;
 * open one to read it alone. For one unit: its delivery days, each with the
 * issue behind it, how many days ahead that was, and its figure.
 */
import { useMemo, useState } from 'react'
import { plural } from '../../../design/format'
import { fmtDay, instantLabel } from '../../../design/time'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { MW, UNIT_PARAM, daysAhead, daysOf, keyDay, sortedUnits, unitFuel, unitShown, unitsOf, type Day, type UnitInfo } from './figures'

const dash = <span className="gf-cell-missing">–</span>
const mw = (v: number | null | undefined) => (v === null || v === undefined ? dash : MW.plain(v))

function OneDays({ ctx, unit, days }: { ctx: PageContext; unit: UnitInfo; days: Day[] }) {
  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Delivery day</th>
              <th scope="col">Issued</th>
              <th scope="col" className="is-num">
                Days ahead
              </th>
              <th scope="col" className="is-num">
                Usable output, {MW.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const at = unit.byDate.get(d.date)
              const on = d.start === ctx.picked
              return (
                <tr key={d.date} className={on ? 'is-on' : at ? undefined : 'is-missing'}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {fmtDay(d.date)}
                    </button>
                  </th>
                  <td>{!at ? (d.held ? 'unit not listed' : 'not held locally') : at.issued === null ? '–' : instantLabel(at.issued)}</td>
                  <td className="is-num">{at && at.issued !== null ? daysAhead(d.date, at.issued) : '–'}</td>
                  <td className="is-num">{at ? MW.plain(at.mw) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Each delivery day in the window: the issue behind the unit’s figure, on the UK clock, and whole UK days from it to the day. “Unit not listed” is a day the forecast holds other units but not this one. {ctx.mode === 'chart' ? 'Select a day to mark it on the chart.' : 'Select a day to read it in the key.'}
      </p>
    </>
  )
}

function AllUnits({ ctx, days }: { ctx: PageContext; days: Day[] }) {
  const [q, setQ] = useState('')
  const units = useMemo(() => sortedUnits(unitsOf(ctx.response)), [ctx.response])
  const day = keyDay(ctx, days)
  const needle = q.trim().toLowerCase()
  const shown = needle ? units.filter((u) => [u.id, u.ng, u.code, unitFuel(u)].some((s) => s?.toLowerCase().includes(needle))) : units
  const open = (id: string) => {
    ctx.setFocus(undefined)
    ctx.setParam(UNIT_PARAM, id)
  }
  const unnamed = units.filter((u) => u.id === null)
  const columns: TableCol<UnitInfo>[] = [
    {
      key: 'id',
      label: 'BM unit',
      render: (u) =>
        u.id ? (
          <button type="button" className="gf-av-open" aria-label={`Open ${u.id} alone`} onClick={() => open(u.id as string)}>
            <code>{u.id}</code>
          </button>
        ) : (
          dash
        ),
      sortValue: (u) => u.id,
    },
    { key: 'ng', label: 'National Grid id', render: (u) => (u.ng ? <code>{u.ng}</code> : dash), sortValue: (u) => u.ng },
    {
      key: 'fuel',
      label: 'Fuel',
      render: (u) => (
        <span className="gf-av-fuelcell">
          <span className="gf-swatch" style={{ background: u.band.color }} aria-hidden="true" />
          {unitFuel(u)}
        </span>
      ),
      sortValue: (u) => `${String(u.band.order).padStart(2, '0')} ${unitFuel(u)}`,
    },
    { key: 'held', label: 'Days', num: true, render: (u) => u.byDate.size, sortValue: (u) => u.byDate.size },
    { key: 'day', label: day ? `${fmtDay(day.date)}, ${MW.label}` : MW.label, num: true, render: (u) => mw(day ? u.byDate.get(day.date)?.mw : null), sortValue: (u) => (day ? (u.byDate.get(day.date)?.mw ?? null) : null) },
    { key: 'min', label: 'Lowest', num: true, render: (u) => mw(u.min), sortValue: (u) => u.min },
    { key: 'max', label: 'Highest', num: true, render: (u) => mw(u.max), sortValue: (u) => u.max },
  ]
  const total = units.length.toLocaleString('en-GB')
  return (
    <>
      <div className="gf-filters">
        <label className="gf-filter gf-search">
          <span>Search</span>
          <input type="search" className="gf-input" value={q} placeholder="A unit id or fuel" onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <WindowedTable
        columns={columns}
        rows={shown}
        rowKey={(u) => u.key}
        initialSort={{ key: 'day', dir: 'desc' }}
        caption={needle ? `${shown.length.toLocaleString('en-GB')} of ${total} units match “${q.trim()}”.` : `${total} units listed in the window, largest on ${day ? fmtDay(day.date) : 'the key’s day'} first. Select a column heading to sort.`}
        empty={`No unit matches “${q.trim()}”.`}
        maxHeight={360}
      />
      <p className="gf-hint">
        Days counts the delivery days in the window the forecast lists the unit for, of {days.length}; the lowest and highest are over those, in MW. Open a unit to read it alone.
        {unnamed.length > 0 ? ` ${plural(unnamed.length, 'unit is', 'units are')} listed with no BM unit id, by the National Grid id alone; ${unnamed.length === 1 ? 'it counts' : 'they count'} in the fuel sums but can’t be opened alone.` : ''}
      </p>
    </>
  )
}

export function UnitsWorking({ ctx }: { ctx: PageContext }) {
  const days = daysOf(ctx.response, ctx.window, 'unit')
  if (ctx.state === 'empty' || !days.some((d) => d.held > 0)) return <p className="gf-hint">No unit is listed for any delivery day in this window, so there is nothing to list.</p>
  const asked = ctx.param(UNIT_PARAM)
  const one = unitShown(ctx)
  if (asked && !one) {
    return (
      <p className="gf-hint">
        No unit <code>{asked}</code> is listed in {ctx.windowText}. Clear it in the toolbar to list every unit.
      </p>
    )
  }
  return one ? <OneDays ctx={ctx} unit={one} days={days} /> : <AllUnits ctx={ctx} days={days} />
}
