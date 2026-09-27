# Dataset pages: the builder's contract

Every catalogue family the Explorer draws gets one page at `/sources/<source>/<family>`. A
page is a **view config** plus, when it needs them, a few panel components. The template
draws everything else in the DESIGN §5 frame: the head, the toolbar, the four panels, the
source lines, the honesty states and the Fixture tags.

- `define.ts` is the typed shape of the config. This file says how to use it.
- `contract.ts` is the data: the manifest (`GET /api/sources`) and the rows responses.
- `frontend/DESIGN.md` is the look. It is locked; a page adds no new looks.
- The pilot page, `elexon/market-index-price/`, is the worked example to copy from: a series
  in the full frame, with a key and a working panel of its own. The demo family
  (`demo/dataset-page/`) shows every state of the template on synthetic data.
- Every page reads the local store through the HTTP adapter (`_data/http.ts`). Only the demo
  reads the fixture.

## Folder layout

```
src/views/
  README.md              this contract
  define.ts              the view config types, defineView, TEMPLATE_PARAMS
  contract.ts            the manifest and rows shapes, and the DataSource interface
  registry.ts            finds every page with import.meta.glob('./*/*/index.tsx')
  FamilyRoute.tsx        the route element: the page, or what the source list says of the address
  NEEDS.md               P4-0's gaps, for the seat to batch
  _template/             the frame, the three bodies, the default panels (template-owned)
  _data/                 the HTTP adapter, the demo's fixture adapter, loading hooks (template-owned)
  demo/dataset-page/     the fixture demo family: every state, on synthetic data
  elexon/market-index-price/  the pilot page: copy from it
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
   sketch for `elexon/market-index-price` (the pilot page is the real one: it draws the
   volume in a working panel of its own instead of under the price):

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
| `query` | `{ group, filters }` for the rows request, or a function of the page's URL parameters returning one. `group` must be a `dims` column. `filters: null` clears the dataset's default filter. **A dataset whose rows vary by more dims than its split answers `ambiguous_series` (422), and the page shows nothing rather than mix series. Its config must supply the `group` and the `filters` that leave one series per group.** The error names the column that varies; `entsog/released-capacity` groups by point and filters by direction. |
| `related` | Other datasets read for the same window, e.g. a price beside a volume (see below). |
| `panels` | Replacements for the `main`, `key`, `working` or `side` panel (see "Panels"). |
| `controls` | The page's own toolbar controls, after Chart and Table (see "Controls"). |

### Series (`body: 'series'`)

| Field | What it is |
|---|---|
| `values` | The columns to draw, in order: `{ column, label, unit, display, color }`. Default: every numeric value column. `unit` is only for a null or sentence unit that the P1 card settles; never a guess. `display: 'MW'` keeps MW where GW would hide the detail, e.g. one unit's output. `color` is a token, used when the series are the columns themselves. |
| `groups` | Labels and colours for the values of the `group` column: `{ value, label, color }`. Their order is the stack order, bottom first. Fuels use `var(--fuel-*)`; other entities use the `SERIES_COLORS` tokens. A colour follows its entity, never its index. A split that a filter pins to one value isn't split at all (see "One-value splits" below), so `groups` doesn't apply to it. |
| `chart.mark` | `'line'` (default), `'stacked'` (negatives stack below zero in their own stack) or `'bars'`. |
| `chart.values` | The columns in the main chart panel. Default: every drawn column that isn't in the lower panel. |
| `chart.lower` | A second panel on the same clock: `{ from, values, mark, height, extremes }`. Without `from` it takes this dataset's other columns (volume under a price). With `from: '<related key>'` it draws that related dataset. A column whose unit fits neither panel goes to the table only, and the page says so. |
| `chart.zero`, `chart.height` | Put zero on the value axis; the panel height. A panel under 200px gets about 3 value ticks rather than 5, and shows every one, so zero is never thinned away. |
| `chart.extremes` | Label the highest and lowest value. Default: on for a single line. |
| `chart.maxSeries` | At most this many series are drawn (default 10). The rest are named in the key as not drawn, and listed in the table. They are never merged into "other". |
| `chart.belowZero` | Band the main panel's runs below zero with the highlight band, e.g. negative prices. The key names the band. |
| `chart.axisWidth` | A fixed value-axis width in px, so that a chart the page draws in a panel of its own lines its clock up under this one (the pilot's volume). |
| `chart.lower: false` | No second panel. The columns left out of the main panel are the page's to draw in a panel of its own. |
| `chart: false` | A series shown as a table: no chart and no Chart view. The key, "Latest values", lists each series' latest value; select one to read it in the days table. Rows holding text only get a table of the rows and a count of rows per day. Rows a day or more apart get "Lowest and highest" in the working panel (each column's values held, lowest and highest, and when) rather than the table again, and their key has nothing to select. |

### Events (`body: 'events'`)

| Field | What it is |
|---|---|
| `timeLabel` | The event time's column header, e.g. `Published`. Default `Time`. |
| `columns` | `{ field, label, format, unit, display, text }` after the time. `format` is `'text'`, `'id'` (mono, for identifiers only), `'number'`, `'time'`, `'date'` or `'bool'`. Tables keep MW unless `display: 'GW'`. `text` reads a coded value in words, with the helpers in `_template/codes.ts` (ENTSO-E production types, the name inside JSON text, snake_case ids). The cell, sort, filter list, counts and search use the words; the filter still matches the value as held. A number held as text sorts as a number. Default: every field, with formats read from the values. |
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

The backend applies a related dataset's default filter as it does the page's own: `mid`
comes back as `data_provider_id` APXMIDP only. The template says so. The main panel's notes
give each related dataset that came back cut down, or held for less of the window, a line
of its own ("Price from `mid`: shows data_provider_id APXMIDP only, this dataset's default.
It leaves out 336 rows."). Its source-line part names the filter, and About lists it under
"Read beside it".

A related dataset that fails to load is reported where the lower panel would draw it. A
page that reads one for a panel of its own checks `ctx.related[key].state` and says what
went wrong in that panel.

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
  rows run ("Its local rows run from 8 Sep to 22 Sep 2026, with none in 16 Sep – 22 Sep
  2026.").
- **Truncation in plain words.** Each reason the backend gives gets a sentence:
  - a default filter ("Shows area GB only, this dataset's default. It leaves out 10 rows.");
  - a top-N cut;
  - exact duplicates left out;
  - a downsample ("Shown as hourly means, as the window holds more rows than one read
    returns (3,000).");
  - a window too long to read at full detail;
  - text blanked in the means.

  The `truncated` flag is never silent, on the page's dataset or on a related one. The main
  panel's source line names the filters the rows carry.
- **One-value splits.** A series split by a column that a filter pins to one value comes
  back as one group. Live `mid` is the case: its default filter keeps `data_provider_id`
  APXMIDP. The template draws it as the columns themselves, named and coloured by `values`,
  so the key reads "Market index price", not "APXMIDP". The source line names the filter.
- **Datasets that aren't held.** The toolbar line names them with the reason in words, and
  a not-held dataset opens to a plain state, never an empty chart.
- **Gaps stay gaps.** Null values break lines and stacks, and tables show a dash. Nothing is
  zero-filled or interpolated across a missing step. A series on a coarser clock is drawn
  between its own points only.
- **Units and time.** MW columns show as GW (display only); money reads `−£67.40` with a
  true minus sign; an unknown unit says "unit unconfirmed". Axes and tooltips use the UK
  clock, and tooltips name the period (`Tue 15 Sep, 14:30–15:00 BST`). Settlement date and
  period appear only when the rows carry them. A reference table has no window to date its
  times, so it names each one's year (`Wed 1 Oct 2025, 05:00 BST`).
- **Blanks are counted, not hidden.** Counts by a column (the events key, a reference
  table's working panel) give null and empty values one line, `Blank`.
- **Errors in plain words.** A 413 says why the window is too much to read, a 422 what
  varies (`ambiguous_series`) or what the request got wrong, a 404 why the dataset isn't
  held, and a 503 gives the refreshing state (`text.ts` `errorParts`, drawn by `ErrorWords`).
  The backend's own messages and hints are never printed.
- **Settlement periods.** Where the rows carry `settlement_period`, tooltips and the key
  name the period with its number (`Tue 22 Sep, 18:00–18:30 BST, SP 37`, from `periodName`).
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
| `key` | Right of main, 272px | Key: each series with its latest value; select one to draw it alone (with `chart: false`, "Latest values") | In this window: counts, newest, oldest | Table: rows, columns, last fetched |
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
- The default side body, About, reads the source list alone, so it renders in every state:
  loading, error and refreshing included. A replacement side body follows the rule above.
- On an error the main panel says what went wrong in plain words (see "Errors in plain
  words" above). A panel of the page's own that reads a related dataset says its error with
  `ErrorWords`.
- `src` runs in every state. Until the rows are read, `ctx.response` and `ctx.series` are
  null.

**The source line rule.** Every panel names what it shows: the publisher and dataset id
(mono), the columns (mono), the split, the unit and the window. Use `SourceLine`:

```tsx
<SourceLine ctx={ctx} columns={['market_index_price']} filters={ctx.response?.filters} unit="£/MWh" what="mean per UK day" />
<SourceLine ctx={ctx} columns={cols} by={ctx.series?.group} unit={unitsOf(drawn)} also={relatedParts(ctx, drawn)} />
```

Pass `filters` wherever the panel shows filtered rows: a default filter is named there
("`data_provider_id` APXMIDP only"). A panel that shows a related dataset names it too, with
`also` (`relatedParts` builds it from the series drawn, filters included). `window={false}`
drops the window where it doesn't apply.

**Pieces to reuse** (import them from `_template/`; don't copy them):

- `panels.tsx`: `SourceLine`, `PageNotes`, `SeriesKey`, `SeriesDays`, `EventsSummary`,
  `EventsDays`, `ReferenceSummary`, `ReferenceCounts`, `About`, `ErrorWords`.
- `codes.ts`: `productionType`, `jsonName` and `idWords`, for `ColumnSpec.text`.
- `cells.tsx`: `wordsOf`, a column's value in its words.
- `WindowedTable.tsx`: the sortable, windowed table with sticky headers. A line under it
  says when its box cuts rows or columns off.
- `CountStrip.tsx`: events per hour or day as bars.
- `SeriesChart.tsx` and `seriesPanels.ts` (`planPanels`): the series chart.
- `panelHelpers.ts`: `unitsOf`, `heldDays`, `daySeries`, `keyStamp`, `relatedParts`,
  `plannedParts`, `relatedFilters`, `plannedFilters`.
- `seriesModel.ts`: the model on `ctx.series` (`all`, `drawn`, `undrawn`, `rows`,
  `stepMs`, `bucketed`, `settlement`), and `daySummaries`, `latestValue`, `extremesOf`,
  `periodName`, `runsBelowZero`.
- In a stats list (`dl.gf-stats`), `<span className="gf-stat-when">` sets a figure's time on
  a line under it, as the pilot's key does for the highest and lowest price.
- `units.ts` (`displayUnit`) and `text.ts` (`coverageSentences`, `truncationSentences`,
  `emptyWindowText`, `notHeldText`, `meansText`, `cadenceOf`, `errorParts`, `errorText`).
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

The demo shows each state on the fixture: `/sources/demo/dataset-page` (its related price
cut to one market by a default filter), with `?dataset=` `demo_price`, `demo_notices`,
`demo_units` or `demo_forecast` (not held), `&days=30` (downsampled), and
`&fixture=error`, `refreshing`, `empty` or `toomany`.

## `NEEDS.md`

When the template or the endpoint lacks something your page needs:

1. work around it inside your folder;
2. write `NEEDS.md` in the folder, saying what is missing, why the page needs it, and what
   you did instead.

The seat batches these into a template fix between waves. Don't edit shared code to get
there sooner.
