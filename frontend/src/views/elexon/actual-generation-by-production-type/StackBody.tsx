/**
 * The main panel for both datasets. Chart: every production type held,
 * stacked in the Generation mix screen's order, in GW, offshore wind and oil
 * hatched; a type selected in the key is drawn alone with its highest and
 * lowest half-hour labelled. Table: the template's table, a column per type
 * in MW, with the settlement day and period the rows carry.
 */
import { Fragment } from 'react'
import { instantLabel, windowDomain } from '../../../design/time'
import { SeriesBody } from '../../_template/SeriesBody'
import { SeriesChart } from '../../_template/SeriesChart'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { zeroRuns } from './figures'
import { Hatch } from './Hatch'
import { AXIS_WIDTH, fillOf, focusedDef, heldTypes, typeOf, unknownTypes } from './types'

const listWords = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''))

export function StackBody({ ctx, height }: { ctx: PageContext; height: number }) {
  const model = ctx.series
  if (!model || !ctx.window) return null
  if (ctx.mode === 'table') return <SeriesBody ctx={ctx} />
  const held = heldTypes(model)
  if (!held.length) return <p className="gf-state">Rows are held for this window, but none holds a figure to draw. The table lists them.</p>
  const focus = focusedDef(model, ctx.focus)
  // A pattern can't colour a line or a label, so a focused hatched type is drawn in its band's colour.
  const series = held.map((d) => (focus && d.key === focus.key ? d : { ...d, color: fillOf(d) }))
  const unknown = unknownTypes(model)
  const means = model.bucketed && model.stepMs ? meansText(model.stepMs) : null
  const order = held.map((d) => (typeOf(d.group)?.prose ?? d.label) + (d.group === 'Wind Offshore' || d.group === 'Fossil Oil' ? ' (hatched)' : ''))
  const runs = zeroRuns(model)
  const zeroCount = runs.reduce((a, r) => a + r.n, 0)
  const step = model.stepMs ?? 0
  return (
    <>
      {runs.length > 0 && (
        <div className="gf-notes">
          <p>
            At {zeroCount.toLocaleString('en-GB')} {model.bucketed ? 'periods' : 'half-hours'} in this window every type but wind and solar holds exactly zero:{' '}
            {runs.map((r) => `${instantLabel(r.start)} to ${instantLabel(r.last + step)}`).join('; ')}. The rows don’t say why; the stack draws them as held, and the panel below sets FUELHH against them.
          </p>
        </div>
      )}
      <Hatch />
      <SeriesChart
        panels={[
          {
            rows: model.rows,
            series,
            mark: 'stacked',
            unit: held[0].unit,
            stepMs: model.stepMs,
            bucketed: model.bucketed,
            settlement: model.settlement,
            height,
            zero: true,
            extremes: focus ?? null,
            axisWidth: AXIS_WIDTH,
          },
        ]}
        domain={windowDomain(ctx.window.start, ctx.window.end)}
        focus={ctx.focus}
        fixture={ctx.fixture}
      />
      <p className="gf-hint">
        {focus ? `${focus.label} alone` : `Stacked, bottom up: ${listWords(order)}`}, {means ? `as ${means}` : 'one figure per half-hour'}. A half-hour with no figure held is a gap.
        {unknown.length > 0 && (
          <>
            {' '}
            Types this page has no colour for are drawn at the top of the stack:{' '}
            {unknown.map((d, i) => (
              <Fragment key={d.key}>
                {i > 0 && ', '}
                <code>{d.group}</code>
              </Fragment>
            ))}
            .
          </>
        )}
      </p>
    </>
  )
}
