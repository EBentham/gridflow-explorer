# Dataset pages: the builder's contract

Every catalogue family the Explorer draws gets one page at `/sources/<source>/<family>`. A
page is a **view config** plus, when it needs them, a few panel components. The template
draws everything else in the DESIGN §5 frame: the head, the toolbar, the four panels, the
source lines, the honesty states and the Fixture tags.

- `define.ts` is the typed shape of the config. This file says how to use it.
- `contract.ts` is the data: the manifest (`GET /api/sources`) and the rows responses.
- `frontend/DESIGN.md` is the look. It is locked; a page adds no new looks.
- The approved pilot page (P4-0) is the worked example to copy from. Until it lands, the demo
  family (`demo/dataset-page/`) shows every part of the template on synthetic data.

## Folder layout

```
src/views/
  README.md              this contract
  define.ts              the view config types, defineView, TEMPLATE_PARAMS
  contract.ts            the manifest and rows shapes, and the DataSource interface
  registry.ts            finds every page with import.meta.glob('./*/*/index.tsx')
  FamilyRoute.tsx        the route element: the page, or "No page yet"
  _template/             the frame, the three bodies, the default panels (template-owned)
  _data/                 adapters, loading hooks, the dev fixture (template-owned)
  demo/dataset-page/     the fixture demo family (P4-0 deletes it)
  <source>/<family>/     one page per family:
    index.tsx              the view config, and nothing else
    *.tsx                  the page's own panels and controls, if any
    NEEDS.md               only when the template or the endpoint lacks something
```

Folders starting with `_` belong to the template. The registry skips them.

## Adding a page

1. **Name the folder from the manifest.** `<source>` is `sources[].key` and `<family>` is
   `families[].slug` in `GET /api/sources` (the slug is the kebab case of the family label).
   There is no list to edit: the registry finds the folder, the route works, and the source
   page links the family.
2. **Write `index.tsx`.** It exports the config as its default export, and nothing else. A
   sketch for `elexon/market-index-price` (the pilot page is the real one):

   ```tsx
   import { defineView } from '../../define'

   const view = defineView({
     title: 'Market index price',
     sub: 'The half-hourly market index price, with the volume traded behind it.',
     datasets: [
       {
         id: 'mid',
         body: 'series',
         label: 'Market index',
         values: [
           { column: 'market_index_price', label: 'Market index price', color: 'var(--chart-price)' },
           { column: 'market_index_volume', label: 'Volume' },
         ],
         chart: { mark: 'line', lower: { values: ['market_index_volume'], mark: 'bars' } },
       },
     ],
   })

   export default view
   ```

   Components go in sibling files: oxlint's `only-export-components` rule warns when a file
   exports a component and anything else.
3. **Check it** (see "Gates" below), then look at every screenshot.

## The view config

### The page (`ViewConfig`)

| Field | What it is |
|---|---|
| `title` | The H1: the family as a reader would say it. |
| `sub` | One sentence under the H1: what this is and what it shows. |
| `datasets` | The family's datasets on this page, in the order of the toolbar's switch. The first held one opens by default. |
| `caveats` | Plain-words caveats for the whole family, shown in the main panel with each dataset's own. |
| `adapter` | `'fixture'` reads the dev fixture. Only the demo uses it. |

### Every dataset (`DatasetView`)

| Field | What it is |
|---|---|
| `id` | The manifest dataset id. It must be in this family. |
| `body` | `'series'`, `'events'` or `'reference'`: which template body draws it. It usually matches the manifest `kind`. |
| `label` | Its name in the toolbar's dataset switch: short, sentence case. |
| `title` | The main panel's H2. Default: `label`. |
| `sub` | The head's sentence for this dataset, when it differs from the page's `sub`. |
| `caveats` | Vintage, unit doubts, known faults, what a default filter leaves out. Written from the P1 card and the manifest notes, never pasted from them. |
| `query` | `{ group, filters }` for the rows request, or a function of the page's URL parameters returning one. `group` must be a `dims` column. `filters: null` clears the dataset's default filter. |
| `related` | Other datasets read for the same window, e.g. a price beside a volume (see below). |
| `panels` | Replacements for the `main`, `key`, `working` or `side` panel (see "Panels"). |
| `controls` | The page's own toolbar controls, after Chart and Table (see "Controls"). |

