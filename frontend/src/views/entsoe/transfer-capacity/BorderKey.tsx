/**
 * The key: every border with its latest value and how much of its own clock
 * the window holds; select one to draw it alone. Then the marks of the
 * measures drawn beside the page's own, and the window's figures for the
 * selected border (or the first): its mean, highest, lowest, zeros and how
 * many different values it held (a capacity moves in steps), and the mean
 * of each measure beside it. Every figure is of the values held, each
 * counted once.
 */
import { KeyList } from '../../../design/charts'
import { cadenceText, periodLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { areaName } from './areas'
import { heldText, windowTally } from './figures'
import { besideOf, besideState, bordersOf, countStep, focusedBorder, latestStamp, measureOf } from './model'
import { figureText, stepWords } from './words'

export function BorderKey({ ctx }: { ctx: PageContext }) {
  const w = ctx.window
  const own = measureOf(ctx)
  const borders = bordersOf(ctx)
  if (!w || !borders.length) {
    return <p className="gf-hint">{own.whenSet ? 'No limit is held in this window, so there is nothing to key.' : 'No border holds a value in this window, so there is nothing to key.'}</p>
  }
  const tallies = new Map(borders.map((b) => [b.id, windowTally(b.own.points, countStep(own, b.own), w)]))
  // The source line names this time; a border whose latest value is older names its own.
  const stamp = latestStamp(borders.map((b) => b.own))?.t
  const pickable = borders.length > 1
  // Focus outlives a change of in area; one naming no border here selects nothing.
  const focused = borders.some((b) => b.id === ctx.focus)
  const sel = focusedBorder(ctx, borders)
  const selTally = sel ? tallies.get(sel.id) : null
  const unit = sel?.own.def.unit
  const when = (t: number) => periodLabel(t, sel?.own.step ?? null)
  const drawn = besideOf(ctx).filter((m) => besideState(ctx, m) === 'drawn')

  return (
    <>
      <ul className="gf-series-key">
        {borders.map((b) => {
          const t = tallies.get(b.id)
          const on = ctx.focus === b.id
          const step = b.own.step
          const count = countStep(own, b.own)
          return (
            <li key={b.id} className={on ? 'is-focus' : focused ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : b.id)}>
                {/* A plain span, not the no-wrap name: a long border (Netherlands–Germany/Luxembourg) wraps rather than pushing its value out of the panel. */}
                <KeyList items={[{ key: b.id, mark: { kind: 'line', color: own.color, dashed: ctx.fixture }, label: <span>{b.name}</span> }]} />
                <span className="gf-series-value">{t?.latest ? figureText(b.own.def.unit, t.latest.v) : '–'}</span>
              </button>
              {t?.latest && t.latest.t !== stamp && <span className="gf-series-when">Latest for {periodLabel(t.latest.t, step)}</span>}
              <span className="gf-series-when">
                {!t || t.held === 0
                  ? `No ${own.words} held in this window`
                  : own.whenSet
                    ? `${t.held.toLocaleString('en-GB')} ${t.held === 1 ? 'limit' : 'limits'} held`
                    : `${step ? cadenceText(step) : 'Step unknown'}: ${heldText(t)} ${stepWords(count, t.expected !== null && t.held < t.expected ? t.expected : t.held)} held`}
              </span>
            </li>
          )
        })}
      </ul>
      {pickable && <p className="gf-hint">{focused ? 'Select it again to draw every border.' : 'Select a border to draw it alone, with its highest and lowest labelled.'}</p>}
      {drawn.length > 0 && ctx.mode === 'chart' && (
        <KeyList
          items={[
            { key: own.key, mark: { kind: 'line' as const, color: own.color, dashed: ctx.fixture }, label: `${own.label}, the borders above` },
            ...drawn.map((m) => ({ key: m.key, mark: { kind: 'line' as const, color: m.color, dashed: ctx.fixture }, label: `${m.label}, on the same border` })),
          ]}
        />
      )}
      {sel && selTally && unit && selTally.held > 0 && (
        <>
          <p className="gf-hint">
            In this window, {sel.name}: in area {areaName(sel.inArea)}, out area {areaName(sel.out)}.
          </p>
          <dl className="gf-stats">
            <div>
              <dt>Mean</dt>
              <dd>{selTally.mean === null ? '–' : figureText(unit, selTally.mean)}</dd>
            </div>
            {selTally.distinct === 1 && selTally.high ? (
              <div>
                <dt>Every value held</dt>
                <dd>{figureText(unit, selTally.high.v)}</dd>
              </div>
            ) : (
              <>
                {selTally.high && (
                  <div>
                    <dt>Highest</dt>
                    <dd>
                      {figureText(unit, selTally.high.v)}
                      <span className="gf-stat-when">{when(selTally.high.t)}</span>
                    </dd>
                  </div>
                )}
                {selTally.low && (
                  <div>
                    <dt>Lowest</dt>
                    <dd>
                      {figureText(unit, selTally.low.v)}
                      <span className="gf-stat-when">{when(selTally.low.t)}</span>
                    </dd>
                  </div>
                )}
              </>
            )}
            <div>
              <dt>At zero</dt>
              <dd>
                {selTally.zero.toLocaleString('en-GB')} of {selTally.held.toLocaleString('en-GB')}
              </dd>
            </div>
            <div>
              <dt>Different values</dt>
              <dd>{selTally.distinct.toLocaleString('en-GB')}</dd>
            </div>
            {sel.beside.map((x) => {
              const bt = windowTally(x.line.points, countStep(x.measure, x.line), w)
              return bt.mean === null ? null : (
                <div key={x.measure.key}>
                  <dt>{x.measure.label}, mean</dt>
                  <dd>{figureText(x.line.def.unit, bt.mean)}</dd>
                </div>
              )
            })}
          </dl>
          <p className="gf-hint">
            Of the {selTally.held.toLocaleString('en-GB')} {own.whenSet ? (selTally.held === 1 ? 'limit' : 'limits') : stepWords(sel.own.step, selTally.held)} held
            {selTally.held > 1 ? ', each counted once' : ''}.{sel.beside.length ? ' A mean beside it is of that measure’s own values held on the same border.' : ''} A zero is as published. The other direction isn’t held.
          </p>
        </>
      )}
    </>
  )
}
