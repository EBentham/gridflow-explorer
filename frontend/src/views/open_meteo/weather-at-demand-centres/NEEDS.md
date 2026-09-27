# Weather at demand centres: what the template lacks

1. **A shared weather helper for the three Open-Meteo pages.** This page, "Weather at wind
   sites" and "Weather at solar sites" were built in parallel with the same shape: a split
   by `location`, a pinned name and colour per site, a cap high enough that the drawn
   column isn't crowded out, and the same hindcast caveat. Each keeps its own copy in its
   folder (`figures.ts` here: `CITIES`, `citySeries`, `spreadOf`, `cityStepsText`). A
   shared `views/open_meteo/_weather.ts` (or a template helper for "one column, one series
   per site") would hold the site names, their colours and the hindcast wording once.
2. **The draw cap ranks every column, not the drawn one.** `buildSeriesModel` picks the
   `maxSeries` series with the largest mean across every value column. With 11 columns by 7
   cities, the default 10 keeps surface pressure (about 1,000 hPa) and radiation and leaves
   temperature undrawn, though `chart.values` names temperature only. The page sets
   `chart.maxSeries` to 77 (every series) so the main panel's seven lines are always kept.
   The cap should rank only the columns the chart panels draw.
3. **No overlay of a related series in the main panel** (as demand outturn's NEEDS says).
   The P1 card asks for the reanalysis drawn over the hindcast. The page draws the
   reanalysis in the working panel on the same clock instead, with a per-city table of the
   two means and their difference.
4. **The manifest's unit for six columns is one sentence.** `relative_humidity_2m_pct`,
   `precipitation_mm`, `surface_pressure_hpa`, `snowfall_cm`, `snow_depth_m` and
   `air_density_kg_m3` all carry `% / mm / hPa / cm/h / m / kg/m3`: the P1 card's list,
   flattened onto each column. The page settles five of them from the card in its config.
   Snowfall's card unit is `cm/h`, which `units.ts` doesn't know, and the column name says
   `cm`, so the page leaves it "unit unconfirmed". The manifest should carry one unit per
   column, and the snowfall unit wants settling.
5. **Instant readings are named as hour-long periods.** Tooltips and the table name each
   hourly row as `14:00–15:00 BST`. Whether Open-Meteo's temperature is the reading at the
   hour or a mean over it is not recorded in gridflow's notes, so the page doesn't say
   either. A research note on which columns are instants and which are hour means (radiation
   is likely the latter) would let the template name them properly.
6. **No scatter chart in the theme.** The strongest view of this family for a demand model
   is temperature against national demand, one dot per hour. The theme has no scatter
   factory, so the page gives the relationship as a day table (mean temperature, degrees,
   demand mean and peak) rather than style a Recharts scatter by hand. A `ScatterPanel` in
   `design/charts.tsx` would open this up for every weather and demand page.
7. **The reanalysis reads slowly.** A 7-day read of `historical_demand` (1,176 rows) took
   about 212 s on the shared capped backend while other pages were reading, likely because
   the table holds five years. The page asks for nothing extra, but the shots may time out
   under load.
