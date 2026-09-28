# NEEDS: gold / power-stack-clearing

What the template and the rows endpoint lack for this page, and how the page
works around each gap inside its folder.

1. **A per-dataset default window.** The seat wants the clearing and residual
   views to open on the published run, 18 Aug – 3 Sep 2026 (RULINGS #13). The
   supply curve's lightest read is one day. The template always opens on the
   7 days ending on the latest local day, and the reviewer checklist holds
   pages to that. Workaround: the toolbar names the published window, or
   links to it (`publishedSearch`). The clearing view's links into the curve
   open one day (`curveSearch`). Asked for: an optional `defaultWindow` on a
   dataset view, either a day count or the coverage's `first_day`..`last_day`.

2. **Heavy supply-curve rows.** `gold_stack_supply_curve_points` sends every
   column for every unit and half-hour. That includes `cost_provenance`, a JSON
   note of about 400 bytes per row.
   - One day is 5,232 rows (about 4.5 MB) and takes 6–13 s.
   - Seven days, the template's default window, is 36,624 rows (about 31 MB)
     and takes about 20 s, which is the shoot harness's timeout.
   - Asked for: a column projection on the rows endpoint (a `columns=`
     parameter), or an equality filter on the clock (`event_time`). The page
     only ever draws one half-hour.

3. **No run switch.** The mandatory row filter keeps only the published run,
   `smp_headline_perfect_prog_v2`. The earlier `_v1` rows and the 13 monthly
   diagnostic runs (May 2025 – May 2026) can't be read, so the page can't
   offer them. They would be worth a switch once the backend allows it,
   especially the diagnostic runs for clearing and residual demand; they wrote
   no supply-curve points. The caveat names them.

4. **Chart pieces composed locally.** `design/chartTheme` and `SeriesChart`
   have no numeric (non-time) x axis and no block or step piece, so the supply
   curve is drawn with Recharts `ReferenceArea` blocks in `CurveMain`.
   `SeriesChart` also can't:
   - set its own tooltip note for each half-hour (what set the price);
   - clip an off-scale value, here the −£500/MWh floor, under a readable axis;
   - colour one bar series per row, here by the fuel that set the price.

   So the clearing chart is composed in `ClearingMain`. Shared versions would
   let other model pages reuse them.

5. **Solar colour: resolved on this branch, by the seat's ruling.** This
   branch adds `--fuel-solar` to `src/design/tokens.css`: `#f5c518` in light
   and `#fde047` in both dark blocks, a yellow no other fuel uses. It also
   adds one line to the Fuels section of `DESIGN.md`. The page's one legend,
   `FUELS` in `figures.ts`, takes solar from it on every view. Other pages
   that draw solar can use the token once this merges.

6. **Coal and OCGT share one colour.** Both fall into the design's peaking
   band, `--fuel-peaking`. On the supply curve the coal blocks sit among the gas
   blocks and OCGT at the top. The key names each fuel, and the tooltip and the
   merit-order table name each unit's fuel. A distinct coal shade, or a pattern
   for coal, would make the chart readable without a hover.

7. **Domain questions for gridflow_models** (the page shows these as held and
   draws no conclusion from them):
   - The stack costs six units as coal: `T_WBUPS-1`..`4` and `T_DRAXX-5`, `6`.
     GB's last coal plant closed in 2024. The key says so, in the words the
     ENTSO-E pages already use. The source is DESNZ Energy Trends, as archived
     in gridflow_models `.planning/phases/v2.1-F-1-fuel-sources/SOURCES.md`
     and `SEAT-EVIDENCE-1.md`: Ratcliffe-on-Soar closed on 30 Sep 2024, and
     GB had no coal-fired generation in Q1 2026. That evidence already names
     these six units as an open question for the model.
   - Units `T_HUNB-7` and `T_HUNB-8` are in the nuclear list. Hunterston B
     stopped generating in 2022; no source for that is archived in the repos.

8. **Links write the template's own parameters.** Two links write `from`,
   `to` and `dataset`, as a reader using the toolbar would: "Show the whole
   published window", and the clearing view's "Its supply curve" and "Open"
   links. The page never changes them on its own. Asked for: a sanctioned
   helper for a page to link to a window of one of its own datasets.

9. **A slow related read holds every panel.** The template keeps the whole
   page on "Reading the local store…" until every related read has answered:
   in `DatasetPage.tsx`, a related read still loading makes the page's state
   loading. The market index overlay, `gold_gb_day_ahead_benchmark`, is by
   far this page's slowest read.
   - Review pass 1, on `:8003`: about 43 s for any window (43.0 s for
     5 Aug – 3 Sep, 43.7 s for 14 – 20 Sep). The clearing rows took
     0.2–0.6 s.
   - This branch, on `:8003`: 4.2 s for 28 Aug – 3 Sep on a quiet backend.
     While other pages were being shot, 137 s for 5 Aug – 3 Sep, and no
     answer within 150 s for 14 – 20 Sep.

   So the clearing chart, its key and the days table, and the supply
   curve's panels, all wait on a line they could be drawn without. The page
   already says when an overlay's read fails (`UnreadNote`). Asked for:
   related reads that don't hold the page's own rows (draw them, then add
   the overlay with its own loading note), or a faster benchmark read in
   the backend. Any page reading the benchmark as an overlay waits the same
   way.
