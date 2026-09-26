/**
 * What the template puts in panels: the source line every panel carries,
 * the main panel's notes (thin coverage, truncation, the page's caveats),
 * and the default key, working and side contents of each body. A page
 * replaces any of them through `panels` in its config and can reuse these.
 */
import { Fragment, type ReactNode } from 'react'
import { KeyList, type KeyItem } from '../../design/charts'
import { listText, plural } from '../../design/format'
import { dayLabel, instantLabel, stepNoun } from '../../design/time'
import type { EventsRowsResponse, ManifestDataset, ManifestSource, ReferenceRowsResponse } from '../contract'
import type { PageContext, ReferenceView, SeriesView } from '../define'
import { daySeries, heldDays, type SourcePart } from './panelHelpers'
import { daySummaries, latestValue, seriesId, type SeriesDef } from './seriesModel'
import { planPanels } from './seriesPanels'
import { cadenceOf, coverageSentences, depthText, isoDayText, meansText, notHeldText, sourceName, truncationSentences } from './text'
import { displayUnit } from './units'

// ---------------------------------------------------------------- source line

function Part({ part, fixture }: { part: SourcePart; fixture: boolean }) {
  const cols = part.columns ?? []
  return (
    <>
      {fixture ? 'Synthetic' : part.source ? sourceName(part.source) : 'gridflow'} <code>{part.dataset}</code>
      {cols.length > 0 && (
        <>
          ,{' '}
          {cols.map((c, i) => (
            <Fragment key={c}>
              {i > 0 && (i === cols.length - 1 ? ' and ' : ', ')}
              <code>{c}</code>
            </Fragment>
          ))}
        </>
      )}
      {part.by && (
        <>
          {' '}
          by <code>{part.by}</code>
        </>
      )}
      {part.unit !== undefined && <>, {part.unit ?? 'unit unconfirmed'}</>}
    </>
  )
}

/**
 * A panel's source line (DESIGN §5): who publishes each dataset shown, its
 * id and columns as identifiers, the split and the unit; then what the panel
 * shows and the window. `Elexon BMRS mid, market_index_price, £/MWh, 16 Sep –
 * 22 Sep 2026`. A panel drawing a related dataset too names it in `also`.
 */
export function SourceLine({
  ctx,
  dataset,
  source,
  columns,
  by,
  what,
  unit,
  also = [],
  window = true,
}: {
  ctx: PageContext
  /** Another dataset than the page's own. */
  dataset?: Pick<ManifestDataset, 'id'>
  source?: Pick<ManifestSource, 'name'>
  columns?: string[]
  by?: string | null
  /** What the panel shows, in words: `mean per UK day`. */
  what?: ReactNode
  unit?: string | null
  /** Further datasets the panel shows (a related one), each named in full. */
  also?: SourcePart[]
  window?: boolean
}) {
  const parts: SourcePart[] = [{ source: source ?? ctx.source, dataset: dataset?.id ?? ctx.dataset.id, columns, by, unit }, ...also]
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={`${p.dataset}:${i}`}>
          {i > 0 && '; '}
          <Part part={p} fixture={ctx.fixture} />
        </Fragment>
      ))}
      {what && <>, {what}</>}
      {window && ctx.windowText && <>, {ctx.windowText}</>}
    </>
  )
}

// ---------------------------------------------------------------- the main panel's notes

/**
 * The main panel's plain words under its source line: how thin the local
 * coverage is, what a truncated response left out, and the page's caveats.
 * Nothing when there is nothing to say.
 */
