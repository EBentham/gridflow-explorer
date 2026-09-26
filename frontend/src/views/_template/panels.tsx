/**
 * What the template puts in panels: the source line every panel carries,
 * the main panel's notes (thin coverage and truncation, the page's own
 * dataset's and each related one's, and the page's caveats), and the default
 * key, working and side contents of each body. A page replaces any of them
 * through `panels` in its config and can reuse these.
 */
import { Fragment, type ReactNode } from 'react'
import type { ApiError } from '../../api/client'
import { KeyList, type KeyItem } from '../../design/charts'
import { listText, plural } from '../../design/format'
import { DAY_MS, dayLabel, instantLabel, periodLabel, stepNoun } from '../../design/time'
import type { EventsRowsResponse, ManifestDataset, ManifestSource, ReferenceRowsResponse, Scalar } from '../contract'
import type { EventsView, PageContext, ReferenceView, RelatedData, SeriesView } from '../define'
import { wordsOf } from './cells'
import { daySeries, heldDays, keyStamp, relatedFilters, type SourcePart } from './panelHelpers'
import { daySummaries, latestValue, periodName, seriesId, type SeriesDef, type SeriesModel } from './seriesModel'
import { planPanels } from './seriesPanels'
import { cadenceOf, coverageSentences, depthText, errorParts, isoDayText, meansText, notHeldText, sourceName, truncationSentences } from './text'
import { displayUnit } from './units'

// ---------------------------------------------------------------- errors

/** What went wrong, in plain words (`errorParts`), with column ids in mono. */
export function ErrorWords({ error }: { error: ApiError | null }) {
  return errorParts(error).map((p, i) => (typeof p === 'string' ? <Fragment key={i}>{p}</Fragment> : <code key={i}>{p.id}</code>))
}

// ---------------------------------------------------------------- source line

/** `market day-ahead`, or `area GB and status Active`: equality filters, the columns as identifiers. */
function FilterList({ filters }: { filters: [string, Scalar][] }) {
  return filters.map(([k, v], i) => (
    <Fragment key={k}>
      {i > 0 && (i === filters.length - 1 ? ' and ' : ', ')}
      <code>{k}</code> {String(v)}
    </Fragment>
  ))
}

function Part({ part, fixture }: { part: SourcePart; fixture: boolean }) {
  const cols = part.columns ?? []
  const filters = Object.entries(part.filters ?? {})
  // A split a filter pins to one value is named by the filter, not the split.
  const by = part.by && !filters.some(([k]) => k === part.by) ? part.by : null
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
      {by && (
        <>
          {' '}
          by <code>{by}</code>
        </>
      )}
      {filters.length > 0 && (
        <>
          , <FilterList filters={filters} /> only
        </>
      )}
      {part.unit !== undefined && <>, {part.unit ?? 'unit unconfirmed'}</>}
    </>
  )
}

/**
 * A panel's source line (DESIGN §5): who publishes each dataset shown, its
 * id and columns as identifiers, the split, the filters and the unit; then
 * what the panel shows and the window. `Elexon BMRS mid, market_index_price,
 * data_provider_id APXMIDP only, £/MWh, 16 Sep – 22 Sep 2026`. A panel drawing
 * a related dataset too names it in `also`.
 */
