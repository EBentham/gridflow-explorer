/**
 * The working panel for one unit. In the Chart view, each half-hour's start
 * level against the market index price of the same half-hour: the prices
 * the unit notified running at, and those it sat at zero at. Then each UK
 * day: the half-hours held, the mean, lowest and highest start level, the
 * half-hours at zero, and the day's mean price. Select a day to mark it.
 */
import type { ReactNode } from 'react'
import { plural } from '../../../design/format'
import { dayLabel } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { MW, PRICE_KEY, flatLevel, pricePairs, priceSeries, sameClock, unitDays, unitLines, unitShown } from './figures'
import { PriceScatter } from './PriceScatter'

export function UnitPrice({ ctx }: { ctx: PageContext }) {
  const one = unitShown(ctx)
  const model = ctx.series
  const line = unitLines(ctx)[0]
  if (ctx.state === 'empty' || !model || !ctx.window || !line || !one) {
    return (
      <p className="gf-hint">
        No rows for <code>{one}</code> in {ctx.windowText}, so there is nothing to set against the price or summarise by day.
      </p>
    )
  }
  if (!line.def.count) {
    return (
      <p className="gf-hint">
        <code>{one}</code> holds no start level in this window, so there is nothing to set against the price or summarise by day.
      </p>
    )
  }
  const def = line.def
  const price = priceSeries(ctx)
  const rel = ctx.related[PRICE_KEY]
  const paired = sameClock(model, price)
  const pairs = paired ? pricePairs(model, def, price) : []
  const days = unitDays(model, ctx.window, def, paired ? price : null)
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : 'half-hours'
  const fmt = (x: { v: number } | null) => (x ? MW.plain(x.v) : '–')
  // A level that never moves makes a single row of dots on a made-up scale: said in words instead.
  const flat = flatLevel(line)
  const scatter = ctx.mode === 'chart' && paired && pairs.length > 0 && flat === null

  let note: ReactNode = null
  if (ctx.mode === 'chart') {
    if (rel && !price && (rel.state === 'error' || rel.state === 'refreshing')) {
      note = (
        <p className="gf-hint">
          The market index price couldn’t be read, so there is nothing to set the levels against. <ErrorWords error={rel.error} />
        </p>
      )
    } else if (!price) note = <p className="gf-hint">No market index price is held in this window, so there is nothing to set the levels against.</p>
    else if (!paired) note = <p className="gf-hint">The price and the levels come at different steps in this window, so they aren’t paired. Try a shorter window.</p>
    else if (!pairs.length) note = <p className="gf-hint">No half-hour in this window holds both a start level and a price.</p>
    else if (flat !== null) {
      note = (
        <p className="gf-hint">
          {one} held {MW.format(flat)} in every {model.bucketed ? 'period' : 'half-hour'} it holds here, so there is no spread of levels to set against the price. The key gives the mean price over the {plural(pairs.length, noun === 'half-hours' ? 'half-hour' : noun, noun)} holding both.
        </p>
      )
    }
  }

  return (
    <>
      {scatter && (
        <>
          <PriceScatter pairs={pairs} unitId={one} color={line.fuel.color} price={price.def.unit} stepMs={model.stepMs} settlement={model.settlement} />
          <p className="gf-hint">
            Each dot is one of the {noun}: {one}’s start level against the market index price of the same {model.bucketed ? 'period' : 'half-hour'}. {plural(pairs.length, 'dot', 'dots')}; {model.bucketed ? 'periods' : 'half-hours'} missing either figure are left out.
          </p>
        </>
      )}
      {note}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Mean, {MW.label}
              </th>
              <th scope="col" className="is-num">
                Lowest
              </th>
              <th scope="col" className="is-num">
                Highest
              </th>
              <th scope="col" className="is-num">
                At zero
              </th>
              {paired && (
                <>
                  <th scope="col" className="is-num">
                    Prices held
                  </th>
                  <th scope="col" className="is-num">
                    Mean price, {price.def.unit.label}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              // The price is on the levels' clock here, so a day expects as many prices as levels.
              const pricePartial = paired && d.expected !== null && d.priceHeld < d.expected
              const prices = paired ? (
                <>
                  <td className={pricePartial ? 'is-num is-flag' : 'is-num'}>{pricePartial ? `${d.priceHeld} of ${d.expected}` : d.priceHeld}</td>
                  <td className="is-num">{d.price === null ? '–' : price.def.unit.plain(d.price)}</td>
                </>
              ) : null
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={4}>not held locally</td>
                    {prices}
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.expected === null || !partial ? d.held : `${d.held} of ${d.expected}`}</td>
                  <td className="is-num">{d.mean === null ? '–' : MW.plain(d.mean)}</td>
                  <td className="is-num">{fmt(d.low)}</td>
                  <td className="is-num">{fmt(d.high)}</td>
                  <td className="is-num">{d.zero}</td>
                  {prices}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {noun} with a start level; the mean, lowest and highest are of those, in MW.
        {paired ? ' The mean price is of the half-hours of the day holding one, each counted the same.' : ''} A count in bold is a day held in part, and its figures cover only what it holds.
        {ctx.mode === 'chart' ? ' Select a day to mark it on the chart.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
