/**
 * The main panel: one panel per border, stacked on the window's clock, each
 * with its own scale (GB–France runs to about 4,000 MW where GB–Ireland
 * (SEM) stays near 1,000, so one axis would flatten the smaller borders). On
 * GB's borders the other measures are drawn under the page's own, each in
 * its measure's colour. Select a border in the key to draw it alone, full
 * height, with its highest and lowest labelled. Under the chart: each
 * border's step as held, the days a border misses steps on, and the values
 * the chart can't draw. In the Table view, the rows (`BorderTable`).
 */
import { listText } from '../../../design/format'
import { windowDomain } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { ErrorWords } from '../../_template/panels'
import type { PageContext } from '../../define'
import { areaPhrase } from './areas'
import { BorderTable } from './BorderTable'
import { aloneIn, besideOf, besideState, borderPanel, bordersOf, measureOf } from './model'
import { aloneSentence, cadenceSentence, missingSentence } from './words'

export function BorderCharts({ ctx }: { ctx: PageContext }) {
  if (ctx.mode === 'table') return <BorderTable ctx={ctx} />
  const own = measureOf(ctx)
  const borders = bordersOf(ctx)
  const w = ctx.window
  const focus = borders.find((b) => b.id === ctx.focus)
  const shown = focus ? [focus] : borders
  if (!w || !shown.length) return <p className="gf-state">Rows are held for this window, but no border holds a value to draw.</p>
  const panels = shown.map((b) => borderPanel(b, own, Boolean(focus)))
  const named = borders.map((b) => ({ name: b.name, line: b.own }))
  const alone = aloneSentence(shown.map((b) => ({ name: b.name, alone: aloneIn(b) })))
  const besides = besideOf(ctx)
  const otherArea = besides.filter((m) => besideState(ctx, m) === 'other-area')
  const failed = besides.filter((m) => besideState(ctx, m) === 'error')
  return (
    <>
      <SeriesChart panels={panels} domain={windowDomain(w.start, w.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      {own.whenSet ? (
        <p className="gf-hint">
          ENTSO-E publishes a limit only when one is set, so an hour with no limit held may be an hour with no limit, or one not fetched locally: the page can’t tell them
          apart, draws nothing there, and doesn’t call it a gap.{alone ? ` ${alone}` : ''}
        </p>
      ) : (
        <p className="gf-hint">
          {cadenceSentence(named)} {missingSentence(named, w)} {focus || borders.length < 2 ? '' : 'Each border has a scale of its own. '}A missing step breaks its line.
          {alone ? ` ${alone}` : ''}
        </p>
      )}
      {otherArea.length > 0 && (
        <p className="gf-hint">
          The {listText(otherArea.map((m) => m.words))} {otherArea.length > 1 ? 'are' : 'is'} read for GB’s borders only, so none is drawn beside the borders with{' '}
          {areaPhrase(borders[0]?.inArea)} as the in area.
        </p>
      )}
      {failed.map((m) => (
        <p key={m.key} className="gf-hint">
          The {m.words} isn’t drawn beside these borders. <ErrorWords error={ctx.related[m.key]?.error ?? null} />
        </p>
      ))}
    </>
  )
}
