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
import { MW, PRICE_KEY, flatLevel, focusedLine, linePanel, priceCover, pricePanel, priceSeries, stackPanel, unitLines, unitShown } from './figures'
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
  const flat = flatLevel(alone)
  const period = model.bucketed ? 'period' : 'half-hour'
  const flatText = flat === null ? '' : `${MW.format(flat)} in every ${period} it holds`
  // Without `?unit=` the key lists every unit under its fuel, so the chart takes the height to stand beside it, and a unit
  // selected there keeps that height, so the page doesn't jump. A level that never moves gets a panel under 200px, which
  // asks the axis for 3 ticks: whole MW, not a made-up 0.5 MW scale.
  const tall = !one
  const top = alone ? linePanel(model, alone, flat !== null ? 150 : tall ? 620 : 380) : stackPanel(model, lines, 620)
  const price = priceSeries(ctx)
  const rel = ctx.related[PRICE_KEY]
  const panels = price ? [top, pricePanel(price, tall ? 200 : 170)] : [top]
  const means = model.bucketed && model.stepMs ? ` Each point is a mean of the start levels in its period, as the window is read as ${meansText(model.stepMs)}.` : ''
  const banded = price && price.def.min !== null && price.def.min < 0
  // A price held for part of the window is said in words: its line simply stops.
  const cover = price ? priceCover(price, w) : null
  const priceNoun = price?.model.bucketed && price.model.stepMs ? meansText(price.model.stepMs) : 'half-hours'
  const thin = cover && cover.held < cover.expected ? ` The price is held for ${cover.held.toLocaleString('en-GB')} of the window’s ${cover.expected.toLocaleString('en-GB')} ${priceNoun}.` : ''
  return (
    <>
      <SeriesChart panels={panels} domain={windowDomain(w.start, w.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      <p className="gf-hint">
        {one
          ? `${one}’s notified level at the start of each half-hour, in MW${flatText ? `: ${flatText}` : ''}.`
          : focus
            ? `${focus.id} alone, in MW: its notified level at the start of each half-hour${flatText ? `, ${flatText}` : ''}. Select it again in the key to draw all ${lines.length}.`
            : `Each band is one unit’s notified level at the start of each half-hour, in GW, coloured by its fuel and stacked fuel by fuel. The top of the stack is the sum of these ${lines.length} units only, where every one of them holds a level, not GB’s total.`}
        {means} A gap is a half-hour with no level held.
        {price ? ` Under it, the market index price on the same clock${banded ? ', its runs below zero banded' : ''}.${thin}` : ''}
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