export function PageNotes({ ctx }: { ctx: PageContext }) {
  const facts: string[] = []
  if (ctx.window && ctx.state === 'data') {
    const days = heldDays(ctx)
    const coverage = ctx.dataset.coverage
    facts.push(...coverageSentences({ coverage, window: ctx.window, days, stepMs: ctx.series?.stepMs ?? null }).filter((s) => ctx.response?.kind !== 'events' || !s.includes(' holds ')))
  }
  if (ctx.response) facts.push(...truncationSentences(ctx.response.truncation, ctx.response.truncated))
  const caveats = [...(ctx.config.caveats ?? []), ...(ctx.view.caveats ?? [])]
  if (!facts.length && !caveats.length) return null
  return (
    <div className="gf-notes">
      {facts.length > 0 && <p>{facts.join(' ')}</p>}
      {caveats.length > 0 && <p className="is-caveat">{caveats.join(' ')}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- series defaults

function markOf(kind: string | undefined, color: string): KeyItem['mark'] {
  return kind === 'line' ? { kind: 'line', color } : { kind: 'swatch', color }
}

/** The series key: every drawn series with its mark and latest value; select one to draw it alone. */
export function SeriesKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model) return null
  const plan = planPanels(ctx)
  const drawn = plan.panels.flatMap((p) => p.series)
  const latestOf = (d: SeriesDef) => {
    const m = d.from === 'self' ? model : ctx.related[d.from]?.series
    return m ? latestValue(m, d) : null
  }
  const pickable = drawn.length > 1
  return (
    <>
      <ul className="gf-series-key">
        {drawn.map((d) => {
          const id = seriesId(d)
          const latest = latestOf(d)
          const on = ctx.focus === id
          return (
            <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <KeyList items={[{ key: id, mark: markOf(plan.marks.get(id), d.color), label: <span className="gf-series-name">{d.label}</span> }]} />
                <span className="gf-series-value">{latest ? d.unit.format(latest.v) : '–'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {pickable && <p className="gf-hint">{ctx.focus ? 'Select it again to draw them all.' : 'Select a series to draw it on its own.'}</p>}
      {model.undrawn.length > 0 && (
        <p className="gf-hint">
          Not drawn, to keep the chart readable: {listText(model.undrawn.slice(0, 6).map((d) => d.label))}
          {model.undrawn.length > 6 ? ` and ${model.undrawn.length - 6} more` : ''}. The table lists them.
        </p>
      )}
      {model.empty.length > 0 && <p className="gf-hint">No value held in this window: {listText(model.empty.map((d) => d.label))}.</p>}
    </>
  )
}

/** Every UK day in the window: held half-hours, and one series' mean, lowest and highest. Select a day to mark it. */
export function SeriesDays({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const def = daySeries(ctx)
  if (!model || !ctx.window || !def) return <p className="gf-hint">No series in this window to summarise.</p>
  const days = daySummaries(model, ctx.window, def)
  const daily = model.stepMs !== null && model.stepMs >= 86_400_000
  const fmt = (x: { v: number } | null) => (x ? def.unit.plain(x.v) : '–')
  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {!daily && (
                <th scope="col" className="is-num">
                  Held
                </th>
              )}
              <th scope="col" className="is-num">
                {daily ? 'Value' : 'Mean'}
              </th>
              {!daily && (
                <>
                  <th scope="col" className="is-num">
                    Lowest
                  </th>
                  <th scope="col" className="is-num">
                    Highest
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    {!daily && <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>}
                    <td colSpan={daily ? 1 : 3}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  {!daily && <td className="is-num">{d.expected === null || !partial ? d.held : `${d.held} of ${d.expected}`}</td>}
                  <td className="is-num">{d.mean === null ? '–' : def.unit.plain(d.mean)}</td>
                  {!daily && (
                    <>
                      <td className="is-num">{fmt(d.low)}</td>
                      <td className="is-num">{fmt(d.high)}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      {!daily && (
        <p className="gf-hint">
          Held counts the {model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)} with a value.
          {model.drawn.length > 1 ? ' Select a series in the key to read another.' : ''}
        </p>
      )}
    </>
  )
}

// ---------------------------------------------------------------- events defaults

/** The events key: how many, newest and oldest, and counts by the first categorical column. */
export function EventsSummary({ ctx }: { ctx: PageContext }) {
  const response = ctx.response as EventsRowsResponse | null
  if (!response) return null
  const rows = response.rows
  const by = (ctx.view.body === 'events' && ctx.view.filters?.[0]) || Object.keys(rows[0] ?? {}).find((k) => k !== 'ts' && typeof rows[0][k] === 'string' && new Set(rows.map((r) => r[k])).size <= 12)
  const counts = new Map<string, number>()
  if (by) for (const r of rows) counts.set(String(r[by] ?? 'none'), (counts.get(String(r[by] ?? 'none')) ?? 0) + 1)
  const times = rows.map((r) => r.ts)
  return (
    <>
      <dl className="gf-stats">
        <div>
          <dt>Events</dt>
          <dd>{rows.length.toLocaleString('en-GB')}</dd>
        </div>
        {times.length > 0 && (
          <>
            <div>
              <dt>Newest</dt>
              <dd>{instantLabel(Math.max(...times))}</dd>
            </div>
            <div>
              <dt>Oldest</dt>
              <dd>{instantLabel(Math.min(...times))}</dd>
            </div>
          </>
        )}
      </dl>
      {by && counts.size > 0 && (
        <dl className="gf-stats">
          {[...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([k, n]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{n}</dd>
              </div>
            ))}
        </dl>
      )}
      {by && <p className="gf-hint">Counts by <code>{by}</code>. Filter the table below it to read one group.</p>}
    </>
  )
}

/** Events per UK day in the window; a day beyond the local depth is not held, a held day with none says so. */
export function EventsDays({ ctx }: { ctx: PageContext }) {
  const days = heldDays(ctx)
  const first = ctx.dataset.coverage?.first_day
  const last = ctx.dataset.coverage?.last_day
  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Events
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const outside = (first && d.day < first) || (last && d.day > last)
              return (
                <tr key={d.day} className={d.held === 0 ? 'is-missing' : undefined}>
                  <th scope="row">{dayLabel(d.start)}</th>
                  <td className="is-num">{d.held ? d.held : outside ? 'not held locally' : 'none held'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
    </>
  )
}

// ---------------------------------------------------------------- reference defaults

export function ReferenceSummary({ ctx }: { ctx: PageContext }) {
  const response = ctx.response as ReferenceRowsResponse | null
  const fetched = isoDayText(ctx.dataset.coverage?.last_ingested)
  return (
    <>
      <dl className="gf-stats">
        <div>
          <dt>Rows</dt>
          <dd>{(response?.rows.length ?? ctx.dataset.coverage?.rows ?? 0).toLocaleString('en-GB')}</dd>
        </div>
        <div>
          <dt>Columns</dt>
          <dd>{Object.keys(response?.rows[0] ?? {}).length}</dd>
        </div>
        {fetched && (
          <div>
            <dt>Last fetched</dt>
            <dd>{fetched}</dd>
          </div>
        )}
      </dl>
      <p className="gf-hint">A table with no clock: the range doesn't apply. Search reads its text columns.</p>
    </>
  )
}

/** Rows counted by the view's `countBy` column, or, without one, the columns and what they hold. */
export function ReferenceCounts({ ctx }: { ctx: PageContext }) {
  const response = ctx.response as ReferenceRowsResponse | null
  const view = ctx.view as ReferenceView
  if (!response) return null
  const field = view.countBy
  if (!field) {
    const keys = Object.keys(response.rows[0] ?? {})
    return (
      <ul className="gf-cols">
        {keys.map((k) => (
          <li key={k}>
            <code>{k}</code>
            <span>{plural(new Set(response.rows.map((r) => r[k])).size, 'distinct value', 'distinct values')}</span>
          </li>
        ))}
      </ul>
    )
  }
  const counts = new Map<string, number>()
  for (const r of response.rows) counts.set(String(r[field] ?? 'none'), (counts.get(String(r[field] ?? 'none')) ?? 0) + 1)
  const max = Math.max(1, ...counts.values())
  return (
    <ul className="gf-counts">
      {[...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([k, n]) => (
          <li key={k}>
            <span className="gf-counts-label">{k}</span>
            <span className="gf-counts-bar" aria-hidden="true">
              <span style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="gf-counts-value">{n}</span>
          </li>
        ))}
    </ul>
  )
}

// ---------------------------------------------------------------- about (every body)

/** The side panel's default: what the dataset is, how it is read, and how far it runs locally. */
export function About({ ctx }: { ctx: PageContext }) {
  const d = ctx.dataset
  const view = ctx.view
  const specs = view.body === 'series' ? (view as SeriesView).values : undefined
  const columns = d.values.map((v) => {
    const spec = specs?.find((s) => s.column === v.column)
    const unit = displayUnit(spec?.unit ?? v.unit, spec?.display)
    const note = !unit.numeric ? 'text' : unit.label === null ? 'unit unconfirmed' : unit.source === 'MW' && unit.label === 'GW' ? 'MW, shown as GW' : unit.label
    return { column: v.column, note }
  })
  const filters = Object.entries(ctx.response?.filters ?? {})
  const depth = depthText(d.coverage)
  return (
    <dl className="gf-facts">
      <div>
        <dt>Dataset</dt>
        <dd>
          <code>{d.id}</code>, {ctx.fixture ? 'made in the browser' : `from ${sourceName(ctx.source)} (${ctx.source.host})`}
        </dd>
      </div>
      <div>
        <dt>Columns</dt>
        <dd>
          {columns.map((c, i) => (
            <Fragment key={c.column}>
              {i > 0 && '; '}
              <code>{c.column}</code> {c.note}
            </Fragment>
          ))}
        </dd>
      </div>
      {ctx.response?.group && (
        <div>
          <dt>Split by</dt>
          <dd>
            <code>{ctx.response.group}</code>
          </dd>
        </div>
      )}
      {filters.length > 0 && (
        <div>
          <dt>Filtered to</dt>
          <dd>
            {filters.map(([k, v], i) => (
              <Fragment key={k}>
                {i > 0 && '; '}
                <code>{k}</code> {String(v)}
              </Fragment>
            ))}
          </dd>
        </div>
      )}
      <div>
        <dt>Cadence</dt>
        <dd>{cadenceOf(ctx.response?.grain_ms ?? null, d)}</dd>
      </div>
      <div>
        <dt>Held locally</dt>
        <dd>{!d.held ? `Nothing: ${notHeldText(d.not_held_cause)}` : (depth ?? (d.kind === 'reference' ? plural(d.coverage?.rows ?? 0, 'row', 'rows') : 'nothing yet'))}</dd>
      </div>
      <div>
        <dt>Fetched</dt>
        <dd>{ctx.fixture ? 'Never: made in the browser' : d.schedule ? `${d.schedule[0].toUpperCase()}${d.schedule.slice(1)}, by gridflow` : 'Built by gridflow from other datasets'}</dd>
      </div>
    </dl>
  )
}
