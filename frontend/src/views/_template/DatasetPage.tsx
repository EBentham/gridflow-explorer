/**
 * The dataset page (DESIGN §5), drawn from a family folder's view config:
 *
 * 1. Head: the source's symbol as the emblem, the H1, one sentence, and a
 *    stamp naming the window and "UK time".
 * 2. Toolbar: the dataset switch (when the family has more than one held
 *    dataset on the page), the range (1 / 7 / 30 days / custom; by default
 *    the 7 days ending on the dataset's latest local day), then Chart | Table;
 *    under them, the family's datasets that aren't held locally.
 * 3. Grid: the main panel with the 272px key beside it, then the working
 *    panel with the side panel. Every panel has its H2, its source line and,
 *    on fixture data, the dashed-ochre Fixture tag.
 *
 * It reads the manifest and the rows through the page's adapter, and sets
 * `data-view-ready` only once the manifest, the rows and every related
 * dataset have settled into data, an empty window or an error.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FixtureTag, Head, Panel, PendingNote, RangeControl, Screen, Segmented, Toolbar, ViewSwitch, type PanelArea, type ViewState } from '../../design/frame'
import { useAnchoredRange, useViewParam } from '../../design/range'
import { SourceEmblem } from '../../design/symbols'
import { rangeText } from '../../design/time'
import type { DateRange } from '../../lib/range'
import type { Manifest, ManifestDataset, ManifestFamily, ManifestSource, RowsRequest, RowsResponse } from '../contract'
import type { DatasetView, PageContext, PanelSlots, QuerySpec, RelatedData, SlotSpec, ViewConfig } from '../define'
import { adapterFor } from '../_data/adapters'
import { useManifest, useRowsList, type Load } from '../_data/hooks'
import type { RegisteredView } from '../registry'
import { panelTitle, slotsFor } from './defaults'
import { About, ErrorWords, PageNotes, SourceLine } from './panels'
import { buildSeriesModel } from './seriesModel'
import { emptyWindowText, isoDayText, notHeldText, sourceName } from './text'
import './template.css'

const FIXTURE_NOTE = 'Synthetic data made in the browser, not read from gridflow.'

const AREAS: [keyof PanelSlots, PanelArea][] = [
  ['main', 'main'],
  ['key', 'key'],
  ['working', 'wide'],
  ['side', 'side'],
]

function toViewState(load: Load<RowsResponse> | undefined): ViewState {
  if (!load || load.state === 'loading') return 'loading'
  if (load.state !== 'data') return load.state
  return load.value && load.value.rows.length > 0 ? 'data' : 'empty'
}

function resolveQuery(view: DatasetView, params: URLSearchParams): QuerySpec {
  return typeof view.query === 'function' ? view.query(params) : (view.query ?? {})
}

const repeats = (xs: string[]) => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))]

/** What the view config asks for that gridflow's source list doesn't have, each as a sentence. The page shows these instead of data. */
function configProblems(config: ViewConfig, family: ManifestFamily, manifest: Manifest): string[] {
  const out: string[] = []
  if (!config.datasets.length) out.push('This page lists no dataset.')
  for (const id of repeats(config.datasets.map((v) => v.id))) out.push(`This page lists ${id} twice.`)
  for (const v of config.datasets) {
    const d = family.datasets.find((x) => x.id === v.id)
    if (!d) {
      out.push(`This page names ${v.id}, which isn't in the ${family.label} group.`)
      continue
    }
    const known = new Set(d.values.map((x) => x.column))
    if (v.body === 'series') for (const s of v.values ?? []) if (!known.has(s.column)) out.push(`This page draws ${s.column}, which ${d.id} doesn't have.`)
    const query = typeof v.query === 'object' ? v.query : undefined
    if (query?.group && !d.dims.some((x) => x.column === query.group)) out.push(`This page splits ${d.id} by ${query.group}, which isn't one of its columns to split by.`)
    for (const k of repeats((v.related ?? []).map((r) => r.key))) out.push(`This page reads two datasets under the name ${k}.`)
    for (const r of v.related ?? []) {
      const listed = manifest.sources.find((s) => s.key === r.source)?.families.some((f) => f.datasets.some((x) => x.id === r.dataset))
      if (!listed) out.push(`This page reads ${r.dataset} from ${r.source} beside ${d.id}, and gridflow's source list has no such dataset.`)
    }
  }
  return out
}

