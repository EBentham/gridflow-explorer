/**
 * The clearing view's working panel: each UK day of the window, the
 * half-hours holding a modelled price, the day's mean modelled and market
 * index prices and the mean gap between them, how often the price floor set
 * the price, and the fuel that set it most often otherwise. Select a day to
 * mark it on the charts; each held day links to its supply curves, read one
 * day at a time.
 */
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fmtN, plural } from '../../../design/format'
import { dayLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { FLOOR_STYLE, clearingDays, clearingPoints, curveHeld, curveSearch, ownRows, relatedRows, type Mean } from './figures'

const fmt = (m: Mean) => (m.mean === null ? '–' : fmtN(m.mean, 2))

export function ClearingDays({ ctx }: { ctx: PageContext }) {
  const [params] = useSearchParams()
  const rows = ownRows(ctx)
  const market = relatedRows(ctx, 'market')
  const points = useMemo(() => clearingPoints(rows, market), [rows, market])
  const model = ctx.series
  if (!model || !ctx.window || !points.length) return <p className="gf-hint">Nothing is held in this window, so there are no days to summarise.</p>
  const days = clearingDays(points, ctx.window, model.stepMs)
  const linked = curveHeld(ctx) && !model.bucketed
  const first = ctx.dataset.coverage?.first_day
  const last = ctx.dataset.coverage?.last_day
  const noun = model.bucketed ? 'means' : 'half-hours'

  return (
    <>
      <div className="gf-days gf-stack-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Modelled, £/MWh
              </th>
              <th scope="col" className="is-num">
                Market index, £/MWh
              </th>
              <th scope="col" className="is-num">
                Modelled − market, £/MWh
              </th>
              <th scope="col" className="is-num">
                At the floor
              </th>
              <th scope="col">Mostly set by</th>
              {linked && <th scope="col">Supply curves</th>}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const outside = (first && d.day < first) || (last && d.day > last)
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td className="is-num">–</td>
                    <td className="is-num">{fmt(d.market)}</td>
                    <td className="is-num">–</td>
                    <td className="is-num">–</td>
                    <td colSpan={linked ? 2 : 1}>{outside ? 'no modelled price: not held locally' : 'no modelled price held'}</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              const mostly = d.mostly ?? (d.atFloor > 0 ? { style: FLOOR_STYLE } : null)
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{partial ? `${d.held} of ${d.expected}` : d.held}</td>
                  <td className="is-num">{fmt(d.model)}</td>
                  <td className="is-num">{fmt(d.market)}</td>
                  <td className="is-num">{fmt(d.gap)}</td>
                  <td className="is-num">{d.atFloor}</td>
                  <td>
                    {mostly ? (
                      <>
                        <span className="gf-swatch gf-stack-swatch" style={{ background: mostly.style.color }} aria-hidden="true" />
                        {mostly.style.label}
                      </>
                    ) : (
                      '–'
                    )}
                  </td>
                  {linked && (
                    <td>
                      <Link className="gf-view-link gf-stack-link" to={{ search: curveSearch(params, d.day) }} aria-label={`The supply curves for ${dayLabel(d.start)}`}>
                        Open
                      </Link>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {noun} with a modelled price. Each mean is of the {noun} held that day, and modelled minus market of those holding both. Mostly set by is the fuel that set the
        price most often where a unit set it.{ctx.mode === 'chart' ? ' Select a day to mark it on both charts.' : ' Select a day to mark it.'}
        {linked ? ' Open reads that day’s supply curves, one half-hour at a time.' : ''}
      </p>
    </>
  )
}