### Series (`body: 'series'`)

| Field | What it is |
|---|---|
| `values` | The columns to draw, in order: `{ column, label, unit, display, color }`. Default: every numeric value column. `unit` is only for a null or sentence unit that the P1 card settles; never a guess. `display: 'MW'` keeps MW where GW would hide the detail, e.g. one unit's output. `color` is a token, used when the series are the columns themselves. |
| `groups` | Labels and colours for the values of the `group` column: `{ value, label, color }`. Their order is the stack order, bottom first. Fuels use `var(--fuel-*)`; other entities use the `SERIES_COLORS` tokens. A colour follows its entity, never its index. |
| `chart.mark` | `'line'` (default), `'stacked'` (negatives stack below zero in their own stack) or `'bars'`. |
| `chart.values` | The columns in the main chart panel. Default: every drawn column that isn't in the lower panel. |
| `chart.lower` | A second panel on the same clock: `{ from, values, mark, height, extremes }`. Without `from` it takes this dataset's other columns (volume under a price). With `from: '<related key>'` it draws that related dataset. A column whose unit fits neither panel goes to the table only, and the page says so. |
| `chart.zero`, `chart.height` | Put zero on the value axis; the panel height. |
| `chart.extremes` | Label the highest and lowest value. Default: on for a single line. |
| `chart.maxSeries` | At most this many series are drawn (default 10). The rest are named in the key as not drawn, and listed in the table. They are never merged into "other". |

### Events (`body: 'events'`)

| Field | What it is |
|---|---|
| `timeLabel` | The event time's column header, e.g. `Published`. Default `Time`. |
| `columns` | `{ field, label, format, unit, display }` after the time. `format` is `'text'`, `'id'` (mono, for identifiers only), `'number'`, `'time'`, `'date'` or `'bool'`. Tables keep MW unless `display: 'GW'`. Default: every field, with formats read from the values. |
| `filters` | Fields that get a column filter, in the URL as `?f.<field>=`. Default: text and id fields holding 2 to 40 distinct values in the window. A field with one value in the window gets no filter unless one is set. |
| `sort` | `{ field, dir }`. Default: newest first. |
| `strip` | A count of events per period above the table, in the Chart view. `true` picks hours for a day or two and days beyond; `{ per: 'hour' \| 'day' }` fixes it. Without a strip there is no Chart view. |

### Reference (`body: 'reference'`)

A reference table has no clock: no range, no chart, and the stamp names when it was last
fetched.

| Field | What it is |
|---|---|
| `columns`, `sort` | As for events. Default sort: the first column, ascending. |
| `search` | Fields the search box reads. Default: every text and id column. |
| `countBy` | The working panel counts rows by this field. Without it, the panel lists the columns. |

### Related datasets (`RelatedSpec`)

`{ key, source, dataset, label, query, values, groups }`. A related dataset is read for the
same window as the page's own, through the same adapter, and it is part of the page's
readiness (see `data-view-ready`). Panels find it at `ctx.related[key]`, with its state,
its response, its series model, and its manifest source and dataset. It can come from
another source. That is how a page shows the relationship to price or demand.

### What the template checks

If the config names a dataset that isn't in the family, a column the dataset doesn't have,
a `group` that isn't one of its `dims`, a related dataset gridflow doesn't list, or the same
id or related key twice, the page shows those problems in words instead of data. Fix the
config; don't work around the check.

## What the template does, so a page doesn't