function Ids({ ds }: { ds: ManifestDataset[] }) {
  return ds.map((d, i) => (
    <span key={d.id}>
      {i > 0 && (i === ds.length - 1 ? ' and ' : ', ')}
      <code>{d.id}</code>
    </span>
  ))
}

/** The family's datasets that aren't held, grouped by why, and the held ones this page leaves out. */
function FamilyNote({ family, config, layer }: { family: ManifestFamily; config: ViewConfig; layer: ManifestSource['layer'] }) {
  const notHeld = family.datasets.filter((d) => !d.held)
  const leftOut = family.datasets.filter((d) => d.held && !config.datasets.some((v) => v.id === d.id))
  if (!notHeld.length && !leftOut.length) return null
  // Grouped by the cause as said of one dataset, then said of as many as share it.
  const byCause = new Map<string, ManifestDataset[]>()
  for (const d of notHeld) {
    const why = notHeldText(d.not_held_cause)
    byCause.set(why, [...(byCause.get(why) ?? []), d])
  }
  return (
    <p className="gf-toolbar-line">
      {notHeld.length > 0 && (
        <>
          Not held locally:{' '}
          {[...byCause.entries()].map(([why, ds], i) => (
            <span key={why}>
              {i > 0 && '; '}
              <Ids ds={ds} /> ({notHeldText(ds[0].not_held_cause, { many: ds.length > 1, layer })})
            </span>
          ))}
          .{' '}
        </>
      )}
      {leftOut.length > 0 && (
        <>
          Held, but not on this page: <Ids ds={leftOut} />.
        </>
      )}
    </p>
  )
}

function MainStatus({ state, error, dataset, window, layer }: { state: ViewState; error: Load<unknown>['error']; dataset?: ManifestDataset; window: DateRange | null; layer?: ManifestSource['layer'] }) {
  if (state === 'loading') return <p className="gf-state">Reading the local store…</p>
  if (state === 'refreshing') {
    return (
      <p className="gf-state" role="status">
        gridflow is refreshing the local store, so it can't be read for a moment. This page tries again every 15 seconds.
      </p>
    )
  }
  if (state === 'error') {
    // Every code in plain words (text.ts, errorParts): never the backend's message or a 422's query-string hint.
    return (
      <p className="gf-state is-error" role="alert">
        {dataset ? (
          <>
            Couldn't read <code>{dataset.id}</code>.{' '}
          </>
        ) : (
          "Couldn't read gridflow's source list. "
        )}
        <ErrorWords error={error} />
      </p>
    )
  }
  if (state === 'empty' && dataset && !dataset.held) {
    return (
      <p className="gf-state">
        <code>{dataset.id}</code> isn't held locally: {notHeldText(dataset.not_held_cause, { layer })}. The Explorer only shows what gridflow holds.
      </p>
    )
  }
  if (state === 'empty') return <p className="gf-state">{dataset?.kind === 'reference' ? 'The table is held, but it has no rows.' : emptyWindowText(window, dataset?.coverage ?? null)}</p>
  return null
}

