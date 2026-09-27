/**
 * The pilot's key panel: the price line's mark (and the band, when a run
 * went below zero), the latest half-hour held with its price and volume
 * named by its settlement period, then the window's range, highest, lowest
 * and mean price, and how many half-hours went below zero. Every figure is
 * read from the series model the template built (`ctx.series`); the mean is
 * of the held half-hours, unweighted, and the panel says so.
 */
import { KeyList, type KeyItem } from '../../../design/charts'
import { money } from '../../../design/format'
import { stepNoun } from '../../../design/time'
import { extremesOf, latestValue, periodName } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { PRICE, VOLUME, seriesOf } from './figures'

export function PriceKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const price = seriesOf(model, PRICE)
  const volume = seriesOf(model, VOLUME)
  if (!model || !ctx.window || !price || !price.count || price.mean === null || price.min === null || price.max === null) {
    return <p className="gf-hint">No price is held in this window, so there is nothing to key.</p>
  }
  const step = model.stepMs
  // Bucket means (a window past one read) name no settlement period and aren't half-hours.
  const noun = model.bucketed && step ? meansText(step) : stepNoun(step)
  const latest = latestValue(model, price)
  const latestVolume = latest && volume ? model.rows.find((r) => r.t === latest.t)?.[volume.field] : null
  const ex = extremesOf(model.rows, price)
  const below = model.rows.filter((r) => {
    const v = r[price.field]
    return typeof v === 'number' && v < 0
  }).length
  const items: KeyItem[] = [{ key: 'price', mark: { kind: 'line', color: price.color, dashed: ctx.fixture }, label: `${price.label}, ${price.unit.label ?? 'unit unconfirmed'}` }]
  // The band marks runs on the chart; the Table view draws none, so it isn't keyed there.
  if (below > 0 && ctx.mode === 'chart') items.push({ key: 'below', mark: { kind: 'band' }, label: `${price.label} below zero` })
  const when = (t: number) => periodName(t, step, model.settlement)

  return (
    <>
      <KeyList items={items} />
      {latest && (
        <>
          <dl className="gf-stats">
            <div>
              <dt>{model.bucketed ? 'Latest mean price' : 'Latest price'}</dt>
              <dd>{money(latest.v, 2)}</dd>
            </div>
            {volume && (
              <div>
                <dt>{model.bucketed ? 'Mean volume' : 'Volume'}</dt>
                <dd>{typeof latestVolume === 'number' ? volume.unit.format(latestVolume) : 'not held'}</dd>
              </div>
            )}
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
            {below.toLocaleString('en-GB')} of {price.count.toLocaleString('en-GB')}
          </dd>
        </div>
      </dl>
      <p className="gf-hint">
        In {price.unit.label ?? 'the unit as published'}, over the {price.count.toLocaleString('en-GB')} {noun} held in the window. The mean is of those {noun}, not weighted by volume.
      </p>
    </>
  )
}