- **The window.** 1, 7 or 30 UK days, or a custom pair, in the URL (`?days=30`,
  `?from=…&to=…`). By default it is the 7 days ending on the dataset's `latest_local_day`,
  even when that day is a stub. The page then says how thin it is ("Tue 22 Sep holds 2 of
  48 half-hours") rather than moving the window. There is no "complete day" rule.
- **Coverage in plain words.** "Held locally for 8 Sep – 22 Sep 2026 only.", "6 of 7 days
  in this window hold rows.", partial days by name, and an empty window with where the local
  rows end.
- **Truncation in plain words.** A default filter ("Shows area GB only, this dataset's
  default. It leaves out 10 rows."), a top-N cut, group averaging, and a downsample
  ("Drawn as hourly means: …") each get a sentence. The `truncated` flag is never silent.
- **Datasets that aren't held.** The toolbar line names them with the reason in words, and
  a not-held dataset opens to a plain state, never an empty chart.
- **Gaps stay gaps.** Null values break lines and stacks, and tables show a dash. Nothing is
  zero-filled or interpolated across a missing step. A series on a coarser clock is drawn
  between its own points only.
- **Units and time.** MW columns show as GW (display only); money reads `−£67.40` with a
  true minus sign; an unknown unit says "unit unconfirmed". Axes and tooltips use the UK
  clock, and tooltips name the period (`Tue 15 Sep, 14:30–15:00 BST`). Settlement date and
  period appear only when the rows carry them.
- **Fixture data.** On the fixture adapter every panel gets the dashed-ochre Fixture tag,
  the head gets a badge, and lines are dashed.

## What a page may and may not do

A page **may**:

- choose its datasets, labels, marks, colours (tokens only), lower panel, related datasets,
  columns, filters and sort;
- write caveats from its P1 card and the manifest notes, in plain words;
- replace any of the four panels, and add toolbar controls with its own URL parameters.

A page **may not**:

- **fetch.** No `fetch`, no `src/api/` calls, no timers or effects that load data. Anything
  else it needs is a `related` dataset;
- **invent numbers.** No hardcoded or synthesised values, no zero-filling, no interpolation
  across gaps, and no statistic the rows don't support. A mean over a partial day says it
  is one;
- **edit shared code.** Leave `_template/`, `_data/`, `define.ts`, `contract.ts`,
  `registry.ts`, `src/design/`, the chart theme and the backend alone. Work around a gap
  inside your folder and write `NEEDS.md` (below);
- **style charts ad hoc.** Charts come from `design/chartTheme.ts` and `design/charts.tsx`,
  through the template's bodies or `SeriesChart`;
- **break the design.** Use no colour outside the tokens. Chartreuse is never a data colour.
  Mono is for identifiers only. Nothing on the DESIGN §10 list;
- **leak jargon.** Never print manifest notes or `not_held_cause` text as it stands. They
  carry internal references. Words like "silver", "manifest" and "configured" stay off the
  page;
- **use the fixture.** `adapter: 'fixture'` is for the demo only;
- **take the template's URL parameters.** `TEMPLATE_PARAMS` (`days`, `from`, `to`, `view`,
  `dataset`, `q`, `theme`, `fixture`) and anything starting `f.` (the events filters) are
  the template's.

## Panels

The grid (DESIGN §5) has four slots:

| Slot | Where | Series default | Events default | Reference default |
|---|---|---|---|---|
| `main` | Left, top: the chart or the table | `SeriesBody` | `EventsBody` | `ReferenceBody` |
| `key` | Right of main, 272px | Key: each series with its latest value; select one to draw it alone | In this window: counts, newest, oldest | Table: rows, columns, last fetched |
| `working` | Left, below main | Days in range: held, mean, lowest and highest per UK day | Events by day | Rows by `countBy`, or the columns |
| `side` | Right, below the key | About this data | About this data | About this data |

Replace a slot through `panels` on the dataset:

```tsx
panels: {
  working: {
    title: 'Price against volume',
    src: (ctx) => <SourceLine ctx={ctx} columns={['market_index_price', 'market_index_volume']} what="one dot per half-hour" />,
    Body: PriceVolume,
  },
},
```

- **`title`** is a string, or a function of the context. Before the source list is read,
  a function title falls back to the default slot's name.
- **`src`** is the source line (see below). Omitted, it names the dataset alone.
- **`Body`** gets `{ ctx }` (`PageContext`, in `define.ts`) and nothing else.

**When a body renders:**

- The main `Body` renders only when the rows hold data. Otherwise the template shows the
  loading, empty, error, refreshing or not-held state in words. The template also draws the
  coverage, truncation and caveat notes above any main body, so a replacement doesn't
  repeat them.
- The key, working and side bodies render once the page has settled on data or an empty
  window. Before that they show a quiet pending line. Handle an empty window
  (`ctx.state === 'empty'`, `ctx.series` with no series): say so in a sentence, never
  leave a blank panel.
- `src` runs in every state. Until the rows are read, `ctx.response` and `ctx.series` are
  null.

**The source line rule.** Every panel names what it shows: the publisher and dataset id
(mono), the columns (mono), the split, the unit and the window. Use `SourceLine`:

```tsx
<SourceLine ctx={ctx} columns={['market_index_price']} unit="£/MWh" what="mean per UK day" />
<SourceLine ctx={ctx} columns={cols} by={ctx.series?.group} unit={unitsOf(drawn)} also={relatedParts(ctx, drawn)} />
```

A panel that shows a related dataset names it too, with `also` (`relatedParts` builds it from
the series drawn). `window={false}` drops the window where it doesn't apply.

**Pieces to reuse** (import them from `_template/`; don't copy them):

- `panels.tsx`: `SourceLine`, `PageNotes`, `SeriesKey`, `SeriesDays`, `EventsSummary`,
  `EventsDays`, `ReferenceSummary`, `ReferenceCounts`, `About`.
- `WindowedTable.tsx`: the sortable, windowed table with sticky headers.
- `CountStrip.tsx`: events per hour or day as bars.
- `SeriesChart.tsx` and `seriesPanels.ts` (`planPanels`): the series chart.
- `panelHelpers.ts`: `unitsOf`, `heldDays`, `daySeries`, `relatedParts`, `plannedParts`.
- `seriesModel.ts`: the model on `ctx.series` (`all`, `drawn`, `undrawn`, `rows`,
  `stepMs`, `bucketed`), and `daySummaries`, `latestValue`, `extremesOf`.
- `units.ts` (`displayUnit`) and `text.ts` (`coverageSentences`, `truncationSentences`,
  `notHeldText`, `meansText`).
- From `src/design/`: `format.ts` for numbers and money, `time.ts` for the UK clock,
  `chartTheme.ts` and `charts.tsx` for chart parts, and `frame.tsx` for `Segmented`.

## Controls

`controls` draws a component in the toolbar, after Chart and Table, once the source list is
read. It reads and writes the page's own URL parameters with `ctx.param` and `ctx.setParam`
(or `ctx.setParams` for several at once), and a function `query` reads them back:

```tsx
query: (params) => (params.get('area') === 'all' ? { filters: null } : {}),
controls: AreaControl, // a Segmented: "GB only" | "All areas", writing ?area=all
```

A change of parameter reads the rows again. Parameters live in the URL, so a view can be
linked and shot.

## `data-view-ready`

The screenshot harness waits for `[data-view-ready]` on the page's `section.gf-screen` (20 s
at most). The template sets it from one state, and it is absent while anything is loading:

1. the source list (the manifest);
2. the config check (problems give `error`);
3. whether the dataset is held (not held gives `empty`);
4. the page dataset's rows (`data`, `empty`, `error`, or `refreshing` while gridflow holds
   the store);