function ConfigProblems({ problems }: { problems: string[] }) {
  return (
    <div className="gf-state is-error" role="alert">
      <p>This page asks for what gridflow's source list doesn't have, so it shows nothing:</p>
      <ul>
        {problems.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  )
}

export function DatasetPage({ entry }: { entry: RegisteredView }) {
  const { config } = entry
  const adapter = adapterFor(config)
  const fixture = adapter.origin === 'fixture'
  const manifest = useManifest(adapter)
  const [params, setSearch] = useSearchParams()
  const [mode, setMode] = useViewParam()

  const source = manifest.value?.sources.find((s) => s.key === entry.source)
  const family = source?.families.find((f) => f.slug === entry.family)
  const problems = useMemo(() => (family && manifest.value ? configProblems(config, family, manifest.value) : []), [config, family, manifest.value])
  const entries = config.datasets.map((view) => ({ view, dataset: family?.datasets.find((d) => d.id === view.id) }))
  const held = entries.filter((e) => e.dataset?.held)
  const fallback = held[0] ?? entries.find((e) => e.dataset)
  const active = entries.find((e) => e.view.id === params.get('dataset') && e.dataset) ?? fallback
  const view = active?.view ?? config.datasets[0]
  const dataset = active?.dataset
  const reference = dataset?.kind === 'reference'
  // The switch offers the held datasets, and the open one even when it isn't held, so it shows where you are.
  const switchable = entries.filter((e) => e.dataset?.held || e === active)

  // Undefined while the source list is read: the range waits for its anchor rather than guess one.
  const latest = manifest.state !== 'data' ? undefined : dataset?.held ? (dataset.coverage?.latest_local_day ?? null) : null
  const range = useAnchoredRange(latest)
  // A table with no clock has no window; nor does a dataset that isn't held, as nothing is read.
  const window = reference || dataset?.held === false ? null : range.range
  const queryKey = JSON.stringify(resolveQuery(view, params))
  const ready = Boolean(dataset?.held && !problems.length && (reference || window))

  const requests = useMemo<RowsRequest[]>(() => {
    if (!ready || !dataset) return []
    const span = window ? { start: window.start, end: window.end } : {}
    const query = JSON.parse(queryKey) as QuerySpec
    return [
      { source: entry.source, dataset: dataset.id, ...span, ...query },
      ...(view.related ?? []).map((r) => ({ source: r.source, dataset: r.dataset, ...span, ...(r.query ?? {}) })),
    ]
  }, [ready, dataset, window, queryKey, entry.source, view.related])
  const loads = useRowsList(adapter, requests)
  const main = requests.length ? loads[0] : undefined
  const response = main?.state === 'data' ? main.value : null

  const series = useMemo(
    () =>
      view.body === 'series' && response?.kind === 'series'
        ? buildSeriesModel(response, { values: view.values, groups: view.groups, maxSeries: view.chart ? view.chart.maxSeries : undefined })
        : null,
    [view, response],
  )
  const related = useMemo(() => {
    const out: Record<string, RelatedData> = {}
    if (!requests.length) return out
    ;(view.related ?? []).forEach((spec, i) => {
      const load = loads[i + 1]
      const value = load?.state === 'data' ? load.value : null
      const relSource = manifest.value?.sources.find((s) => s.key === spec.source) ?? null
      out[spec.key] = {
        spec,
        source: relSource,
        dataset: relSource?.families.flatMap((f) => f.datasets).find((d) => d.id === spec.dataset) ?? null,
        state: toViewState(load),
        response: value,
        error: load?.error ?? null,
        series: value?.kind === 'series' ? buildSeriesModel(value, { values: spec.values, groups: spec.groups, from: spec.key }) : null,
      }
    })
    return out
  }, [requests.length, view.related, loads, manifest.value])

  let state: ViewState
  if (manifest.state !== 'data') state = manifest.state
  else if (!source || !family || problems.length || !dataset) state = 'error'
  else if (!dataset.held) state = 'empty'
  else if (!main) state = 'loading'
  else if (main.state !== 'data') state = main.state
  else if (Object.values(related).some((r) => r.state === 'loading')) state = 'loading'
  else state = toViewState(main)

  // The focused series belongs to its dataset; a picked day to its window.
  const scope = dataset?.id ?? ''
  const windowScope = `${scope}|${window?.start}|${window?.end}`
  const [focusState, setFocusState] = useState<{ scope: string; key?: string }>({ scope: '' })
  const [pickState, setPickState] = useState<{ scope: string; day?: number }>({ scope: '' })
  const focus = focusState.scope === scope ? focusState.key : undefined
  const picked = pickState.scope === windowScope ? pickState.day : undefined
  const setFocus = useCallback((key: string | undefined) => setFocusState({ scope, key }), [scope])
  const pick = useCallback((day: number | undefined) => setPickState({ scope: windowScope, day }), [windowScope])

  const setParams = useCallback(
    (changes: Record<string, string | null>) =>
      setSearch(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(changes)) {
            if (v === null || v === '') next.delete(k)
            else next.set(k, v)
          }
          return next
        },
        { replace: true },
      ),
    [setSearch],
  )
  const setParam = useCallback((name: string, value: string | null) => setParams({ [name]: value }), [setParams])

  const switchTo = (id: string) => {
    // A dataset's column filters and search don't carry over to another one.
    const stale = Object.fromEntries([...params.keys()].filter((k) => k.startsWith('f.') || k === 'q').map((k) => [k, null]))
    setParams({ ...stale, dataset: id === fallback?.view.id ? null : id })
  }

  const windowText = window ? rangeText(window.start, window.end) : ''
  const lastFetched = isoDayText(dataset?.coverage?.last_ingested)
  const stamp = window
    ? `${windowText}, UK time`
    : reference
      ? lastFetched
        ? `The whole table, as last fetched on ${lastFetched}, UK time`
        : 'The whole table: it has no clock'
      : undefined
  const hasChart = (view.body === 'series' && view.chart !== false) || (view.body === 'events' && Boolean(view.strip))
  const tag = fixture ? <FixtureTag title={FIXTURE_NOTE} /> : undefined

  const ctx: PageContext | null =
    source && family && dataset && manifest.value
      ? {
          config,
          view,
          source,
          family,
          dataset,
          readAt: manifest.value.generated_at,
          fixture,
          range: reference ? null : range,
          window,
          windowText,
          // A series shown as a table has no chart, whatever `?view=` says.
          mode: view.body === 'series' && view.chart === false ? 'table' : mode,
          state,
          error: main?.error ?? null,
          response,
          series,
          related,
          focus,
          setFocus,
          picked,
          pick,
          param: (name) => params.get(name),
          setParam,
          setParams,
        }
      : null

  const slots = slotsFor(view)
  const settled = state === 'data' || state === 'empty'
  const srcOf = (area: keyof PanelSlots, slot: SlotSpec): ReactNode => {
    if (!ctx) return source ? `${sourceName(source)}, reading its source list…` : undefined
    // A dataset that isn't held has no columns, unit or window to name, whatever the slot would say.
    if (!ctx.dataset.held && area !== 'side') return <SourceLine ctx={ctx} what="not held locally" window={false} />
    return slot.src ? slot.src(ctx) : <SourceLine ctx={ctx} />
  }
  const body = (area: keyof PanelSlots): ReactNode => {
    const { Body } = slots[area]
    if (area === 'main') {
      if (problems.length) return <ConfigProblems problems={problems} />
      if (manifest.state === 'data' && !family) {
        return (
          <p className="gf-state is-error" role="alert">
            gridflow's source list has no group {entry.family} under {entry.source}, so this page has nothing to read.
          </p>
        )
      }
      return (
        <>
          {ctx && <PageNotes ctx={ctx} />}
          {state === 'data' && ctx ? <Body ctx={ctx} /> : <MainStatus state={state} error={main?.error ?? manifest.error} dataset={dataset} window={window} layer={source?.layer} />}
        </>
      )
    }
    if (!ctx) return <PendingNote state={state} />
    // About reads the source list alone, so it shows in every state: most of all when the rows fail.
    if (area === 'side' && Body === About) return <Body ctx={ctx} />
    if (!dataset?.held) return area === 'side' ? <Body ctx={ctx} /> : <p className="gf-hint">Nothing to show: this dataset isn't held locally.</p>
    if (!settled) return <PendingNote state={state} />
    return <Body ctx={ctx} />
  }

  return (
    <Screen state={state}>
      <nav className="gf-crumb" aria-label="Breadcrumb">
        <Link to="/sources" className="gf-crumb-link">
          All sources
        </Link>
        {source && (
          <>
            <span aria-hidden="true">/</span>
            {/* A live source has its page; the fixture's made-up source has none. */}
            {fixture ? (
              <span>{source.name}</span>
            ) : (
              <Link to={`/sources/${source.key}`} className="gf-crumb-link">
                {source.name}
              </Link>
            )}
          </>
        )}
      </nav>
      <Head
        emblem={source ? <SourceEmblem source={source.key} domain={source.domain} /> : undefined}
        title={config.title}
        sub={view.sub ?? config.sub}
        stamp={stamp}
        badge={fixture ? <FixtureTag title={FIXTURE_NOTE}>Fixture data: made in the browser</FixtureTag> : undefined}
      />
      <Toolbar>
        {switchable.length > 1 && <Segmented label="Dataset" options={switchable.map((e) => ({ value: e.view.id, label: e.view.label }))} value={view.id} onChange={switchTo} />}
        {!reference && dataset?.held !== false && <RangeControl state={range} />}
        {hasChart && dataset?.held !== false && <ViewSwitch value={mode} onChange={setMode} />}
        {ctx && dataset?.held && view.controls && <view.controls ctx={ctx} />}
        {reference && <span className="gf-toolbar-note">A table with no clock: no range and no chart.</span>}
        {family && source && <FamilyNote family={family} config={config} layer={source.layer} />}
      </Toolbar>
      <div className="gf-grid">
        {AREAS.map(([area, gridArea]) => {
          const slot = slots[area]
          return (
            <Panel key={area} area={gridArea} title={panelTitle(view, area, ctx)} src={srcOf(area, slot)} tag={tag}>
              {body(area)}
            </Panel>
          )
        })}
      </div>
    </Screen>
  )
}
