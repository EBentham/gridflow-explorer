# gridflow Explorer: design system (LOCKED 2026-09-26)

Locked by Bobbo on 2026-09-26 after two rounds of the design loop (`design-rounds.md`
holds the history). The direction is **I, "Petrol night"**, extended with the
**source catalogue landing page**.

- **Tokens:** [`src/design/tokens.css`](src/design/tokens.css), the only source of colour,
  type and size.
- **Reference implementation:** the shared modules in `src/design/` (`charts.tsx`,
  `chartTheme.ts`, `frame.tsx`, `symbols.tsx`), the pinned screens in
  `src/screens/{generation-mix,system-prices,wind-forecast}/`, and the dataset page template
  in `src/views/` (its `README.md` is the builder's contract).

## 1. Identity: the gridflow site's world

The Explorer lives in the same world as the gridflow website (the R3 boards: "The new grid,
drawn", "The transition, in data", "Above ground, below ground").
- **Petrol sky, chartreuse land, paper ground.** Line-art structures stand on a hatched
  ground line.
- **Chartreuse means "where you are"**: the active screen, the current selection, focus,
  highlight bands and the land line. It is never a data colour.
- **Light and dark are both first-class.** Light is paper with a petrol rail; dark is petrol
  night with a near-black rail. The owner uses both, in daylight and in long evening sessions.

## 2. Type

| Role | Face | Use |
|---|---|---|
| Display | Bricolage Grotesque, condensed (`wdth` 84–92, weight 650–800, tracking −0.01 to −0.028em) | Page titles (30–40px), panel and column headings |
| UI and body | Hanken Grotesk, `tabular-nums lining-nums` | Everything else, including chart ticks |
| Identifiers | Red Hat Mono | Dataset, column, table and model ids **only** (`elexon/fuelhh`, `system_sell_price`) |

Sentence case everywhere.

## 3. Colour roles (see the tokens for values)

- **Surfaces:**
  - `--bg` is the page;
  - `--panel` and `--surface` are panels;
  - `--raised` is controls;
  - `--rule` and `--rule-strong` are hairlines.
- **Ink:** `--ink`, `--ink-2` and `--muted`.
- **Rail and scene:**
  - `--rail-*` for the side rail;
  - `--scene-*` for the landing band: sky, two hill depths and the land strip with hatch.
- **Fuels:** 9 display bands, `--fuel-<key>`.
  - Stack order bottom→top: nuclear, hydro, biomass, wind, gas, peaking, other,
    pumped_storage, imports.
  - Validated for colour-blind separation: light CVD ΔE 12.8, dark 13.5.
  - Colour follows the entity, never its index.
  - Solar, which FUELHH doesn't carry, is not one of the nine bands. Where a dataset carries
    it, it takes `--fuel-solar`, a yellow no other fuel uses. Its nearest fuel is biomass, at
    ΔE2000 12.4–13.0, or 9.7 for tritan, in light, and 12.1–12.8, or 9.8 for tritan, in dark.
- **Domains:** `--dom-electricity` (petrol), `--dom-gas` (clay) and `--dom-weather` (ochre)
  for symbols and rules; `--dcol-*` for the solid column header bands.
- **Dataset kinds:** `--kind-series`, `--kind-events` and `--kind-reference` for the
  composition bars and the kind key.
- **Fixture:** `--fixture-ink` and `--fixture-bg`: dashed ochre, never chartreuse.
- **Strata:** `--strata-gold`, `--strata-silver` and `--strata-bronze`, for provenance
  illustrations.

## 4. Shell

- **Rail**, 96px, sticky, full height:
  - **The brand (gridflow / Explorer) is a link to the catalogue** (`/sources`); its active
    state underlines "Explorer" in chartreuse.
  - **Pinned screens** each get a line-art glyph (pylon, meter, turbine), a label, and a
    chartreuse underline plus glyph colour when active. The rail holds **only pinned
    favourites** (Generation mix and System prices today); every other screen is reached
    from the catalogue. It must never grow into a list of datasets.
  - **The foot** holds the light/dark switch (sun/moon, chartreuse on the active mode), then
    "Local data to <day>" and "UK time", then the layered hills.
- **The land:** a fixed 9px chartreuse line with hatching along the bottom of the viewport.
- **Main:** 18px/24px padding with no max-width; panels flow on a 12px gap.
- **Motion:** only the turbine rotor turns (on the wind screen, or while its nav item is
  hovered), and only with `prefers-reduced-motion: no-preference`. Hover lifts are 2–3px on
  ease-out-quart.

## 5. Screen frame (every chart screen)

1. **Head:** the emblem (the screen's glyph large, on a hatched ground), H1, one-sentence
   sub, and a stamp line giving the window and "UK time".
2. **Toolbar panel:** the range control (1 / 7 / 30 days / custom, ending on the latest
   local day), then Chart | Table as a segmented control. The active segment is a
   chartreuse fill with ink text.
3. **Grid:** the main chart panel with a 272px key panel beside it, then a wide working
   panel with a 272px side panel below.
4. **Every panel** has an H2 and a source line naming the dataset (mono id), columns, unit
   and window.

## 6. Charts

- **Chart language:** linear curve, area opacity 0.95, 1px surface-coloured gaps between
  stacked bands, 1.75px lines, day rules at London midnights, a horizontal grid, the fan as
  bands (50/80/90%), and fixture traces dashed `5 4`.
- **Time:** a numeric epoch-ms x axis, ticks at London midnights (multi-day) or local
  3-hour marks (one day), labels on the UK clock.
  - The tooltip names the half-hour window, e.g. `Tue 15 Sep, 14:30–15:00 BST`.
  - Settlement-period numbers appear only where the backend supplies them; gridflow owns SP
    semantics.
- **Units on every axis:** GW (from MW ÷ 1000, display only), £/MWh, MWh and MW. The unit
  sits as the y-axis caption above the ticks.
- **Negative values** (pumping, net exports) stack below zero in their own stack. Money reads
  `−£67`, with a true minus sign.
- **Annotations:**
  - a chartreuse highlight band marks a selected day or negative-price runs (hatched in dark);
  - labelled extremes with a dot, e.g. "£276.80/MWh, highest, Sun 13 at 19:00".
- **Tooltips** are compact, `--tip-*` surface, one row per series with a swatch.
- **Fuel identity is never colour-only:** a key panel with the latest values, selectable to
  focus one fuel.
- **Reference implementation:** `GenerationChart`, `PriceChart` (price with an NIV bar panel
  on a shared clock), `FanChart` and `MixBar` in `src/screens/`, built on `design/time.ts`,
  `design/fuels.ts`, `design/charts.tsx` and `design/chartTheme.ts`.
- **The port phase builds one shared Recharts theme module** covering axes, tick/unit
  styles, tooltip box, legend/key, day rules, highlight band, extremes and fan key. Every
  dataset view composes from it; no view styles Recharts ad hoc.

## 7. Catalogue (landing page, `/sources`)

1. **Scene band:** petrol sky, H1 "gridflow data" at 40px, an intro sentence, and two hill
   depths.
   - Every source stands on the chartreuse land as its **source symbol** (54px, paper
     strokes) with its short name.
   - Each symbol is a link; on hover it turns chartreuse and lifts 3px.
2. **Domain columns:** Electricity | Gas | Weather.
   - Each column has a solid header band (`--dcol-*`) with the domain name, a one-line
     description, "N sources, M datasets" and the domain symbol.
   - Inside each column, one block per source: symbol (44px, domain colour), name (display
     19px), blurb, and a composition line.
   - The composition line is the dataset count, a proportional bar split by kind, and
     swatch-labelled counts.
   - The whole block is a link.
3. **Foot:** the low-key kind key (one line, 12.5px, muted) and a single plain-language
   note on where the source list comes from.

**Dataset kinds** are decided by the silver table's key shape (verified 2026-09-26), not by
the dataset's name:
- **Time series:** rows on a regular clock (settlement period, hour, gas day), possibly per
  unit, zone or point.
- **Event feeds:** rows keyed on a per-action or per-message id (accepted bids, REMIT
  messages, trades, notices).
- **Reference tables:** no clock (registers, lookups, topology, tariffs).

**Source symbols** (`src/design/symbols.tsx`) are line-art drawings of what each source measures,
not the publishers' logos:
- Elexon: a settlement clock;
- NESO Carbon Intensity: a stack with a plume;
- NESO Data Portal: filed documents;
- ENTSO-E: a meshed network;
- ENTSO-G: a pipeline valve;
- GIE AGSI+: a storage tank;
- GIE ALSI: an LNG carrier;
- Open-Meteo: sun and cloud.

A new source gets a new symbol in the same grammar: a 32-unit box, ground at y=30,
round caps, non-scaling 1.4px strokes.

## 8. Source page (`/sources/:key`)

- A breadcrumb (All sources / Domain), then the head with the source symbol as its emblem,
  the blurb, and a stamp giving the dataset count, key and host.
- **Main panel, "Time series":** a table of dataset groups showing the group label, the
  member ids (mono), the fetch schedule, and the Explorer link where one exists. Charted
  rows get the `--selected` wash.
- **Side panels:** "In the Explorer", "Event feeds" and "Reference tables", as compact lists
  with their fetch schedule.
- **Reference tables get a plain table view, no chart** (Bobbo, 2026-09-26).

## 9. Fixture and honesty rules

- Anything synthetic carries a visible dashed-ochre "Fixture" tag wherever it appears. The
  wind forecast and the template demo (`/sources/demo/dataset-page`, deleted by P4-0) are
  the only fixtures.
- A dataset being configured in gridflow does not mean it is held locally. Only datasets
  the Explorer actually reads show coverage, dates or values.
- Every chart names its dataset, unit and window. No invented statistics, no fake live
  data, no KPI hype.

## 10. Do not use

- **Generic-AI tells:**
  - tracked all-caps eyebrows;
  - middle-dot meta strings (`8 sources · 163 datasets`);
  - `→` on links;
  - numbered 01/02 cards;
  - gradient text;
  - glassmorphism;
  - identical card grids;
  - emoji as icons;
  - thick coloured side-tab borders on cards (the detector flags `border-left` ≥ 3px).
- Chartreuse as a data colour, or for fixtures.
- Near-black plus neon (the old explorer's look), glow, or drop-shadowed cards.
- Mono type as "technical" costume. It is for identifiers only.
- Vendor logos. Draw a source symbol instead.
- A side "key" or "reading the list" column on the landing page, or a per-source status
  column ("charted / not read yet"). Both were rejected on 2026-09-26.
- A "screens in the Explorer" tile strip on the landing page. It doesn't scale and was
  rejected; pinned screens live in the rail.
- Pinning every dataset in the rail.
- Internal jargon in the UI: "fixture copy", "silver", "configured", "manifest". Say it in
  plain words.
- Round-1 looks (synoptic, control room, chart recorder, settlement ledger, emission lines)
  and round-2 F/G/H/J shells. The mechanics that were kept are recorded in
  `design-rounds.md`.
- Animation beyond the rotor and small hover lifts. No bounce or elastic easing, and no
  animating layout properties.
