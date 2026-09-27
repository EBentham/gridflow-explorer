/**
 * The main panel of the flows and the schedules: one panel per border,
 * stacked on the window's clock, each with its own scale (GB–France runs to
 * about 3,000 MW where GB–Ireland (SEM) stays under 300, so one axis would
 * flatten the smaller borders). On GB's borders the other dataset is drawn
 * beside each border's own line. Select a border in the key to draw it
 * alone, full height, with its highest and lowest labelled. Under the chart:
 * each border's step as held, and the days a border misses steps on. In the
 * Table view, the rows (`BorderTable`).
 */
import { windowDomain } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { ErrorWords } from '../../_template/panels'
import type { PageContext } from '../../define'
import { areaName } from './areas'
import { BorderTable } from './BorderTable'
import { besideState, borderPanel, bordersOf, roleOf } from './model'
import { cadenceSentence, missingSentence } from './words'

export function BorderCharts({ ctx }: { ctx: PageContext }) {
  if (ctx.mode === 'table') return <BorderTable ctx={ctx} />
  const role = roleOf(ctx)
  const borders = bordersOf(ctx)
  const w = ctx.window
  const focus = borders.find((b) => b.id === ctx.focus)
  const panels = (focus ? [focus] : borders).map((b) => borderPanel(b, role, Boolean(focus))).filter((p) => p !== null)
  if (!w || !panels.length) return <p className="gf-state">Rows are held for this window, but no border holds a value to draw.</p>
  const beside = besideState(ctx)
  const rel = ctx.related[role.besideKey]
  const named = borders.map((b) => ({ name: b.name, line: b.own }))
  return (
    <>
      <SeriesChart panels={panels} domain={windowDomain(w.start, w.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      <p className="gf-hint">
        {cadenceSentence(named)} {missingSentence(named, w)} {focus ? '' : 'Each border has a scale of its own. '}A missing step breaks its line.
      </p>
      {beside === 'other-area' && (
        <p className="gf-hint">
          The {role.beside} is read for GB’s borders only, so none is drawn beside the pairs with {areaName(borders[0]?.inArea)} as the in area.
        </p>
      )}
      {beside === 'error' && rel && (
        <p className="gf-hint">
          The {role.beside} isn’t drawn beside these borders. <ErrorWords error={rel.error} />
        </p>
      )}
    </>
  )
}
