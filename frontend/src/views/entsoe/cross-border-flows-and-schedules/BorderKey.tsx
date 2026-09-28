/**
 * The key of the flows and the schedules: every border with its mark, its
 * latest value, and how much of its own clock the window holds; select one
 * to draw it alone. Then the mark of the dataset drawn beside each border,
 * and the window's figures for the selected border (or the first): its
 * mean, highest, lowest and zeros, and the mean of the one beside it. Every
 * figure is of the values held, each counted once.
 */
import { KeyList } from '../../../design/charts'
import { cadenceText, periodLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { areaName, BESIDE_COLOR } from './areas'
import { heldText, windowTally } from './figures'
import { besideState, bordersOf, focusedBorder, latestStamp, roleOf } from './model'
import { stepWords } from './words'

const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`

export function BorderKey({ ctx }: { ctx: PageContext }) {
  const w = ctx.window
  const role = roleOf(ctx)
  const borders = bordersOf(ctx)
  if (!w || !borders.length) return <p className="gf-hint">No border holds a value in this window, so there is nothing to key.</p>
  const tallies = new Map(borders.map((b) => [b.id, b.own ? windowTally(b.own.points, b.own.step, w) : null]))
  // The source line names this time; a border whose latest value is older names its own.
  const stamp = latestStamp(borders.map((b) => b.own))?.t
  const pickable = borders.length > 1
  // Focus outlives a change of in area; one naming no border here selects nothing.
  const focused = borders.some((b) => b.id === ctx.focus)
  const sel = focusedBorder(ctx, borders)
  const selTally = sel ? tallies.get(sel.id) : null
  const besideTally = sel?.beside ? windowTally(sel.beside.points, sel.beside.step, w) : null
  const unit = sel?.own?.def.unit
  const when = (t: number) => periodLabel(t, sel?.own?.step ?? null)
  const beside = besideState(ctx)

  return (
    <>
      <ul className="gf-series-key">
        {borders.map((b) => {
          const t = tallies.get(b.id)
          const on = ctx.focus === b.id
          const step = b.own?.step ?? null
          return (
            <li key={b.id} className={on ? 'is-focus' : focused ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : b.id)}>
                <KeyList items={[{ key: b.id, mark: { kind: 'line', color: b.color, dashed: ctx.fixture }, label: <span className="gf-series-name">{b.name}</span> }]} />
                <span className="gf-series-value">{t?.latest && b.own ? b.own.def.unit.format(t.latest.v) : '–'}</span>
              </button>
              {t?.latest && t.latest.t !== stamp && <span className="gf-series-when">Latest for {periodLabel(t.latest.t, step)}</span>}
              <span className="gf-series-when">
                {t && t.held > 0 ? `${step ? cadenceText(step) : 'Step unknown'}: ${heldText(t)} ${stepWords(step)} held` : `No ${role.own} held in this window`}
              </span>
            </li>
          )
        })}
      </ul>
      {pickable && <p className="gf-hint">{focused ? 'Select it again to draw every border.' : 'Select a border to draw it alone, with its highest and lowest labelled.'}</p>}
      {beside === 'drawn' && ctx.mode === 'chart' && (
        <KeyList items={[{ key: 'beside', mark: { kind: 'line', color: BESIDE_COLOR, dashed: ctx.fixture }, label: `${cap(role.beside)}, on the same border` }]} />
      )}
      {sel && selTally && unit && selTally.held > 0 && (
        <>
          <p className="gf-hint">
            In this window, {sel.name}: in area {areaName(sel.inArea)}, out area {areaName(sel.out)}.
          </p>
          <dl className="gf-stats">
            <div>
              <dt>Mean</dt>
              <dd>{selTally.mean === null ? '–' : unit.format(selTally.mean)}</dd>
            </div>
            {selTally.high && (
              <div>
                <dt>Highest</dt>
                <dd>
                  {unit.format(selTally.high.v)}
                  <span className="gf-stat-when">{when(selTally.high.t)}</span>
                </dd>
              </div>
            )}
            {selTally.low && (
              <div>
                <dt>Lowest</dt>
                <dd>
                  {unit.format(selTally.low.v)}
                  <span className="gf-stat-when">{when(selTally.low.t)}</span>
                </dd>
              </div>
            )}
            <div>
              <dt>At zero</dt>
              <dd>
                {selTally.zero.toLocaleString('en-GB')} of {selTally.held.toLocaleString('en-GB')}
              </dd>
            </div>
            {besideTally && besideTally.held > 0 && sel.beside && (
              <div>
                <dt>{cap(role.beside)}, mean</dt>
                <dd>{besideTally.mean === null ? '–' : sel.beside.def.unit.format(besideTally.mean)}</dd>
              </div>
            )}
          </dl>
          <p className="gf-hint">
            Of the {selTally.held.toLocaleString('en-GB')} {stepWords(sel.own?.step ?? null)} held, each counted once.
            {besideTally && besideTally.held > 0 ? ` The ${role.beside}’s mean is of its own ${stepWords(sel.beside?.step ?? null)} held.` : ''} A zero is as published: nothing moved in the direction held. The other direction isn’t held.
          </p>
        </>
      )}
    </>
  )
}
