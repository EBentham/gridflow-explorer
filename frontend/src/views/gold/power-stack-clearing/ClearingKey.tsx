/**
 * The clearing view's key: the chart's marks; the latest half-hour holding a
 * modelled price, with the market index beside it and what set the price;
 * the window's means and the mean gap between the model and the market; and
 * how many half-hours each fuel, or the price floor, set the price in. Every
 * figure is read from the rows; a mean says how many half-hours it is of.
 */
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KeyList, type KeyItem } from '../../../design/charts'
import { listText, money, plural } from '../../../design/format'
import { ukDate } from '../../../design/time'
import { periodName } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import {
  FLOOR_STYLE,
  MARKET_COLOR,
  MODEL_COLOR,
  clearingPoints,
  curveHeld,
  curveSearch,
  floorMatchesNegativeDemand,
  floorPrices,
  floorRuns,
  fuelWords,
  gapOf,
  meanOf,
  ownRows,
  priceScale,
  relatedRows,
  setterCounts,
  setterOf,
} from './figures'

const pct = (n: number, of: number) => `${Math.round((n / of) * 100)}%`

export function ClearingKey({ ctx }: { ctx: PageContext }) {
  const [params] = useSearchParams()
  const rows = ownRows(ctx)
  const market = relatedRows(ctx, 'market')
  const points = useMemo(() => clearingPoints(rows, market), [rows, market])
  const model = ctx.series
  if (!model || !points.some((p) => p.model !== null)) {
    return <p className="gf-hint">No modelled price is held in this window, so there is nothing to key.</p>
  }
  const chart = ctx.mode === 'chart'
  const runs = floorRuns(points, model.stepMs)
  const { clipped } = priceScale(points, ctx.param('scale') === 'full')
  const counts = setterCounts(points)
  const setTotal = counts.reduce((s, c) => s + c.n, 0)
  const atFloor = points.filter((p) => p.atFloor === true).length
  const floors = floorPrices(points.filter((p) => p.atFloor === true))
  const floorText = floors.length ? listText(floors.map((v) => `${money(v, 2)}/MWh`)) : null
  const latest = [...points].reverse().find((p) => p.model !== null)
  const when = (t: number) => periodName(t, model.stepMs, model.settlement)
  const modelMean = meanOf(points.map((p) => p.model))
  const marketMean = meanOf(points.map((p) => p.market))
  const gapAll = meanOf(points.map(gapOf))
  const gapStack = meanOf(points.filter((p) => p.atFloor === false).map(gapOf))
  const noun = model.bucketed ? 'periods' : 'half-hours'
  const unknownBars = points.some((p) => p.demand !== null && !setterOf(p))

  const items: KeyItem[] = [
    { key: 'market', mark: { kind: 'line', color: MARKET_COLOR, dashed: ctx.fixture }, label: 'Market index price, £/MWh' },
    { key: 'model', mark: { kind: 'line', color: MODEL_COLOR, dashed: ctx.fixture }, label: 'Modelled price, £/MWh' },
  ]
  if (chart && runs.length) items.push({ key: 'floor', mark: { kind: 'band' }, label: 'The price floor set the modelled price' })

  const latestSetter = latest ? setterOf(latest) : null

  return (
    <>
      <KeyList items={items} />
      {latest && latest.model !== null && (
        <>
          <dl className="gf-stats">
            <div>
              <dt>Latest modelled price</dt>
              <dd>{money(latest.model, 2)}</dd>
            </div>
            <div>
              <dt>Market index price</dt>
              <dd>{latest.market === null ? 'not held' : money(latest.market, 2)}</dd>
            </div>
            <div>
              <dt>Set by</dt>
              <dd>
                {latest.atFloor === true ? (
                  FLOOR_STYLE.label
                ) : latest.unit ? (
                  <>
                    <code>{latest.unit}</code>
                    <span className="gf-stat-when">a {fuelWords(latest.fuel)} unit</span>
                  </>
                ) : (
                  (latestSetter?.style.label ?? 'not named')
                )}
              </dd>
            </div>
          </dl>
          <p className="gf-hint">
            For {when(latest.t)}, the latest held.{' '}
            {curveHeld(ctx) && !model.bucketed && (
              <Link className="gf-view-link gf-stack-link" to={{ search: curveSearch(params, ukDate(latest.t), latest.t) }}>
                Its supply curve
              </Link>
            )}
          </p>
        </>
      )}
      <dl className="gf-stats">
        <div>
          <dt>Modelled price, mean</dt>
          <dd>
            {modelMean.mean === null ? '–' : money(modelMean.mean, 2)}
            <span className="gf-stat-when">of {plural(modelMean.n, noun.replace(/s$/, ''), noun)}</span>
          </dd>
        </div>
        <div>
          <dt>Market index price, mean</dt>
          <dd>
            {marketMean.mean === null ? '–' : money(marketMean.mean, 2)}
            <span className="gf-stat-when">of {plural(marketMean.n, noun.replace(/s$/, ''), noun)}</span>
          </dd>
        </div>
        {gapAll.mean !== null && (
          <div>
            <dt>Modelled minus market</dt>
            <dd>
              {money(gapAll.mean, 2)}
              <span className="gf-stat-when">mean of the {plural(gapAll.n, noun.replace(/s$/, ''), noun)} both hold</span>
            </dd>
          </div>
        )}
        {gapStack.mean !== null && gapStack.n < gapAll.n && (
          <div>
            <dt>Where a unit set it</dt>
            <dd>
              {money(gapStack.mean, 2)}
              <span className="gf-stat-when">modelled minus market, mean of {plural(gapStack.n, noun.replace(/s$/, ''), noun)}</span>
            </dd>
          </div>
        )}
      </dl>
      {counts.length > 0 && (
        <>
          <p className="gf-hint gf-stack-lead">
            {chart ? 'What set the price, and the colour of the clearing demand bars under the prices:' : 'What set the price:'}
          </p>
          <dl className="gf-stats gf-stack-counts">
            {counts.map((c) => (
              <div key={c.key}>
                <dt>
                  <span className="gf-swatch gf-stack-swatch" style={{ background: c.style.color }} aria-hidden="true" />
                  {c.style.label}
                </dt>
                <dd>
                  {c.n.toLocaleString('en-GB')}
                  <span className="gf-stack-share">{pct(c.n, setTotal)}</span>
                </dd>
              </div>
            ))}
            {chart && unknownBars && (
              <div>
                <dt>
                  <span className="gf-swatch gf-stack-swatch" style={{ background: 'var(--chart-grid-strong)' }} aria-hidden="true" />
                  Not named in the rows
                </dt>
                <dd>–</dd>
              </div>
            )}
          </dl>
          <p className="gf-hint">Counts of the {plural(setTotal, 'half-hour', 'half-hours')} whose rows name what set the price, with each one’s share.</p>
        </>
      )}
      {atFloor > 0 && (
        <p className="gf-hint">
          The price floor{floorText ? `, ${floorText},` : ''} set the modelled price in {plural(atFloor, 'half-hour', 'half-hours')}
          {floorMatchesNegativeDemand(points) ? ': each one where the clearing demand was below zero, and no other.' : '.'}
          {chart && clipped ? ' On the stack-price axis the line runs off the foot of the chart there; choose Whole range to draw it in full.' : ''}
        </p>
      )}
    </>
  )
}
