/**
 * The key: every fuel, top of the stack first as on the chart, with its
 * swatch and value; select one to draw it alone. Up to 31 days the values
 * are the latest half-hour held; past that, the mean over the window (the
 * long view has no "latest" point to key). Then the carbon intensity's line
 * and value, and the total, which is the fuels added up, as NESO defines its
 * `generation`. A fuel that reads zero from the window's start for weeks, or
 * throughout, is named: those are zeros in the rows held, not gaps.
 */
import { useMemo } from 'react'
import { KeyList } from '../../../design/charts'
import { listText } from '../../../design/format'
import { periodLabel, rangeText } from '../../../design/time'
import type { PageContext } from '../../define'
import { CI, CI_COLOR, CI_LABEL, FUELS, FUEL_COLUMNS, amountText, idOf, seriesOf } from './fuels'
import { clockOf, latestHeld, stepsText, windowPeriod, zeroRuns, type ZeroRun } from './periods'

/** `Every row held reads zero for “other” until 1 Feb 2012 and for solar until 1 Jan 2013…`, or empty. */
function zeroText(runs: ZeroRun[]): string {
  if (!runs.length) return ''
  const prose = (column: string) => FUELS.find((f) => f.column === column)?.prose ?? column
  // Those zero throughout first, then by the date each starts to read above zero.
  const ordered = [...runs].sort((a, b) => (a.until ?? '').localeCompare(b.until ?? ''))
  const parts = ordered.map((r) => (r.until ? `for ${prose(r.column)} until ${rangeText(r.until, r.until)}` : `for ${prose(r.column)} throughout`))
  return `In this window every row held reads zero ${listText(parts)}. Those are zeros in the rows, not gaps.`
}

export function MixKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  const native = clockOf(window) === 'native'
  const whole = useMemo(() => (model && window && !native ? windowPeriod(model, window) : null), [model, window, native])
  const zeros = useMemo(() => (model ? zeroText(zeroRuns(model)) : ''), [model])
  if (!model || !window || ctx.state === 'empty') return <p className="gf-hint">Nothing is held in this window, so there is nothing to key.</p>
  const defs = new Map(FUELS.map((f) => [f.column, seriesOf(model, f.column)]))
  const ci = seriesOf(model, CI)
  const gw = defs.get('gas')?.unit
  const latest = native ? latestHeld(model) : undefined
  if (!gw || (native && !latest) || (!native && !whole?.held)) return <p className="gf-hint">No fuel is held in this window, so there is nothing to key.</p>

  const valueOf = (column: string): number | null => {
    if (!native) return whole?.mean[column] ?? null
    const d = column === CI ? ci : defs.get(column)
    const v = d && latest ? latest[d.field] : null
    return typeof v === 'number' ? v : null
  }
  const held = FUEL_COLUMNS.map(valueOf)
  const total = held.every((v): v is number => v !== null) ? held.reduce((a, b) => a + b, 0) : null
  const ciValue = valueOf(CI)
  const focus = ctx.focus

  return (
    <>
      <ul className="gf-fuel-key">
        {[...FUELS].reverse().map((f) => {
          const id = idOf(f.column)
          const on = focus === id
          const v = valueOf(f.column)
          return (
            <li key={f.column} className={on ? 'is-focus' : focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <span className="gf-swatch" style={{ background: f.swatch }} />
                <span className="gf-fuel-name">{f.label}</span>
                <span className="gf-fuel-value">{v === null ? '–' : amountText(gw, v)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <KeyList items={[{ key: CI, mark: { kind: 'line', color: CI_COLOR }, label: `${CI_LABEL}, below` }]} />
      <dl className="gf-stats">
        <div>
          <dt>{native ? 'Total' : 'Mean total'}</dt>
          <dd>{total === null ? '–' : gw.format(total)}</dd>
        </div>
        <div>
          <dt>{native ? CI_LABEL : `Mean ${CI_LABEL.toLowerCase()}`}</dt>
          <dd>{ciValue === null ? '–' : (ci?.unit.format(ciValue) ?? '–')}</dd>
        </div>
      </dl>
      <p className="gf-hint">
        {native && latest
          ? `For ${periodLabel(latest.t, model.stepMs)}, the latest held.`
          : `Means over the window, from the ${stepsText(model)} held in it (${(whole?.held ?? 0).toLocaleString('en-GB')}), each fuel over its own values.`}{' '}
        The total is the fuels added up, as NESO defines its generation figure.
      </p>
      {zeros && <p className="gf-hint">{zeros}</p>}
      <p className="gf-hint">
        {focus ? 'Select it again to draw them all.' : 'Select a fuel to draw it on its own.'} Both wind bands are wind’s colour: transmission-connected wind below, embedded wind hatched above it.
      </p>
    </>
  )
}
