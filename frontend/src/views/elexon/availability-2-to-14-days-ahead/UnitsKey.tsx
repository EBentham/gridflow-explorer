/**
 * The by-unit key. By default: one delivery day (the one picked, else the
 * latest the window holds), each fuel band with its units' summed forecast
 * and how many units list it (select one to draw it alone), the total, the
 * units listed, and the issues behind them; then Elexon's own by-fuel total
 * for the same day and its issue. For one unit: its fuel, its figure that
 * day, its highest and lowest in the window, and the issues behind them.
 */
import type { ReactNode } from 'react'
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { fmtDay, instantLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { DIFF_COLOR, FUEL_KEY, GW, MW, bandId, bandsIn, daysAhead, daysOf, heldShape, issuedRange, keyDay, signedMw, unitFuel, unitShown, type Day, type UnitInfo } from './figures'

const gw = (mw: number) => GW.format(mw * GW.factor)

function Stat({ label, value, when }: { label: string; value: ReactNode; when?: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {value}
        {when && <span className="gf-stat-when">{when}</span>}
      </dd>
    </div>
  )
}

function aheadText(date: string, issued: number[]): string | undefined {
  if (!issued.length) return undefined
  const a = issued.map((t) => daysAhead(date, t))
  const lo = Math.min(...a)
  const hi = Math.max(...a)
  return lo === hi ? `${plural(lo, 'day', 'days')} ahead` : `${lo} to ${hi} days ahead`
}

function OneKey({ ctx, unit, days }: { ctx: PageContext; unit: UnitInfo; days: Day[] }) {
  const held = days.filter((d) => unit.byDate.has(d.date))
  if (!held.length) {
    return (
      <p className="gf-hint">
        <code>{unit.id}</code> holds no figure in this window, so there is nothing to key.
      </p>
    )
  }
  const day = held.find((d) => d.start === ctx.picked) ?? held[held.length - 1]
  const at = unit.byDate.get(day.date)
  const figures = held.map((d) => ({ d, v: unit.byDate.get(d.date) }))
  const high = figures.reduce((a, b) => ((b.v?.mw ?? -Infinity) > (a.v?.mw ?? -Infinity) ? b : a))
  const low = figures.reduce((a, b) => ((b.v?.mw ?? Infinity) < (a.v?.mw ?? Infinity) ? b : a))
  const issued = [...new Set(figures.map((f) => f.v?.issued).filter((t): t is number => typeof t === 'number'))].sort((a, b) => a - b)
  return (
    <>
      <KeyList items={[{ key: unit.key, mark: { kind: 'line', color: unit.band.color, dashed: ctx.fixture }, label: <span><code>{unit.id}</code>, {unitFuel(unit)}</span> }]} />
      <dl className="gf-stats">
        {unit.ng && <Stat label="National Grid id" value={<code>{unit.ng}</code>} />}
        {unit.code && <Stat label="Fuel code" value={<code>{unit.code}</code>} />}
        {at && <Stat label={day.start === ctx.picked ? 'On the day selected' : 'Latest day'} value={MW.format(at.mw)} when={at.issued === null ? fmtDay(day.date) : `${fmtDay(day.date)}, ${aheadText(day.date, [at.issued])}`} />}
        {high.v && low.v && high.v.mw !== low.v.mw && (
          <>
            <Stat label="Highest" value={MW.format(high.v.mw)} when={fmtDay(high.d.date)} />
            <Stat label="Lowest" value={MW.format(low.v.mw)} when={fmtDay(low.d.date)} />
          </>
        )}
        {high.v && low.v && high.v.mw === low.v.mw && <Stat label="Every day held" value={MW.format(high.v.mw)} />}
        <Stat label="Days held" value={`${held.length} of ${days.length}`} />
        <Stat label={issued.length > 1 ? 'Issues' : 'Issued'} value={issuedRange(issued, instantLabel)} />
      </dl>
      <p className="gf-hint">In MW, over the delivery days the forecast lists the unit. Days ahead counts whole UK days from the issue to the delivery day.</p>
    </>
  )
}

function AllKey({ ctx, days }: { ctx: PageContext; days: Day[] }) {
  const day = keyDay(ctx, days)
  if (!day) return <p className="gf-hint">No unit is listed for any delivery day in this window, so there is nothing to key.</p>
  const bands = bandsIn(days)
  const focus = bands.find((b) => bandId(b) === ctx.focus)
  const rel = ctx.related[FUEL_KEY]
  const fuelDay = daysOf(rel?.response, ctx.window, 'code').find((d) => d.date === day.date)
  const picked = day.start === ctx.picked
  return (
    <>
      <p className="gf-hint">
        {fmtDay(day.date)}, {picked ? 'the day selected' : 'the latest delivery day in the window'}:
      </p>
      <ul className="gf-series-key">
        {[...bands].reverse().map((b) => {
          const s = day.bands.get(b.key)
          const on = focus?.key === b.key
          return (
            <li key={b.key} className={on ? 'is-focus' : focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} onClick={() => ctx.setFocus(on ? undefined : bandId(b))}>
                <KeyList items={[{ key: b.key, mark: { kind: 'swatch', color: b.color }, label: <span className="gf-series-name">{b.label}</span> }]} />
                <span className="gf-series-value">{s ? gw(s.mw) : '–'}</span>
              </button>
              {s && <span className="gf-series-when">{plural(s.n, 'unit', 'units')}</span>}
            </li>
          )
        })}
      </ul>
      <dl className="gf-stats">
        {day.total !== null && <Stat label="Units’ total" value={gw(day.total)} when={plural(day.held, 'unit listed', 'units listed')} />}
        <Stat label={day.issued.length > 1 ? 'Issues' : 'Issued'} value={issuedRange(day.issued, instantLabel)} when={aheadText(day.date, day.issued)} />
        {fuelDay && fuelDay.total !== null && (
          <Stat label="By-fuel total" value={gw(fuelDay.total)} when={`issued ${issuedRange(fuelDay.issued, instantLabel)}`} />
        )}
        {fuelDay && fuelDay.total !== null && day.total !== null && <Stat label="Units less by-fuel" value={signedMw(day.total - fuelDay.total)} />}
      </dl>
      {fuelDay && fuelDay.total !== null && day.total !== null && ctx.mode === 'chart' && heldShape(days).held > 1 && (
        <KeyList items={[{ key: 'diff', mark: { kind: 'bars', color: DIFF_COLOR, shape: day.total - fuelDay.total < 0 ? 'fall' : 'rise' }, label: 'Units’ total less the by-fuel total, MW: the bars under the chart, one per day' }]} />
      )}
      <p className="gf-hint">
        Listed as they stack, top first, each fuel with the units listing it. {ctx.mode === 'chart' ? (focus ? 'Select it again to draw every fuel.' : 'Select a fuel to draw it alone.') : 'Select a fuel to draw it alone in the Chart view.'} The by-fuel total is Elexon’s own figure for the same day, from its by-fuel forecast; the side panel sets the two apart fuel by fuel.
      </p>
      {rel && rel.state !== 'error' && rel.state !== 'refreshing' && !fuelDay?.total && <p className="gf-hint">Elexon’s by-fuel forecast holds nothing for this day, so there is no total to set the units against.</p>}
    </>
  )
}

export function UnitsKey({ ctx }: { ctx: PageContext }) {
  const days = daysOf(ctx.response, ctx.window, 'unit')
  if (ctx.state === 'empty' || !days.some((d) => d.held > 0)) return <p className="gf-hint">No unit is listed for any delivery day in this window, so there is nothing to key.</p>
  const asked = ctx.param('unit')
  const one = unitShown(ctx)
  if (asked && !one) {
    return (
      <p className="gf-hint">
        No unit <code>{asked}</code> is listed in {ctx.windowText}, so there is nothing to key.
      </p>
    )
  }
  return one ? <OneKey ctx={ctx} unit={one} days={days} /> : <AllKey ctx={ctx} days={days} />
}
