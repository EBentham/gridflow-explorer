/**
 * The key: every series the main chart draws, with its mark and its latest
 * value, in two groups (offered and bid; accepted). Select one to draw it on
 * its own. Then the window's figures: the most accepted on each side in one
 * half-hour, with when, and how many half-hours each part of the rows holds,
 * as the volumes can be missing where the indicated imbalance is held. Every
 * figure is read from the series model the template built; nothing is
 * summed across a gap.
 */
import { KeyList, type KeyMark } from '../../../design/charts'
import { stepNoun } from '../../../design/time'
import { extremesOf, latestValue, periodName, seriesId, type SeriesDef } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { ACCEPTED, ACC_BID, ACC_OFFER, IMBALANCE, OFFER, OFFERED, heldOf, seriesOf } from './figures'

function markOf(d: SeriesDef, bars: boolean): KeyMark {
  if (!bars) return { kind: 'line', color: d.color }
  return { kind: 'bars', color: d.color, shape: (d.max ?? 0) > 0 ? 'rise' : 'fall' }
}

function Group({ ctx, heading, defs, bars, stamp }: { ctx: PageContext; heading: string; defs: SeriesDef[]; bars: boolean; stamp: number | null }) {
  const model = ctx.series
  if (!model || !defs.length) return null
  // Table view draws no chart to focus, so the key only lists there.
  const pickable = ctx.mode === 'chart'
  return (
    <>
      <p className="gf-hint">{heading}</p>
      <ul className="gf-series-key">
        {defs.map((d) => {
          const id = seriesId(d)
          const latest = latestValue(model, d)
          const on = ctx.focus === id
          return (
            <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <KeyList items={[{ key: id, mark: markOf(d, bars && ctx.mode === 'chart'), label: <span className="gf-series-name">{d.label}</span> }]} />
                <span className="gf-series-value">{latest ? d.unit.format(latest.v) : '–'}</span>
              </button>
              {latest && latest.t !== stamp && <span className="gf-series-when">{periodName(latest.t, model.stepMs, model.settlement)}</span>}
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function DepthKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model || !ctx.window || !model.drawn.length) return <p className="gf-hint">Nothing is held in this window, so there is nothing to key.</p>
  const held = (cols: string[]) => cols.map((c) => seriesOf(model, c)).filter((d): d is SeriesDef => d !== undefined && d.count > 0)
  const offered = held(OFFERED)
  const accepted = held(ACCEPTED)
  const offer = seriesOf(model, OFFER)
  const first = offered[0] ?? accepted[0]
  const stampAt = first ? latestValue(model, first) : null
  const stamp = stampAt?.t ?? null
  const step = model.stepMs
  const noun = model.bucketed && step ? meansText(step) : stepNoun(step)
  const when = (t: number) => periodName(t, step, model.settlement)
  const accOffer = seriesOf(model, ACC_OFFER)
  const accBid = seriesOf(model, ACC_BID)
  const mostOffer = accOffer ? extremesOf(model.rows, accOffer)?.high : null
  // Bids are published below zero: the most accepted is the lowest value.
  const mostBid = accBid ? extremesOf(model.rows, accBid)?.low : null
  const counts = [
    { label: 'Indicated imbalance', h: heldOf(model, ctx, seriesOf(model, IMBALANCE)) },
    { label: 'Offer and bid volumes', h: heldOf(model, ctx, offer) },
    { label: 'Accepted volumes', h: heldOf(model, ctx, accOffer) },
  ]
  const n = (x: number) => x.toLocaleString('en-GB')

  return (
    <>
      <Group ctx={ctx} heading="Offered and bid" defs={offered} bars stamp={stamp} />
      <Group ctx={ctx} heading="Accepted" defs={accepted} bars={false} stamp={stamp} />
      {stamp !== null && (
        <p className="gf-hint">
          {model.bucketed ? 'Means' : 'Values'} for {when(stamp)}, the latest held{offered.length || accepted.length ? '; a value held at another time names its own' : ''}.
          {ctx.mode === 'chart' && (ctx.focus ? ' Select it again to draw them all.' : ' Select a series to draw it on its own.')}
        </p>
      )}
      {!offered.length && !accepted.length && <p className="gf-hint">No offer, bid or accepted volume is held in this window.</p>}
      <dl className="gf-stats">
        {mostOffer && accOffer && (
          <div>
            <dt>{model.bucketed ? 'Most accepted offers, as a mean' : 'Most accepted offers'}</dt>
            <dd>
              {accOffer.unit.format(mostOffer.v)}
              <span className="gf-stat-when">{when(mostOffer.t)}</span>
            </dd>
          </div>
        )}
        {mostBid && accBid && (
          <div>
            <dt>{model.bucketed ? 'Most accepted bids, as a mean' : 'Most accepted bids'}</dt>
            <dd>
              {accBid.unit.format(mostBid.v)}
              <span className="gf-stat-when">{when(mostBid.t)}</span>
            </dd>
          </div>
        )}
        {counts.map(({ label, h }) => (
          <div key={label}>
            <dt>{label} held</dt>
            <dd>{h.expected === null ? n(h.held) : `${n(h.held)} of ${n(h.expected)}`}</dd>
          </div>
        ))}
      </dl>
      <p className="gf-hint">
        In MWh, as published, over the {noun} of {ctx.windowText}. Held counts the {noun} with a value; the rest are gaps, not zeros.
      </p>
    </>
  )
}
