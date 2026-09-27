/**
 * The working panel: the mix of the selected period as one bar (the whole
 * window until one is selected), then every period of the window as a row:
 * its steps held, mean total, mean carbon intensity and each fuel's share of
 * the total. Periods are UK days under the half-hours, months under the
 * daily points and years under the monthly ones. A period with nothing held
 * is listed as not held, never as zeros. Select a row to mark it on the chart
 * and read its mix in the bar.
 */
import { useMemo, type ReactNode } from 'react'
import { plural } from '../../../design/format'
import type { PageContext } from '../../define'
import { CI, FUELS, seriesOf } from './fuels'
import { clockOf, heldText, periodName, periodsOf, rowKindOf, shareOf, stepsText, windowPeriod } from './periods'
import { ShareBar } from './ShareBar'

/** The two wind heads on two lines, so eleven fuels fit across the wide panel. */
const HEAD: Record<string, ReactNode> = {
  wind: (
    <>
      Wind,
      <br />
      transmission
    </>
  ),
  wind_emb: (
    <>
      Wind,
      <br />
      embedded
    </>
  ),
}

/** Tables of up to this many rows show every row; longer ones scroll in the design's box. */
const UNCAPPED = 20

const share = (v: number | null) => (v === null ? '–' : v > 0 && v < 0.005 ? '<1%' : `${Math.round(v * 100)}%`)

export function MixPeriods({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  const clock = clockOf(window)
  const kind = rowKindOf(clock) as 'day' | 'month' | 'year'
  const rows = useMemo(() => (model && window ? periodsOf(model, window, kind) : []), [model, window, kind])
  const whole = useMemo(() => (model && window ? windowPeriod(model, window) : null), [model, window])
  if (!model || !window || !whole || ctx.state === 'empty') return <p className="gf-hint">Nothing is held in this window, so there is no mix to read.</p>
  const ci = seriesOf(model, CI)?.unit
  const gw = seriesOf(model, 'gas')?.unit
  const picked = rows.find((p) => p.start === ctx.picked)
  const shown = picked ?? whole
  const steps = stepsText(model)
  const nouns = `${kind}s`

  return (
    <>
      {gw ? <ShareBar period={shown} unit={gw} /> : <p className="gf-hint">The rows came back without the fuel columns, so there is no mix to draw.</p>}
      {/* Up to 20 rows (a week, the years of the whole history) show whole; a month of days scrolls. */}
      <div className="gf-days" style={rows.length <= UNCAPPED ? { maxHeight: 'none' } : undefined}>
        <table>
          <thead>
            <tr>
              <th scope="col">{kind === 'day' ? 'Day' : kind === 'month' ? 'Month' : 'Year'}</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Total,
                <br />
                {gw?.label ?? 'unit unconfirmed'}
              </th>
              <th scope="col" className="is-num">
                Carbon intensity,
                <br />
                {ci?.label ?? 'unit unconfirmed'}
              </th>
              {FUELS.map((f) => (
                <th key={f.column} scope="col" className="is-num" title={f.label}>
                  {HEAD[f.column] ?? f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const label = periodName(p, { short: true, year: clock !== 'native' })
              if (p.held === 0) {
                return (
                  <tr key={p.key} className="is-missing">
                    <th scope="row">{label}</th>
                    <td className="is-num">{`0 of ${p.steps.toLocaleString('en-GB')}`}</td>
                    <td colSpan={2 + FUELS.length}>not held locally</td>
                  </tr>
                )
              }
              const on = p === picked
              const partial = p.held < p.steps
              return (
                <tr key={p.key} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : p.start)}>
                      {label}
                    </button>
                  </th>
                  <td className="is-num">{heldText(p)}</td>
                  <td className="is-num">{p.total === null || !gw ? '–' : gw.plain(p.total)}</td>
                  <td className="is-num">{p.mean[CI] === null || !ci ? '–' : ci.plain(p.mean[CI])}</td>
                  {FUELS.map((f) => (
                    <td key={f.column} className="is-num">
                      {share(shareOf(p, f.column))}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {rows.length > UNCAPPED && <p className="gf-hint">{plural(rows.length, kind, nouns)}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        The bar shows {picked ? periodName(picked) : 'the whole window'}; select a {kind} to read its mix{clock === 'native' ? ' and mark it on the chart' : ' and mark it on the chart above'}.
        Held counts the {steps} with a value{kind === 'day' && clock === 'native' ? '' : `, and each ${kind}’s figures are means of them`}. Shares are each fuel’s part of the mean total, worked out from its MW, not
        NESO’s own per-cent columns. Carbon intensity is the plain mean of the {steps}, not weighted by how much was generated.
      </p>
    </>
  )
}