5. every `related` dataset. The page stays unready until each one has settled; a related
   error doesn't fail the page, as its panel says what went wrong.

The rule that follows: **a panel derives everything from `ctx` and never loads anything on
its own.** If a panel waited on its own request, the harness would shoot a page that isn't
finished. Anything extra a page needs goes in `related`. Nothing renders later than the data
either: no lazy imports and no data effects. `refreshing` is a settled state: re-shoot after
2 minutes.

## Gates

Run these in `frontend/` before handing back:

```
npm run build
npm run lint
node "<main checkout>/.claude/skills/impeccable/scripts/detect.mjs" src/views/<source>/<family>
EXPLORER_API=http://127.0.0.1:8001 npm run shoot -- "/sources/<source>/<family>" "/sources/<source>/<family>?view=table"
```

Shoot every dataset (`?dataset=<id>`), and a long window (`?days=30`) where volume matters.
Read every PNG, light and dark: `.shots/<route-slug>/{light,dark}-1440.png`.

The demo shows each state on the fixture: `/sources/demo/dataset-page` with `?dataset=`
`demo_price`, `demo_notices`, `demo_units` or `demo_forecast` (not held), `&days=30`
(downsampled), and `&fixture=error`, `refreshing`, `empty` or `toomany`.

## `NEEDS.md`

When the template or the endpoint lacks something your page needs:

1. work around it inside your folder;
2. write `NEEDS.md` in the folder, saying what is missing, why the page needs it, and what
   you did instead.

The seat batches these into a template fix between waves. Don't edit shared code to get
there sooner.
