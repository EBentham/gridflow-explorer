/**
 * The by-fuel key: one delivery day (the one picked, else the latest the
 * window holds), each fuel band with its forecast usable output that day
 * (select one to draw it alone), the total with and without the
 * interconnectors, and the issue behind the day. Then, over the window, the
 * delivery days with the highest and lowest total, and the newest issue
 * held. Every figure is read from the rows.
 */
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { fmtDay, instantLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { GW, bandId, bandsIn, daysAhead, daysOf, issuedRange, keyDay, newestIssue, newestIssueDays, type Day } from './figures'

const gw = (mw: number) => GW.format(mw * GW.factor)

function Stat({ label, value, when }: { label: string; value: string; when?: string }) {
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

function aheadText(day: Day): string | undefined {
  if (!day.issued.length) return undefined
  const a = day.issued.map((t) => daysAhead(day.date, t))
  const lo = Math.min(...a)
  const hi = Math.max(...a)
  return lo === hi ? `${plural(lo, 'day', 'days')} ahead` : `${lo} to ${hi} days ahead`
}

export function FuelKey({ ctx }: { ctx: PageContext }) {
  const days = daysOf(ctx.response, ctx.window, 'code')
  const day = keyDay(ctx, days)
  if (ctx.state === 'empty' || !day) return <p className="gf-hint">No forecast is held for any delivery day in this window, so there is nothing to key.</p>
  const bands = bandsIn(days)
  const focus = bands.find((b) => bandId(b) === ctx.focus)
  const held = days.filter((d) => d.total !== null)
  const high = held.reduce((a, b) => ((b.total ?? 0) > (a.total ?? 0) ? b : a))
  const low = held.reduce((a, b) => ((b.total ?? 0) < (a.total ?? 0) ? b : a))
  const newest = newestIssue(days)
  const newestDays = newestIssueDays(days)
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
            </li>
          )
        })}
      </ul>
      <dl className="gf-stats">
        {day.total !== null && <Stat label="Total" value={gw(day.total)} />}
        {day.domestic !== null && day.bands.has('imports') && <Stat label="Without interconnectors" value={gw(day.domestic)} />}
        <Stat label="Issued" value={issuedRange(day.issued, instantLabel)} when={aheadText(day)} />
      </dl>
      <p className="gf-hint">
        Listed as they stack, top first. {ctx.mode === 'chart' ? (focus ? 'Select it again to draw every fuel.' : 'Select a fuel to draw it alone.') : 'Select a fuel to draw it alone in the Chart view.'} Days ahead counts whole UK days from the issue to the delivery day.
      </p>
      {held.length > 1 && (
        <dl className="gf-stats">
          <Stat label="Highest total" value={gw(high.total ?? 0)} when={fmtDay(high.date)} />
          <Stat label="Lowest total" value={gw(low.total ?? 0)} when={fmtDay(low.date)} />
          {newest !== null && (
            <Stat
              label="Newest issue held"
              value={instantLabel(newest)}
              when={newestDays.length > 1 ? `for ${fmtDay(newestDays[0].date)} to ${fmtDay(newestDays[newestDays.length - 1].date)} here` : newestDays.length ? `for ${fmtDay(newestDays[0].date)} here` : undefined}
            />
          )}
        </dl>
      )}
      {held.length > 1 && <p className="gf-hint">Over the {plural(held.length, 'delivery day', 'delivery days')} in the window holding a forecast. A total counts every fuel code held that day, interconnectors included.</p>}
    </>
  )
}
