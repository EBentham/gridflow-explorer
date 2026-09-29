/**
 * The Table view for one unit: its rows as held, one per day, with the file's
 * publication time, the change on the day before, and its part of the day's
 * total over every unit where that total is whole.
 */
import { instantLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { GW, MW, captureFrom, dayText, signedMw, type Unit } from './figures'

export function UnitRows({ ctx, unit }: { ctx: PageContext; unit: Unit }) {
  const cap = captureFrom(ctx)
  if (!cap) return null
  const published = new Map<string, string>()
  for (const r of ctx.response?.rows ?? []) {
    if (r.bmu_id === unit.id && typeof r.availability_date === 'string' && typeof r.published_at === 'string') published.set(r.availability_date, r.published_at)
  }
  let prev: number | null = null
  const rows = cap.days.map((day) => {
    const v = unit.values.get(day)
    const value = typeof v === 'number' ? v : null
    const change = value !== null && prev !== null ? value - prev : null
    prev = value
    const total = cap.totalByDay.get(day)
    const pub = published.get(day)
    const t = pub ? Date.parse(pub) : NaN
    return { day, value, change, total, pub: Number.isFinite(t) ? instantLabel(t, { year: true }) : null }
  })
  return (
    <>
      <div className="gf-days gf-wa-long">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Forecast available, {MW.label}
              </th>
              <th scope="col" className="is-num">
                Change on the day before
              </th>
              <th scope="col" className="is-num">
                All units, {GW.label}
              </th>
              <th scope="col" className="is-num">
                Its part
              </th>
              <th scope="col">Published</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.day} className={r.value === null ? 'is-missing' : undefined}>
                <th scope="row">{dayText(r.day)}</th>
                <td className="is-num">{r.value === null ? '–' : MW.plain(r.value)}</td>
                <td className={r.change ? 'is-num is-flag' : 'is-num'}>{r.change === null ? '–' : signedMw(r.change)}</td>
                <td className="is-num">{r.total?.full ? GW.plain(r.total.sum * GW.factor) : '–'}</td>
                <td className="is-num">{r.total?.full && r.value !== null && r.total.sum > 0 ? `${((100 * r.value) / r.total.sum).toFixed(2)}%` : '–'}</td>
                <td>{r.pub ?? '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        One row for each day in this window that holds rows. Its part is its figure over the sum of every unit’s, on days every unit holds a figure. A dash is a figure not held.
      </p>
    </>
  )
}
