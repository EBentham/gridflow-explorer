/**
 * The main panel. Chart: the readings stacked in the Generation mix
 * screen's nine bands, in GW, pumping and net exports below zero; a band
 * selected in the key is drawn alone; a click picks the day the panel below
 * reads. Table: every reading, a column per fuel code as held, in MW.
 */
import { Fragment } from 'react'
import { windowDomain } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, fold, unknownCodes } from './fuels'
import { InstTable } from './InstTable'

export function InstBody({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const folded = model ? fold(model) : null
  if (!model || !ctx.window) return null
  if (ctx.mode === 'table') return <InstTable ctx={ctx} />
  const bands = folded?.bands.filter((b) => b.count > 0) ?? []
  if (!folded || !bands.length) return <p className="gf-state">Rows are held for this window, but none holds a reading to draw. The table lists them.</p>
  const multiDay = ctx.window.start !== ctx.window.end
  const unknown = unknownCodes(model)
  const means = model.bucketed && model.stepMs ? meansText(model.stepMs) : null
  return (
    <>
      <SeriesChart
        panels={[
          {
            rows: folded.rows,
            series: bands,
            mark: 'stacked',
            unit: folded.unit,
            // Native readings are named by their stamp, an instant: a five-minute window from it would run five minutes late.
            stepMs: model.bucketed ? model.stepMs : null,
            bucketed: model.bucketed,
            height: 460,
            zero: true,
            axisWidth: AXIS_WIDTH,
          },
        ]}
        domain={windowDomain(ctx.window.start, ctx.window.end)}
        focus={ctx.focus ? `self/${ctx.focus}` : undefined}
        picked={ctx.picked}
        onPick={ctx.pick}
        fixture={ctx.fixture}
      />
      <p className="gf-hint">
        {means
          ? `Each point is a mean of the readings stamped in its period, as the window is read as ${means}.`
          : 'Each point is one reading, drawn at its stamp: five minutes after the start of the five minutes it covers.'}{' '}
        OCGT, coal and oil make up peaking; every interconnector makes up net imports, which sit below zero when GB exports, as pumped storage does while it pumps.
        {unknown.length > 0 && (
          <>
            {' '}
            Codes this page doesn’t know are added to other:{' '}
            {unknown.map((c, i) => (
              <Fragment key={c}>
                {i > 0 && ', '}
                <code>{c}</code>
              </Fragment>
            ))}
            .
          </>
        )}{' '}
        A gap is a time with no reading held.
        {multiDay ? ' Click a day to read it in the panel below.' : ''}
      </p>
    </>
  )
}