export function SourceLine({
  ctx,
  dataset,
  source,
  columns,
  by,
  filters,
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
  /** The equality filters the rows carry, e.g. `ctx.response?.filters`; a default filter is named here. */
  filters?: Record<string, Scalar> | null
  /** What the panel shows, in words: `mean per UK day`. */
  what?: ReactNode
  unit?: string | null
  /** Further datasets the panel shows (a related one), each named in full. */
  also?: SourcePart[]
  window?: boolean
}) {
  const parts: SourcePart[] = [{ source: source ?? ctx.source, dataset: dataset?.id ?? ctx.dataset.id, columns, by, filters, unit }, ...also]
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

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/**
 * What a related dataset's response says of itself: a local depth shorter
 * than the window (when it differs from the page's own), and anything cut
 * down or changed.
 */
function relatedFacts(ctx: PageContext, rel: RelatedData): string[] {
  const response = rel.response
  if (!response) return []
  const own = ctx.dataset.coverage
  const theirs = response.coverage
  const sameDepth = own?.first_day === theirs.first_day && own?.last_day === theirs.last_day
  const depth = ctx.window && !sameDepth ? coverageSentences({ coverage: theirs, window: ctx.window, days: [], stepMs: null }) : []
  return [...depth, ...truncationSentences(response, rel.dataset)]
}

/**
 * The main panel's plain words under its source line: how thin the local
 * coverage is and what a truncated response left out, for the page's own
 * dataset and then, a line each, every related one; then the page's caveats.
 * A cut-down dataset is never silent. Nothing when there is nothing to say.
 */
export function PageNotes({ ctx }: { ctx: PageContext }) {
  const facts: string[] = []
  if (ctx.window && ctx.state === 'data') {
    // A series stepping more than a day (weekly) holds no row on most days by design: its days aren't counted.
    const step = ctx.series?.stepMs ?? null
    const days = step !== null && step > DAY_MS ? [] : heldDays(ctx)
    const coverage = ctx.dataset.coverage
    facts.push(...coverageSentences({ coverage, window: ctx.window, days, stepMs: step }).filter((s) => ctx.response?.kind !== 'events' || !s.includes(' holds ')))
  }
  if (ctx.response) facts.push(...truncationSentences(ctx.response, ctx.dataset))
  const beside: { rel: RelatedData; said: string[] }[] = []
  if (ctx.state === 'data') {
    for (const rel of Object.values(ctx.related)) {
      const said = relatedFacts(ctx, rel)
      if (said.length) beside.push({ rel, said })
    }
  }
  const caveats = [...(ctx.config.caveats ?? []), ...(ctx.view.caveats ?? [])]
  if (!facts.length && !beside.length && !caveats.length) return null
  return (
    <div className="gf-notes">
      {facts.length > 0 && <p>{facts.join(' ')}</p>}
      {beside.map(({ rel, said }) => (
        <p key={rel.spec.key}>
          {rel.spec.label} from <code>{rel.spec.dataset}</code>: {lowerFirst(said.join(' '))}
        </p>
      ))}
      {caveats.length > 0 && <p className="is-caveat">{caveats.join(' ')}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- series defaults

function markOf(kind: string | undefined, color: string): KeyItem['mark'] {
  return kind === 'line' ? { kind: 'line', color } : { kind: 'swatch', color }
}

/** A key row's own period, under it, when its latest value isn't at the key's stamp. */
function KeyWhen({ latest, stepMs, stamp, settlement }: { latest: { t: number } | null; stepMs: number | null; stamp: ReturnType<typeof keyStamp>; settlement: SeriesModel['settlement'] }) {
  if (!latest || (stamp && stamp.t === latest.t && stamp.stepMs === stepMs)) return null
  return <span className="gf-series-when">{periodName(latest.t, stepMs, settlement)}</span>
}

/** Text-only rows: what the key says instead of a list. */
function TextOnly({ ctx }: { ctx: PageContext }) {
  const cols = ctx.series?.textColumns ?? []
  const labels = new Map(((ctx.view as SeriesView).values ?? []).map((v) => [v.column, v.label]))
  return (
    <p className="gf-hint">
      These rows hold text, not numbers (
      {cols.map((c, i) => (
        <Fragment key={c.column}>
          {i > 0 && (i === cols.length - 1 ? ' and ' : ', ')}
          {labels.get(c.column) ?? <code>{c.column}</code>}
        </Fragment>
      ))}
      ), so there is no value to key. The table shows each row.
    </p>
  )
}

/** A series shown as a table: each series' latest held value. Select one to read it in the days table. */
function LatestValues({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model || !model.drawn.length) return <p className="gf-hint">Nothing is held in this window, so there is no latest value.</p>
  const stamp = keyStamp(ctx)
  const pickable = model.drawn.length > 1
  return (
    <>
      <ul className="gf-series-key">
        {model.drawn.map((d) => {
          const id = seriesId(d)
          const latest = latestValue(model, d)
          const on = ctx.focus === id
          return (
            <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <span className="gf-series-name">{d.label}</span>
                <span className="gf-series-value">{latest ? d.unit.format(latest.v) : '–'}</span>
              </button>
              <KeyWhen latest={latest} stepMs={model.stepMs} stamp={stamp} settlement={model.settlement} />
            </li>
          )
        })}
      </ul>
      {pickable && <p className="gf-hint">{ctx.focus ? 'Select it again to read the first.' : 'Select one to read it in the days table.'}</p>}
      {model.undrawn.length > 0 && <p className="gf-hint">And {plural(model.undrawn.length, 'more series', 'more series')} in the table.</p>}
      {model.empty.length > 0 && <p className="gf-hint">No value held in this window: {listText(model.empty.map((d) => d.label))}.</p>}
    </>
  )
}

/**
 * The series key: every drawn series with its mark and latest value; select
 * one to draw it alone. A series shown as a table lists its latest values
 * instead, and text-only rows say they have none.
 */
export function SeriesKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (model && !model.all.length && model.textColumns.length) return <TextOnly ctx={ctx} />
  if ((ctx.view as SeriesView).chart === false) return <LatestValues ctx={ctx} />
  const plan = planPanels(ctx)
  const drawn = plan.panels.flatMap((p) => p.series)
  if (!model || !drawn.length) return <p className="gf-hint">Nothing is held in this window, so there is nothing to key.</p>
  const modelOf = (d: SeriesDef) => (d.from === 'self' ? model : ctx.related[d.from]?.series)
  const stamp = keyStamp(ctx)
  const pickable = drawn.length > 1
  return (
    <>
      <ul className="gf-series-key">
        {drawn.map((d) => {
          const id = seriesId(d)
          const m = modelOf(d)
          const latest = m ? latestValue(m, d) : null
          const on = ctx.focus === id
          return (
            <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <KeyList items={[{ key: id, mark: markOf(plan.marks.get(id), d.color), label: <span className="gf-series-name">{d.label}</span> }]} />
                <span className="gf-series-value">{latest ? d.unit.format(latest.v) : '–'}</span>
              </button>
              <KeyWhen latest={latest} stepMs={m?.stepMs ?? null} stamp={stamp} settlement={m?.settlement ?? null} />
            </li>
          )
        })}
      </ul>
      {plan.belowZero && <KeyList items={[{ key: 'below-zero', mark: { kind: 'band' }, label: `${plan.belowZero.label} below zero` }]} />}
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

/** Text-only rows per UK day: how many hold something. */
function RowsPerDay({ ctx }: { ctx: PageContext }) {
  const days = heldDays(ctx)
  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Rows held
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.day} className={d.held === 0 ? 'is-missing' : undefined}>
                <th scope="row">{dayLabel(d.start)}</th>
                <td className="is-num">{d.held || 'none held'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
    </>
  )
}

/** A series stepping more than a day (weekly): each step in the window, its value or none held. */
function PointList({ ctx, def }: { ctx: PageContext; def: SeriesDef }) {
  const model = ctx.series
  if (!model) return null
  const points = model.rows.filter((r) => def.field in r)
  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col" className="is-num">
                {def.unit.label ?? 'Value'}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((r) => {
              const v = r[def.field]
              return (
                <tr key={r.t} className={typeof v === 'number' ? undefined : 'is-missing'}>
                  <th scope="row">{periodLabel(r.t, model.stepMs)}</th>
                  <td className="is-num">{typeof v === 'number' ? def.unit.plain(v) : 'not held locally'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        {def.label}: {plural(points.length, 'period', 'periods')} in this window, oldest first.
        {model.drawn.length > 1 ? ' Select a series in the key to read another.' : ''}
      </p>
    </>
  )
}

/**
 * Every UK day in the window: held half-hours, and one series' mean, lowest
 * and highest. Select a day to mark it. A daily series lists its value per
 * day; one stepping more than a day lists its steps; text-only rows count
 * the rows each day holds.
 */
export function SeriesDays({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (model && !model.all.length && model.textColumns.length) return <RowsPerDay ctx={ctx} />
  const def = daySeries(ctx)
  if (!model || !ctx.window || !def) return <p className="gf-hint">Nothing is held in this window, so there are no days to summarise.</p>
  if (model.stepMs !== null && model.stepMs > DAY_MS) return <PointList ctx={ctx} def={def} />
  const days = daySummaries(model, ctx.window, def)
  const daily = model.stepMs !== null && model.stepMs >= DAY_MS
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
  const spec = by && ctx.view.body === 'events' ? ctx.view.columns?.find((c) => c.field === by) : undefined
  const said = (k: string) => (spec ? (wordsOf(spec, k) ?? k) : k)
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
                <dt>{said(k)}</dt>
                <dd>{n}</dd>
              </div>
            ))}
        </dl>
      )}
      {by && <p className="gf-hint">Counts by {spec?.label ? spec.label.toLowerCase() : <code>{by}</code>}. Filter the table to read one group.</p>}
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
  // Charts show MW as GW; tables keep MW unless a column asks otherwise (cells.tsx).
  const series = view.body === 'series'
  const columns = d.values.map((v) => {
    const spec = series ? (view as SeriesView).values?.find((s) => s.column === v.column) : (view as EventsView | ReferenceView).columns?.find((c) => c.field === v.column)
    const unit = displayUnit(spec?.unit ?? v.unit, spec?.display ?? (series ? 'GW' : 'MW'))
    const note = !unit.numeric ? 'text' : unit.label === null ? 'unit unconfirmed' : unit.source === 'MW' && unit.label === 'GW' ? 'MW, shown as GW' : unit.label
    return { column: v.column, note }
  })
  const filters = Object.entries(ctx.response?.filters ?? {})
  // A split a filter pins to one value draws as the columns themselves (seriesModel.ts).
  const split = series ? ctx.series?.group : ctx.response?.group
  const beside = Object.values(ctx.related)
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
      {split && (
        <div>
          <dt>Split by</dt>
          <dd>
            <code>{split}</code>
          </dd>
        </div>
      )}
      {filters.length > 0 && (
        <div>
          <dt>Filtered to</dt>
          <dd>
            <FilterList filters={filters} />
          </dd>
        </div>
      )}
      {beside.length > 0 && (
        <div>
          <dt>Read beside it</dt>
          <dd>
            {beside.map((rel, i) => {
              const f = Object.entries(relatedFilters(rel))
              return (
                <Fragment key={rel.spec.key}>
                  {i > 0 && '; '}
                  {rel.spec.label} from <code>{rel.spec.dataset}</code>
                  {f.length > 0 && (
                    <>
                      , <FilterList filters={f} /> only
                    </>
                  )}
                </Fragment>
              )
            })}
          </dd>
        </div>
      )}
      <div>
        <dt>Cadence</dt>
        {/* Rows that are bucket means come at the bucket's step, not the dataset's. */}
        <dd>{d.held ? cadenceOf(ctx.response?.truncation?.bucket_ms ? null : (ctx.response?.grain_ms ?? null), d) : 'Not known: nothing of it is held'}</dd>
      </div>
      <div>
        <dt>Held locally</dt>
        <dd>{!d.held ? `Nothing: ${notHeldText(d.not_held_cause, { layer: ctx.source.layer })}` : (depth ?? (d.kind === 'reference' ? plural(d.coverage?.rows ?? 0, 'row', 'rows') : 'nothing yet'))}</dd>
      </div>
      <div>
        <dt>Fetched</dt>
        <dd>{ctx.fixture ? 'Never: made in the browser' : d.schedule ? `${d.schedule[0].toUpperCase()}${d.schedule.slice(1)}, by gridflow` : 'Built by gridflow from other datasets'}</dd>
      </div>
    </dl>
  )
}
