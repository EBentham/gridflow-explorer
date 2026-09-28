/**
 * The main panel. In the Chart view, by default, the top units' notified
 * levels at the start of each half-hour, stacked fuel by fuel in GW, with
 * the market index price under them on the same clock; a unit selected in
 * the key is drawn alone, in MW, with its highest and lowest labelled. With
 * one unit asked for (`?unit=`), its line in MW, the price under it. In the
 * Table view, the rows (`LevelsTable`).
 */
import { windowDomain } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { ErrorWords } from '../../_template/panels'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { PRICE_KEY, focusedLine, linePanel, pricePanel, priceSeries, stackPanel, unitLines, unitShown } from './figures'
import { LevelsTable } from './LevelsTable'

export function LevelsMain({ ctx }: { ctx: PageContext }) {
  if (ctx.mode === 'table') return <LevelsTable ctx={ctx} />
  const model = ctx.series
  const w = ctx.window
  const lines = unitLines(ctx).filter((l) => l.def.count > 0)
  if (!model || !w || !lines.length) return <p className="gf-state">Rows are held for this window, but none holds a start level to draw. The table lists them.</p>
  const one = unitShown(ctx)
  const focus = focusedLine(ctx, lines)
  const alone = one ? lines[0] : focus
  const top = alone ? linePanel(model, alone, 380) : stackPanel(model, lines, 420)
  const price = priceSeries(ctx)
  const rel = ctx.related[PRICE_KEY]
  const panels = price ? [top, pricePanel(price, 170)] : [top]
  const means = model.bucketed && model.stepMs ? ` Each point is a mean of the start levels in its period, as the window is read as ${meansText(model.stepMs)}.` : ''
  const banded = price && price.def.min !== null && price.def.min < 0
  return (
    <>
      <SeriesChart panels={panels} domain={windowDomain(w.start, w.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      <p className="gf-hint">
        {one
          ? `${one}’s notified level at the start of each half-hour, in MW.`
          : focus
            ? `${focus.id} alone, in MW: its notified level at the start of each half-hour. Select it again in the key to draw all ${lines.length}.`
            : `Each band is one unit’s notified level at the start of each half-hour, in GW, coloured by its fuel and stacked fuel by fuel. The top of the stack is the sum of these ${lines.length} units only, not GB’s total.`}
        {means} A gap is a half-hour with no level held.
        {price ? ` Under it, the market index price on the same clock${banded ? ', its runs below zero banded' : ''}.` : ''}
      </p>
      {!price && rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          The market index price couldn’t be read, so none is drawn under the levels. <ErrorWords error={rel.error} />
        </p>
      )}
      {!price && rel && rel.state !== 'error' && rel.state !== 'refreshing' && <p className="gf-hint">No market index price is held in this window, so none is drawn under the levels.</p>}
    </>
  )
}
