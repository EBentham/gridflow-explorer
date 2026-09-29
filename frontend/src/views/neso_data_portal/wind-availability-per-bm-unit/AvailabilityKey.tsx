/**
 * The key. By default: the total forecast available on the latest day the
 * window holds, its highest and lowest days, how many units the rows hold,
 * change and sit at zero, and when the figures were published; then the two
 * lines drawn; then the ten largest units, each opening on its own. For one
 * unit: its latest figure, its highest and lowest, its place among the
 * units, and its part of the total.
 */
import type { ReactNode } from 'react'
import { KeyList } from '../../../design/charts'
import type { PageContext } from '../../define'
import { AVAIL_COLOR, GW, MW, OUTPUT_COLOR, TOP_N, UNIT_COLOR, UNIT_PARAM, aheadText, captureFrom, dayText, outputSeries, publishedText, unitMissing, unitShown, type Capture, type Unit } from './figures'

function stat(label: string, value: ReactNode, when?: string) {
  return (
    <div key={label}>
      <dt>{label}</dt>
      <dd>
        {value}
        {when && <span className="gf-stat-when">{when}</span>}
      </dd>
    </div>
  )
}

function Published({ cap }: { cap: Capture }) {
  const when = publishedText(cap)
  const ahead = aheadText(cap)
  if (!when) return null
  return (
    <p className="gf-hint">
      Published {when}.
      {ahead ? (cap.days.length === 1 ? ` The day in this window is ${ahead} after it.` : ` The days in this window are ${ahead} after it.`) : ''}
    </p>
  )
}

function AllKey({ ctx, cap }: { ctx: PageContext; cap: Capture }) {
  const full = cap.totals.filter((t) => t.full)
  const latest = full.length ? full[full.length - 1] : null
  const low = full.reduce<(typeof full)[number] | null>((m, t) => (!m || t.sum < m.sum ? t : m), null)
  const high = full.reduce<(typeof full)[number] | null>((m, t) => (!m || t.sum > m.sum ? t : m), null)
  const changing = cap.units.filter((u) => u.changes > 0).length
  const zero = cap.units.filter((u) => u.held > 0 && u.low?.v === 0 && u.high?.v === 0).length
  const below = cap.units.filter((u) => u.low !== null && u.low.v < 0).length
  const top = cap.units.slice(0, TOP_N)
  const lastDay = cap.days[cap.days.length - 1]
  const output = outputSeries(ctx)
  return (
    <>
      <dl className="gf-stats gf-wa-stats">
        {latest ? stat(`All ${cap.units.length} units`, GW.format(latest.sum * GW.factor), dayText(latest.day)) : null}
        {cap.days.length > 1 && low && high && low.sum === high.sum && stat('On every day', GW.format(low.sum * GW.factor))}
        {low && high && low.sum !== high.sum && (
          <>
            {stat('Highest day', GW.format(high.sum * GW.factor), dayText(high.day))}
            {stat('Lowest day', GW.format(low.sum * GW.factor), dayText(low.day))}
          </>
        )}
        {cap.days.length > 1 && stat('Units that change', `${changing.toLocaleString('en-GB')} of ${cap.units.length.toLocaleString('en-GB')}`)}
        {zero > 0 && stat('At 0 MW every day', zero.toLocaleString('en-GB'))}
        {below > 0 && stat('Below 0 MW on a day', below.toLocaleString('en-GB'))}
      </dl>
      {!latest && <p className="gf-hint">No day in this window has a figure for every unit, so no total is given.</p>}
      <Published cap={cap} />
      {ctx.mode === 'chart' && (
        <KeyList
          items={[
            { key: 'avail', mark: { kind: 'line', color: AVAIL_COLOR, dashed: ctx.fixture }, label: 'Forecast available, all units' },
            ...(output ? [{ key: 'output', mark: { kind: 'line' as const, color: OUTPUT_COLOR, dashed: ctx.fixture }, label: 'GB wind output, metered' }] : []),
          ]}
        />
      )}
      <p className="gf-hint gf-wa-head">{top.length === 1 ? 'The largest unit' : `The ${top.length} largest units`}, by mean</p>
      <ul className="gf-series-key">
        {top.map((u) => {
          const v = u.values.get(lastDay)
          return (
            <li key={u.id}>
              <button type="button" onClick={() => ctx.setParam(UNIT_PARAM, u.id)} aria-label={`Read ${u.id} on its own`}>
                <code className="gf-series-name">{u.id}</code>
                <span className="gf-series-value">{typeof v === 'number' ? MW.format(v) : '–'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="gf-hint">
        Each on {dayText(lastDay)}, in MW. Select one to read it on its own; the Table view lists all {cap.units.length}.
      </p>
    </>
  )
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`
}

function OneKey({ ctx, cap, unit }: { ctx: PageContext; cap: Capture; unit: Unit }) {
  const tied = cap.units.flatMap((u, i) => (u.mean !== null && u.mean === unit.mean ? [i + 1] : []))
  const flat = unit.low && unit.high && unit.low.v === unit.high.v
  const lastTotal = unit.last ? cap.totalByDay.get(unit.last.day) : undefined
  const part = unit.last && lastTotal?.full && lastTotal.sum > 0 ? (100 * unit.last.v) / lastTotal.sum : null
  return (
    <>
      {ctx.mode === 'chart' && <KeyList items={[{ key: unit.id, mark: { kind: 'line', color: UNIT_COLOR, dashed: ctx.fixture }, label: <code>{unit.id}</code> }]} />}
      <dl className="gf-stats gf-wa-stats">
        {unit.last && stat('Latest day', MW.format(unit.last.v), dayText(unit.last.day))}
        {flat && unit.low && stat('On every day held', MW.format(unit.low.v))}
        {!flat && unit.high && stat('Highest', MW.format(unit.high.v), dayText(unit.high.day))}
        {!flat && unit.low && stat('Lowest', MW.format(unit.low.v), dayText(unit.low.day))}
        {!flat && unit.mean !== null && stat('Mean', MW.format(unit.mean))}
        {stat('Days held', `${unit.held} of ${cap.days.length}`)}
        {part !== null && stat('Part of all units', `${part.toFixed(2)}%`, unit.last ? dayText(unit.last.day) : undefined)}
        {tied.length === 1 && stat('By mean', `${ordinal(tied[0])} of ${cap.units.length}`)}
        {tied.length > 1 && stat('By mean', `joint ${ordinal(tied[0])}–${ordinal(tied[tied.length - 1])} of ${cap.units.length}`)}
      </dl>
      <p className="gf-hint">In MW, over the days this window holds a figure for it. Its part is its figure over the sum of every unit’s that day.</p>
      <Published cap={cap} />
    </>
  )
}

export function AvailabilityKey({ ctx }: { ctx: PageContext }) {
  const cap = captureFrom(ctx)
  const missing = unitMissing(ctx)
  if (ctx.state === 'empty' || !cap || !cap.units.length) return <p className="gf-hint">Nothing is held in this window, so there is nothing to key.</p>
  if (missing) {
    return (
      <p className="gf-hint">
        No unit <code>{missing}</code> in this window’s rows, so there is nothing to key.
      </p>
    )
  }
  const one = unitShown(ctx)
  return one ? <OneKey ctx={ctx} cap={cap} unit={one} /> : <AllKey ctx={ctx} cap={cap} />
}
