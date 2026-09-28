/**
 * The key panel: the price line's mark, the volume bars' and the band's
 * (when a run went below zero); the latest half-hour held, named by its
 * settlement period; then the window's range, highest, lowest, mean, the
 * mean weighted by volume, and how many half-hours went below zero. Every
 * figure is read from the rows (`ctx.series`), and the panel says what each
 * mean is of.
 */
import { KeyList, type KeyItem } from '../../../design/charts'
import { money, plural } from '../../../design/format'
import { stepNoun } from '../../../design/time'
import { extremesOf, latestValue, periodName } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { PRICE, VOLUME, seriesOf, volumeWeighted } from './figures'

export function BenchmarkKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const price = seriesOf(model, PRICE)
  const volume = seriesOf(model, VOLUME)
  if (!model || !ctx.window || !price || !price.count || price.mean === null || price.min === null || price.max === null) {
    return <p className="gf-hint">No benchmark price is held in this window, so there is nothing to key.</p>
  }
  const step = model.stepMs
  const noun = model.bucketed && step ? meansText(step) : stepNoun(step)
  const latest = latestValue(model, price)
  const latestVolume = latest && volume ? model.rows.find((r) => r.t === latest.t)?.[volume.field] : null
  const ex = extremesOf(model.rows, price)
  const weighted = volume ? volumeWeighted(model, price, volume) : null
  const below = model.rows.filter((r) => {
    const v = r[price.field]
    return typeof v === 'number' && v < 0
  }).length
  const items: KeyItem[] = [{ key: 'price', mark: { kind: 'line', color: price.color, dashed: ctx.fixture }, label: `${price.label}, ${price.unit.label ?? 'unit unconfirmed'}` }]
  if (volume && volume.count > 0 && ctx.mode === 'chart') {
    items.push({ key: 'volume', mark: { kind: 'bars', color: volume.color, shape: 'rise' }, label: `${volume.label}, ${volume.unit.label ?? 'unit unconfirmed'}` })
  }
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
        {weighted && (
          <div>
            <dt>Mean by volume</dt>
            <dd>{money(weighted.v, 2)}</dd>
          </div>
        )}
        <div>
          <dt>Below zero</dt>
          <dd>
            {below.toLocaleString('en-GB')} of {price.count.toLocaleString('en-GB')}
          </dd>
        </div>
      </dl>
      <p className="gf-hint">
        In {price.unit.label ?? 'the unit as published'}, over the {price.count.toLocaleString('en-GB')} {noun} held in the window. The mean counts each of them once.
        {weighted
          ? ` The mean by volume weights each price by the volume traded in it, over the ${plural(weighted.n, 'half-hour', 'half-hours')} holding both.`
          : model.bucketed
            ? ' The window is read as means, so no mean by volume is given.'
            : ''}
      </p>
    </>
  )
}
