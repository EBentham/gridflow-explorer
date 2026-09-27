/**
 * The main panel. Chart: three panels on one clock, one tooltip cursor
 * across them: the system price per half-hour (the buy price drawn too only
 * where it ever differs from the sell price in the window), with its extremes
 * labelled and its runs below zero banded; the net imbalance volume as bars;
 * then the forecast and actual carbon intensity joined to each half-hour.
 * Where no half-hour in the window carries an intensity, the third panel is
 * not drawn as a flat or empty line: the panel says so in words. Table: the
 * template's series table over the folded rows, one per half-hour, the price
 * derivation code as its last column.
 */
import './page.css'
import { plural } from '../../../design/format'
import { windowDomain } from '../../../design/time'
import { SeriesBody } from '../../_template/SeriesBody'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, CI_ACTUAL, CI_FORECAST, NIV, SBP, SSP, folded, intensityCover, isBucketed, priceSides, seriesOf } from './figures'
import { IntensityWords } from './IntensityWords'

export function ContextChart({ ctx }: { ctx: PageContext }) {
  if (isBucketed(ctx)) {
    return (
      <>
        <p className="gf-state">
          This window is long enough that the rows come as hourly or longer means, and the means come apart by price derivation code: a period whose half-hours carry two codes comes back as two means, and how many half-hours each covers isn't sent. The page won't join them into one line. Choose a shorter window to read every half-hour.
        </p>
        {ctx.mode === 'table' && <SeriesBody ctx={ctx} />}
      </>
    )
  }
  const f = folded(ctx)
  if (!f || !ctx.window) return null
  const clash = f.clashes > 0 && (
    <p className="gf-hint">
      {plural(f.clashes, 'half-hour holds', 'half-hours hold')} a row under two price derivation codes. Neither is chosen: {f.clashes === 1 ? 'it shows' : 'they show'} as a gap.
    </p>
  )
  if (ctx.mode === 'table') {
    return (
      <>
        <SeriesBody ctx={f.ctx} />
        {clash}
      </>
    )
  }

  const model = f.model
  const ssp = seriesOf(model, SSP)
  const sbp = seriesOf(model, SBP)
  const niv = seriesOf(model, NIV)
  const forecast = seriesOf(model, CI_FORECAST)
  const actual = seriesOf(model, CI_ACTUAL)
  const sides = priceSides(model)
  // With the two prices equal throughout, one line is both: it is named the system price.
  const sell = ssp && sides.differ === 0 ? { ...ssp, label: 'System price' } : ssp
  const prices = [sell, sides.differ > 0 ? sbp : undefined].filter((d) => d !== undefined && d.count > 0) as NonNullable<typeof ssp>[]
  const intensities = [forecast, actual].filter((d) => d !== undefined && d.count > 0) as NonNullable<typeof ssp>[]
  const common = { rows: model.rows, stepMs: model.stepMs, bucketed: model.bucketed, settlement: model.settlement, axisWidth: AXIS_WIDTH }
  const panels: ChartPanel[] = []
  if (prices.length) {
    panels.push({ ...common, series: prices, mark: 'line', unit: prices[0].unit, height: 250, extremes: prices[0], belowZero: prices[0].min !== null && prices[0].min < 0 ? prices[0] : null })
  }
  if (niv && niv.count > 0) panels.push({ ...common, series: [niv], mark: 'bars', unit: niv.unit, height: 130, zero: true })
  // Intensity is never below zero, so its axis starts there; a handful of points gets no extremes, whose labels would crowd its caption.
  if (intensities.length) panels.push({ ...common, series: intensities, mark: 'line', unit: intensities[0].unit, height: 170, zero: true, extremes: forecast && forecast.count >= 12 ? forecast : null })

  const cover = intensityCover(model)
  return (
    <>
      {panels.length > 0 ? (
        <div className="gf-imbctx-chart">
          <SeriesChart panels={panels} domain={windowDomain(ctx.window.start, ctx.window.end)} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
        </div>
      ) : (
        <p className="gf-state">Rows are held for this window, but none of their values can be drawn. The table lists them.</p>
      )}
      <IntensityWords ctx={ctx} cover={cover} />
      {clash}
    </>
  )
}
