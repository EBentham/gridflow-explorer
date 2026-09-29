/**
 * The working panel. In the Chart view, three panels on the main chart's
 * clock (the same window, value-axis width and tooltip cursor): Elexon's
 * system sell price and net imbalance volume, read beside this dataset, then
 * this dataset's indicated imbalance. Each has an axis of its own: the notes
 * don't say how the indicated imbalance's sign relates to the net imbalance
 * volume's, so the page sets them on one clock and compares nothing. Then
 * each UK day: how many half-hours hold the indicated imbalance, the offer
 * and bid volumes and the accepted volumes; the accepted volumes summed over
 * the half-hours holding them; and the system price's mean, unweighted.
 * Select a day to mark it on every chart.
 */
import './page.css'
import { KeyList, type KeyItem } from '../../../design/charts'
import { plural } from '../../../design/format'
import { dayLabel, stepNoun, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { ACC_OFFER, AXIS_WIDTH, IMBALANCE, NIV, PRICES, SSP, dayFigures, seriesOf, systemPrices } from './figures'

/** Why the system prices aren't drawn, in words; null when they are. */
function PricesWords({ ctx }: { ctx: PageContext }) {
  const rel = ctx.related[PRICES]
  const state = systemPrices(ctx)
  if (state.kind === 'means') {
    return (
      <p className="gf-hint">
        The system prices aren’t drawn for this window: it is long enough that they come as means, and the means come apart by how each half-hour’s price was derived, so they can’t be joined into one line. A window of a month
        or less draws them.
      </p>
    )
  }
  if (state.kind === 'ok') {
    const ssp = seriesOf(state.folded.model, SSP)
    if (!ssp || ssp.count === 0) return <p className="gf-hint">No system price is held for this window.</p>
    if (state.folded.clashes > 0) {
      return (
        <p className="gf-hint">
          {plural(state.folded.clashes, 'half-hour holds', 'half-hours hold')} a system price under two derivation codes. Neither is chosen: {state.folded.clashes === 1 ? 'it shows' : 'they show'} as a gap.
        </p>
      )
    }
    return <p className="gf-hint">The system prices come once per price derivation code, and each half-hour holds a price under one of them: the page draws that one.</p>
  }
  if (!rel || rel.state === 'loading') return <p className="gf-hint">The system prices are still being read.</p>
  if (rel.state === 'error' || rel.state === 'refreshing') {
    return (
      <p className="gf-hint">
        The system prices aren’t drawn: <ErrorWords error={rel.error} />
      </p>
    )
  }
  return <p className="gf-hint">No system price is held for this window.</p>
}

export function PriceContext({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model || !ctx.window || !model.drawn.length) {
    return <p className="gf-hint">Nothing is held in this window, so there is no imbalance to draw or day to summarise.</p>
  }
  const state = systemPrices(ctx)
  const prices = state.kind === 'ok' ? state.folded.model : null
  const ssp = seriesOf(prices, SSP)
  const niv = seriesOf(prices, NIV)
  const imbalance = seriesOf(model, IMBALANCE)
  const panels: ChartPanel[] = []
  if (prices && ssp && ssp.count > 0) {
    panels.push({ rows: prices.rows, series: [ssp], mark: 'line', unit: ssp.unit, stepMs: prices.stepMs, settlement: prices.settlement, height: 170, axisWidth: AXIS_WIDTH, belowZero: ssp.min !== null && ssp.min < 0 ? ssp : null })
  }
  if (prices && niv && niv.count > 0) {
    panels.push({ rows: prices.rows, series: [niv], mark: 'bars', unit: niv.unit, stepMs: prices.stepMs, settlement: prices.settlement, height: 130, zero: true, axisWidth: AXIS_WIDTH })
  }
  if (imbalance && imbalance.count > 0) {
    panels.push({ rows: model.rows, series: [imbalance], mark: 'line', unit: imbalance.unit, stepMs: model.stepMs, bucketed: model.bucketed, settlement: model.settlement, height: 150, zero: true, axisWidth: AXIS_WIDTH })
  }
  // The charts here carry no key of their own: this names each panel's series, top to bottom, and the band.
  const items: KeyItem[] = []
  for (const p of panels) {
    const d = p.series[0]
    items.push({ key: d.key, mark: p.mark === 'bars' ? { kind: 'bars', color: d.color, shape: 'fall' } : { kind: 'line', color: d.color }, label: `${d.label}, ${d.unit.label ?? 'unit unconfirmed'}` })
    if (p.belowZero) items.push({ key: `${d.key}-below`, mark: { kind: 'band' }, label: `${d.label} below zero` })
  }
  const days = dayFigures(ctx, prices)
  // A sum of bucket means isn't the volume accepted: a window read as means gets no daily totals.
  const summed = !model.bucketed
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const accOffer = seriesOf(model, ACC_OFFER)
  const count = (held: number, expected: number | null) => (expected === null || held >= expected ? String(held) : `${held} of ${expected}`)
  const vol = (v: number | null) => (v === null ? '–' : (accOffer?.unit.plain(v) ?? String(v)))

  return (
    <>
      {ctx.mode === 'chart' && panels.length > 0 && (
        <div className="gf-mdepth-key">
          <KeyList items={items} />
        </div>
      )}
      {ctx.mode === 'chart' && panels.length > 0 && (
        <SeriesChart panels={panels} domain={windowDomain(ctx.window.start, ctx.window.end)} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      )}
      {ctx.mode === 'chart' && <PricesWords ctx={ctx} />}
      {ctx.mode === 'chart' && (!imbalance || imbalance.count === 0) && <p className="gf-hint">No indicated imbalance is held in this window.</p>}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Imbalance held
              </th>
              <th scope="col" className="is-num">
                Offered held
              </th>
              <th scope="col" className="is-num">
                Accepted held
              </th>
              {summed && (
                <>
                  <th scope="col" className="is-num">
                    Accepted offers, MWh
                  </th>
                  <th scope="col" className="is-num">
                    Accepted bids, MWh
                  </th>
                </>
              )}
              <th scope="col" className="is-num">
                System price, mean, £/MWh
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const cols = summed ? 6 : 4
              if (d.imbalance === 0 && d.offered === 0 && d.accepted === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td colSpan={cols}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && (d.imbalance < d.expected || d.offered < d.expected || d.accepted < d.expected)
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{count(d.imbalance, d.expected)}</td>
                  <td className="is-num">{count(d.offered, d.expected)}</td>
                  <td className="is-num">{count(d.accepted, d.expected)}</td>
                  {summed && (
                    <>
                      <td className="is-num">{vol(d.accOffer)}</td>
                      <td className="is-num">{vol(d.accBid)}</td>
                    </>
                  )}
                  <td className="is-num">{d.price === null ? '–' : (ssp?.unit.plain(d.price) ?? '–')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {noun} with a value: the indicated imbalance, the offer volume and the accepted offers.{' '}
        {summed
          ? `Accepted volumes sum the ${noun} holding them, so a day held in part sums in part.`
          : 'The window is read as means, so the accepted volumes are not summed per day.'}{' '}
        The system price’s mean is of the half-hours with one, not weighted by volume.
        {ctx.mode === 'chart' ? ' Select a day to mark it on every chart.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
