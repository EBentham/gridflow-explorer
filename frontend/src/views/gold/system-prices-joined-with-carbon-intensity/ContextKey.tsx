/**
 * The key panel: a mark and a name for each series drawn, then the latest
 * half-hour held (price, imbalance volume and the intensity joined to it,
 * named by its settlement period), the window's price range, extremes, mean
 * and runs below zero, how many half-hours carry a carbon intensity, whether
 * the buy price ever differs from the sell price, and how many half-hours
 * carry each price derivation code. Every figure is read from the folded
 * rows (`figures.ts`); means are of the half-hours held, unweighted.
 */
import { KeyList, type KeyItem } from '../../../design/charts'
import { listText, money } from '../../../design/format'
import { extremesOf, latestValue, periodName } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { CI_ACTUAL, CI_FORECAST, NIV, SBP, SSP, folded, intensityCover, priceSides, seriesOf, unjoinable } from './figures'

export function ContextKey({ ctx }: { ctx: PageContext }) {
  if (unjoinable(ctx)) return <p className="gf-hint">This window comes as means over two hours or more, kept apart by price derivation code, so there is no single series to key. Choose a shorter window.</p>
  const f = folded(ctx)
  const model = f?.model ?? null
  const price = seriesOf(model, SSP)
  if (!f || !model || !ctx.window || !price || !price.count || price.mean === null || price.min === null || price.max === null) {
    return <p className="gf-hint">No system price is held in this window, so there is nothing to key.</p>
  }
  const buy = seriesOf(model, SBP)
  const niv = seriesOf(model, NIV)
  const forecast = seriesOf(model, CI_FORECAST)
  const actual = seriesOf(model, CI_ACTUAL)
  const sides = priceSides(model)
  const cover = intensityCover(model)
  const when = (t: number) => periodName(t, model.stepMs, model.settlement)
  const at = (column: string | undefined, t: number) => {
    const d = column ? seriesOf(model, column) : undefined
    const v = d ? model.rows.find((r) => r.t === t)?.[d.field] : null
    return d && typeof v === 'number' ? d.unit.format(v) : 'not held'
  }

  const items: KeyItem[] = [{ key: 'ssp', mark: { kind: 'line', color: price.color, dashed: ctx.fixture }, label: sides.differ > 0 ? price.label : 'System price' }]
  if (buy && sides.differ > 0) items.push({ key: 'sbp', mark: { kind: 'line', color: buy.color, dashed: ctx.fixture }, label: buy.label })
  if (niv && niv.count > 0) items.push({ key: 'niv', mark: { kind: 'swatch', color: niv.color }, label: `${niv.label}, ${niv.unit.label ?? 'unit unconfirmed'}` })
  if (forecast && forecast.count > 0) items.push({ key: 'cif', mark: { kind: 'line', color: forecast.color, dashed: ctx.fixture }, label: forecast.label })
  if (actual && actual.count > 0) items.push({ key: 'cia', mark: { kind: 'line', color: actual.color, dashed: ctx.fixture }, label: actual.label })
  const below = model.rows.filter((r) => {
    const v = r[price.field]
    return typeof v === 'number' && v < 0
  }).length
  if (below > 0 && ctx.mode === 'chart') items.push({ key: 'below', mark: { kind: 'band' }, label: 'System price below zero' })

  if (f.means) {
    return (
      <>
        <KeyList items={items} />
        <p className="gf-hint">This window is read as hourly means, so the latest half-hour, the half-hour extremes and the counts of half-hours are left out: an hour's mean hides its half-hours. The chart's labelled highest and lowest are hourly means. Choose a shorter window to read them.</p>
      </>
    )
  }

  const latest = latestValue(model, price)
  const ex = extremesOf(model.rows, price)
  const n = (x: number) => x.toLocaleString('en-GB')
  const codes = [...f.codes.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([code, count]) => `${code === '' ? 'blank' : code} on ${n(count)}`)

  return (
    <>
      <KeyList items={items} />
      {latest && (
        <>
          <dl className="gf-stats">
            <div>
              <dt>Latest price</dt>
              <dd>{money(latest.v, 2)}</dd>
            </div>
            <div>
              <dt>Imbalance volume</dt>
              <dd>{at(NIV, latest.t)}</dd>
            </div>
            <div>
              <dt>Intensity, forecast</dt>
              <dd>{at(CI_FORECAST, latest.t)}</dd>
            </div>
          </dl>
          <p className="gf-hint">For {when(latest.t)}, the latest held.</p>
        </>
      )}
      <dl className="gf-stats">
        <div>
          <dt>Range</dt>
          <dd>
            {money(price.min, 2)} to {money(price.max, 2)}
            <span className="gf-stat-when">in {ctx.windowText}</span>
          </dd>
        </div>
        {ex && (
          <>
            <div>
              <dt>Highest</dt>
              <dd>
                {money(ex.high.v, 2)}
                <span className="gf-stat-when">{when(ex.high.t)}</span>
              </dd>
            </div>
            <div>
              <dt>Lowest</dt>
              <dd>
                {money(ex.low.v, 2)}
                <span className="gf-stat-when">{when(ex.low.t)}</span>
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>Mean</dt>
          <dd>{money(price.mean, 2)}</dd>
        </div>
        <div>
          <dt>Below zero</dt>
          <dd>
            {n(below)} of {n(price.count)}
          </dd>
        </div>
        <div>
          <dt>With an intensity</dt>
          <dd>
            {n(cover.forecast)} of {n(cover.priced)}
          </dd>
        </div>
      </dl>
      <p className="gf-hint">
        Over the {n(price.count)} half-hours with a price in the window; the mean is not weighted by volume.{' '}
        {sides.both === 0
          ? 'No buy price is held in this window.'
          : sides.differ === 0
            ? `The buy price equals the sell price in all ${n(sides.both)} of them, so one line draws both.`
            : `The buy price differs from the sell price in ${n(sides.differ)} of ${n(sides.both)}, so both are drawn.`}
      </p>
      {codes.length > 0 && <p className="gf-hint">Price derivation code {listText(codes)} half-hours.</p>}
    </>
  )
}
