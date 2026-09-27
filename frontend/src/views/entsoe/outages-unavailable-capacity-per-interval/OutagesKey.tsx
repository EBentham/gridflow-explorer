/**
 * The key panel, "In this window": how many outage blocks were published in
 * the window (after the table's filters), how many units, assets or areas
 * they name, how many are cancelled where the rows carry a status, how many
 * sit at 0 MW, when they were published, and how far their starts reach.
 * Counts only: the MW figure's meaning is unsettled, so nothing adds it up.
 */
import { KeyList } from '../../../design/charts'
import { instantLabel, windowDomain } from '../../../design/time'
import { isoDayText } from '../../_template/text'
import type { PageContext } from '../../define'
import { MW, START, activeFilters, applyFilters, rowsOf, shapeOf, startMs, withYear } from './shape'

const n = (v: number) => v.toLocaleString('en-GB')

export function OutagesKey({ ctx }: { ctx: PageContext }) {
  const shape = shapeOf(ctx)
  const all = rowsOf(ctx)
  if (!shape || !ctx.window) return null
  if (ctx.state === 'empty' || !all.length) {
    // The main panel's empty line dates the local rows by their block starts; say when the notices were published.
    const cov = ctx.response?.coverage
    const first = cov?.first_day ? isoDayText(`${cov.first_day}T12:00:00Z`) : null
    const last = cov?.last_day ? isoDayText(`${cov.last_day}T12:00:00Z`) : null
    return (
      <p className="gf-hint">
        No outage block was published in {ctx.windowText}, so there is nothing to count.
        {first && last ? ` The dates beside, where the local rows run, are block starts; the notices held were published from ${first} to ${last}.` : ''}
      </p>
    )
  }

  const active = activeFilters(ctx, shape)
  const rows = applyFilters(all, active)
  if (!rows.length) return <p className="gf-hint">No outage block in this window matches the table’s filters.</p>

  const [, end] = windowDomain(ctx.window.start, ctx.window.end)
  const who = new Set(rows.map((r) => r[shape.who.field]))
  const zero = rows.filter((r) => r[MW] === 0).length
  const cancelled = shape.status ? rows.filter((r) => r[shape.status!.field] === 'A09').length : null
  const published = rows.map((r) => r.ts)
  const starts = rows.map((r) => startMs(r[START])).filter((t): t is number => t !== null)
  const ahead = starts.filter((t) => t >= end).length
  const areaField = shape.areas[0] ?? shape.who
  const byArea = new Map<string, number>()
  for (const r of rows) {
    const k = String(r[areaField.field] ?? '')
    byArea.set(k, (byArea.get(k) ?? 0) + 1)
  }

  return (
    <>
      {ctx.mode === 'chart' && <KeyList items={[{ key: 'strip', mark: { kind: 'swatch', color: 'var(--kind-events)' }, label: 'Outage blocks published per period' }]} />}
      <dl className="gf-stats">
        <div>
          <dt>Outage blocks</dt>
          <dd>{active.length ? `${n(rows.length)} of ${n(all.length)}` : n(rows.length)}</dd>
        </div>
        <div>
          <dt>{shape.noun[1][0].toUpperCase() + shape.noun[1].slice(1)}</dt>
          <dd>{n(who.size)}</dd>
        </div>
        <div>
          <dt>Cancelled</dt>
          <dd>
            {cancelled === null ? 'can’t be told' : `${n(cancelled)} of ${n(rows.length)}`}
            {cancelled === null && <span className="gf-stat-when">no status is held</span>}
          </dd>
        </div>
        <div>
          <dt>At 0 MW</dt>
          <dd>
            {n(zero)} of {n(rows.length)}
          </dd>
        </div>
      </dl>
      <dl className="gf-stats">
        <div>
          <dt>Newest published</dt>
          <dd>{instantLabel(Math.max(...published))}</dd>
        </div>
        <div>
          <dt>Oldest published</dt>
          <dd>{instantLabel(Math.min(...published))}</dd>
        </div>
        {starts.length > 0 && (
          <>
            <div>
              <dt>Earliest block start</dt>
              <dd>{withYear(Math.min(...starts))}</dd>
            </div>
            <div>
              <dt>Latest block start</dt>
              <dd>{withYear(Math.max(...starts))}</dd>
            </div>
            <div>
              <dt>Starting after the window</dt>
              <dd>
                {n(ahead)} of {n(starts.length)}
              </dd>
            </div>
          </>
        )}
      </dl>
      {byArea.size > 1 && (
        <dl className="gf-stats">
          {[...byArea.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{areaField.words?.(k) ?? (k ? <code>{k}</code> : 'Blank')}</dt>
                <dd>{n(v)}</dd>
              </div>
            ))}
        </dl>
      )}
      <p className="gf-hint">
        Counts of blocks{active.length ? ' matching the table’s filters' : ''}{byArea.size > 1 ? `, then by ${areaField.label.toLowerCase()}` : ''}. The MW figures aren’t added up: what they measure isn’t confirmed.
      </p>
    </>
  )
}
