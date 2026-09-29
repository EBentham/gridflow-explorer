/**
 * The main panel. Chart: two panels on one clock, one tooltip cursor across
 * them. The first holds the offer and bid volumes per half-hour as bars, bids
 * below zero as Elexon publishes them; the second the volumes accepted, total
 * and priced, offers above zero and bids below, as lines. They sit apart
 * because the volumes offered and bid are far larger than the volumes
 * accepted: on one axis the accepted lines would lie flat on zero. Table: the
 * template's table of every column. Both say where the local rows run when
 * they run on some days only, and which parts of the rows the window holds
 * less of than others.
 */
import { plural } from '../../../design/format'
import { datesBetween, dayStart, londonMidnight, rangeText, stepNoun, windowDomain } from '../../../design/time'
import { SeriesBody } from '../../_template/SeriesBody'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { ACCEPTED, ACC_OFFER, AXIS_WIDTH, IMBALANCE, OFFER, OFFERED, heldOf, seriesOf } from './figures'

/**
 * Where the local rows run, said only when this window has a day inside
 * them that holds no row: those gaps are local, not the publisher's. When the
 * window takes in the whole local span, the template's own line already
 * gives the count, so this says only what the gaps are.
 */
export function DepthWords({ ctx }: { ctx: PageContext }) {
  const c = ctx.dataset.coverage
  const model = ctx.series
  if (!c?.first_day || !c.last_day || c.day_count === null || !ctx.window || !model) return null
  const span = datesBetween(c.first_day, c.last_day).length
  if (c.day_count >= span) return null
  const held = new Set<number>()
  for (const row of model.rows) if (model.all.some((d) => typeof row[d.field] === 'number')) held.add(londonMidnight(row.t))
  const first = c.first_day
  const last = c.last_day
  const inside = datesBetween(ctx.window.start, ctx.window.end).filter((d) => d >= first && d <= last)
  if (!inside.some((d) => !held.has(dayStart(d)))) return null
  if (ctx.window.start <= c.first_day && ctx.window.end >= c.last_day) {
    return <p className="gf-hint">The days without rows are not fetched locally, and show as gaps.</p>
  }
  return (
    <p className="gf-hint">
      gridflow holds this dataset locally on {plural(c.day_count, 'day', 'days')} of the {span} from {rangeText(c.first_day, c.last_day).replace(' – ', ' to ')}. The other days are not fetched locally and show as gaps.
    </p>
  )
}

/** Which parts of the rows the window holds less of: the volumes can be missing where the indicated imbalance is held. */
function HeldWords({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model) return null
  const imbalance = heldOf(model, ctx, seriesOf(model, IMBALANCE))
  const offered = heldOf(model, ctx, seriesOf(model, OFFER))
  const accepted = heldOf(model, ctx, seriesOf(model, ACC_OFFER))
  if (offered.held === imbalance.held && accepted.held === imbalance.held) return null
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const n = (x: number) => x.toLocaleString('en-GB')
  return (
    <p className="gf-hint">
      This window holds the indicated imbalance for {n(imbalance.held)} {noun}, but the offer volume for {n(offered.held)} and the accepted offers for {n(accepted.held)}. The rest are gaps, not zeros; the days table
      below names the days.
    </p>
  )
}

export function DepthChart({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model || !ctx.window) return null
  if (ctx.mode === 'table') {
    return (
      <>
        <SeriesBody ctx={ctx} />
        <DepthWords ctx={ctx} />
      </>
    )
  }
  const common = { rows: model.rows, stepMs: model.stepMs, bucketed: model.bucketed, settlement: model.settlement, axisWidth: AXIS_WIDTH, zero: true }
  const offered = OFFERED.map((c) => seriesOf(model, c)).filter((d) => d !== undefined && d.count > 0) as NonNullable<ReturnType<typeof seriesOf>>[]
  const accepted = ACCEPTED.map((c) => seriesOf(model, c)).filter((d) => d !== undefined && d.count > 0) as NonNullable<ReturnType<typeof seriesOf>>[]
  const panels: ChartPanel[] = []
  if (offered.length) panels.push({ ...common, series: offered, mark: 'bars', unit: offered[0].unit, height: 260 })
  if (accepted.length) panels.push({ ...common, series: accepted, mark: 'line', unit: accepted[0].unit, height: 260 })

  return (
    <>
      {panels.length > 0 ? (
        <SeriesChart panels={panels} domain={windowDomain(ctx.window.start, ctx.window.end)} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      ) : (
        <p className="gf-state">This window holds the indicated imbalance only: no offer, bid or accepted volume. The working panel draws the imbalance, and the table lists it.</p>
      )}
      <p className="gf-hint">
        Offered and bid above, accepted below, each on its own axis in MWh. Bids are published below zero and drawn as published.
      </p>
      <HeldWords ctx={ctx} />
      <DepthWords ctx={ctx} />
    </>
  )
}
