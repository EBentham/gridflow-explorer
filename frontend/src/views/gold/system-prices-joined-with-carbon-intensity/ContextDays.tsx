/**
 * The working panel. Each UK day of the window: the half-hours with a price,
 * the price's mean, lowest and highest, the net imbalance volume summed over
 * the half-hours held, and how many half-hours carry a forecast intensity
 * with its mean. A day with no intensity says so; it is never a zero. Then
 * price set against carbon intensity: the half-hours holding both, ranked by
 * the forecast intensity and cut into thirds, with each third's price. The
 * forecast is used as it is the intensity known before the half-hour; the
 * actual is published after it.
 */
import './page.css'
import { plural } from '../../../design/format'
import { dayLabel } from '../../../design/time'
import { daySummaries } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { CI_FORECAST, MIN_PAIRS, NIV, SSP, folded, isMeans, priceByIntensity, seriesOf, unjoinable } from './figures'

export function ContextDays({ ctx }: { ctx: PageContext }) {
  if (unjoinable(ctx)) return <p className="gf-hint">This window comes as means over two hours or more, kept apart by price derivation code, so its days aren't summarised. Choose a shorter window.</p>
  if (isMeans(ctx)) {
    return (
      <p className="gf-hint">
        This window is read as hourly means. The days and the thirds count and sum half-hours, and an hour's mean doesn't say how many half-hours it holds, so they are left out. Choose a shorter window to read them.
      </p>
    )
  }
  const f = folded(ctx)
  const model = f?.model ?? null
  const price = seriesOf(model, SSP)
  const niv = seriesOf(model, NIV)
  const ci = seriesOf(model, CI_FORECAST)
  if (!f || !model || !ctx.window || !price || !price.count) {
    return <p className="gf-hint">No system price is held in this window, so there are no days to summarise.</p>
  }
  const days = daySummaries(model, ctx.window, price)
  const ciDays = new Map(ci ? daySummaries(model, ctx.window, ci).map((d) => [d.start, d]) : [])
  const nivDays = new Map(niv ? daySummaries(model, ctx.window, niv).map((d) => [d.start, d]) : [])
  const pp = (v: number) => price.unit.plain(v)
  const rel = priceByIntensity(model)

  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Mean, {price.unit.label}
              </th>
              <th scope="col" className="is-num">
                Lowest
              </th>
              <th scope="col" className="is-num">
                Highest
              </th>
              <th scope="col" className="is-num">
                Imbalance, {niv?.unit.label ?? 'unit unconfirmed'}
              </th>
              <th scope="col" className="is-num">
                With intensity
              </th>
              <th scope="col" className="is-num">
                Mean intensity, {ci?.unit.label ?? 'unit unconfirmed'}
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const c = ciDays.get(d.start)
              const v = nivDays.get(d.start)
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={6}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              // The volume summed over the half-hours held, so a day held in part sums in part.
              const nivSum = v && v.held && v.mean !== null ? v.mean * v.held : null
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.expected === null || !partial ? d.held : `${d.held} of ${d.expected}`}</td>
                  <td className="is-num">{d.mean === null ? '–' : pp(d.mean)}</td>
                  <td className="is-num">{d.low ? pp(d.low.v) : '–'}</td>
                  <td className="is-num">{d.high ? pp(d.high.v) : '–'}</td>
                  <td className="is-num">{nivSum === null || !niv ? '–' : niv.unit.plain(nivSum)}</td>
                  <td className="is-num">{c?.held ? (c.held === d.held ? c.held : `${c.held} of ${d.held}`) : 'none'}</td>
                  <td className="is-num">{c?.mean === null || c?.mean === undefined || !ci ? '–' : ci.unit.plain(c.mean)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the half-hours with a price. Imbalance sums the net imbalance volume over them, so a day held in part sums in part. With intensity counts those that carry a forecast carbon intensity; none means none is joined, not an intensity of zero.
        {ctx.mode === 'chart' ? ' Select a day to mark it on the chart.' : ' Select a day to mark it.'}
      </p>
      <h3 className="gf-imbctx-sub">Price against carbon intensity</h3>
      {rel.thirds.length ? (
        <>
          <div className="gf-days">
            <table>
              <thead>
                <tr>
                  <th scope="col">Forecast intensity</th>
                  <th scope="col" className="is-num">
                    Range, {ci?.unit.label}
                  </th>
                  <th scope="col" className="is-num">
                    Half-hours
                  </th>
                  <th scope="col" className="is-num">
                    Mean price, {price.unit.label}
                  </th>
                  <th scope="col" className="is-num">
                    Lowest
                  </th>
                  <th scope="col" className="is-num">
                    Highest
                  </th>
                </tr>
              </thead>
              <tbody>
                {rel.thirds.map((t, i) => (
                  <tr key={i}>
                    <th scope="row">{['Lowest third', 'Middle third', 'Highest third'][i]}</th>
                    <td className="is-num">
                      {ci?.unit.plain(t.ciLow)} to {ci?.unit.plain(t.ciHigh)}
                    </td>
                    <td className="is-num">{t.n.toLocaleString('en-GB')}</td>
                    <td className="is-num">{pp(t.mean)}</td>
                    <td className="is-num">{pp(t.low)}</td>
                    <td className="is-num">{pp(t.high)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="gf-hint">
            The {rel.pairs.toLocaleString('en-GB')} half-hours in the window holding both a system price and a forecast intensity, ranked by the intensity and cut into thirds. The forecast is the intensity known before the half-hour. Means are unweighted, and the thirds show how the two moved together here, not why.
          </p>
        </>
      ) : (
        <p className="gf-hint">
          {rel.pairs === 0
            ? 'No half-hour in this window holds both a system price and a forecast intensity, so price can’t be set against intensity here.'
            : `Only ${plural(rel.pairs, 'half-hour holds', 'half-hours hold')} both a system price and a forecast intensity in this window, fewer than the ${MIN_PAIRS} it takes to set thirds side by side.`}
        </p>
      )}
    </>
  )
}
