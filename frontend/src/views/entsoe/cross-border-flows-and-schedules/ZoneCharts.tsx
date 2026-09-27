/**
 * The main panel of the net positions: one panel per continental zone,
 * stacked on the window's clock, each with its own scale. ENTSO-E publishes
 * a zone's net position as a positive number, naming the zone as the in area
 * or as the out area, so each panel draws the two sides as two lines, both at
 * or above zero, in the sides' colours: never one signed line, as which side
 * is the export isn't confirmed. Select a zone in the key to draw it alone.
 * In the Table view, the rows (`ZoneTable`).
 */
import { windowDomain } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { ErrorWords } from '../../_template/panels'
import type { PageContext } from '../../define'
import { OUT_SIDE_KEY, zonePanel, zonesOf } from './model'
import { zoneMissingSentence } from './words'
import { ZoneTable } from './ZoneTable'

export function ZoneCharts({ ctx }: { ctx: PageContext }) {
  if (ctx.mode === 'table') return <ZoneTable ctx={ctx} />
  const zones = zonesOf(ctx)
  const w = ctx.window
  const focus = zones.find((z) => z.id === ctx.focus)
  const panels = (focus ? [focus] : zones).map((z) => zonePanel(z, Boolean(focus))).filter((p) => p !== null)
  if (!w || !panels.length) return <p className="gf-state">Rows are held for this window, but no zone holds a value to draw.</p>
  const outside = ctx.related[OUT_SIDE_KEY]
  return (
    <>
      <SeriesChart panels={panels} domain={windowDomain(w.start, w.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      <p className="gf-hint">
        {zoneMissingSentence(zones, w)} {focus ? '' : 'Each zone has a scale of its own. '}Both sides are drawn at or above zero, as published: the sign is unconfirmed, so they aren’t netted into one line.
      </p>
      {(outside?.state === 'error' || outside?.state === 'refreshing') && (
        <p className="gf-hint">
          The zones named as the out area couldn’t be read, so only the other side is drawn. <ErrorWords error={outside.error} />
        </p>
      )}
    </>
  )
}
