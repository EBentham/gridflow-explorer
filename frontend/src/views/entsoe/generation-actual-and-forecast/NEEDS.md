# NEEDS: entsoe / generation, actual and forecast

What the template or the endpoint lacks for this page, why the page needs it, and what it
does meanwhile.

1. **A mixed clock is drawn straight across its gaps** (as the day-ahead prices page's item
   1). All three datasets come with `grain_ms` null: Belgium's forecasts are hourly and the
   rest quarter-hourly, and the Dutch and Belgian units report hourly beside one
   quarter-hourly unit. The backend marks no missing step, so the template's chart runs a
   line straight across a day that isn't held, and its coverage line can't count a day held
   in part.
   - Meanwhile: every main and working chart reads each series' own step from its rows
     (`trackOf` in `figures.ts`), puts a null at each step of that clock it doesn't hold
     (`markGaps`), and hands its own panels to `SeriesChart`. The main panels add their own
     sentence of days held in part, series by series.
   - Wanted: missing steps marked per group on each group's own step in the rows endpoint,
     or a step per group in the series model.

2. **A related dataset can't follow the page's own parameters.** `RelatedSpec.query` is a
   fixed `QuerySpec`, so the wind and solar forecast, read one zone at a time (`?zone=`),
   can't ask for that zone's total generation forecast alone.
   - Meanwhile: the related read takes every zone's total (a small dataset, one request) and
     the panels pick the zone's series.
   - Wanted: `RelatedSpec.query` as a function of the URL parameters, as `DatasetView.query`
     is.

3. **Unit rows lose their production type when they are read as means.** A long or wide
   window of `actual_generation_units` is downsampled, and the means carry only
   `unit_mrid` and `generation_mw`, so a page can't tell a unit's type from them. With one
   split column, units can't be read by zone and type at once either.
   - Meanwhile: the page reads one zone and one type at a time (`?zone=`, `?type=`), so the
     type is the filter's. The type list is the eleven the unit rows carry across the three
     zones; a zone holding no unit of a type shows the empty state.
   - Wanted: dims kept in bucketed rows when they are constant per group, or a two-column
     group (as P4-0's item 2), or a distinct-values call for a dim within a filter.

4. **Unit names.** The unit rows' `unit_name` is blank on every row, and the unit register
   carries no names either (P4-0's item 1), so units are shown by code. A name map would let
   the key and the table name them.

5. **Custom key swatches for patterned bands.** A group whose colour is an SVG pattern
   (`url(#…)`, the hatched offshore wind band) draws in the chart, but the template key's
   CSS swatch can't show it. The page draws its own key with a CSS stripe for that swatch,
   as the historic generation mix page does. A `swatch` field on `GroupSpec` would let the
   template's key do it.

6. **`actual_generation` is left off the page.** The held copy can carry a type's
   consumption in place of its generation (pumped storage, for one), and the rows don't
   say which. The page says so in a caveat and draws nothing from it. Once gridflow keeps
   generation and consumption apart, it would be a stacked mix per zone here, with the
   forecasts set against it.

7. **Near-identical series colours.** Nine units drawn at once use all nine `SERIES_COLORS`,
   and three of them read as nearly the same ochre in both themes (`--chart-price-2`,
   `--fuel-biomass`, `--fuel-other`). The page gives each unit a colour from a hash of its
   code, so it keeps its colour when the window changes, and the key and the table name
   every line. A series palette with more separation between its warm colours would help
   every page that draws many entities.
