# Weather at wind sites: what the template lacks

- **A shared weather-site helper.** The three Open-Meteo pages (demand centres, wind sites,
  solar sites) each need the same things: readable names for the `location` ids, the
  regions gridflow's connector groups them into, a colour per region, and the plain mean of
  the sites at the hours every site holds. This page keeps its own copy in `figures.ts`
  (`SITES`, `REGIONS`, `speedPoints`), so the three will drift. What would help: a
  template module (say `_template/weatherSites.ts`) holding the site lists and a
  `siteMean(model, column)`. Better still, the backend could send each location's display
  name and region, so the names aren't copied from gridflow's connector.
- **More series colours.** `SERIES_COLORS` holds 9 tokens and this family has 12 sites.
  The page colours each site by its region (5 colours), and the key names every site
  under its region, so identity is never colour alone. With 12 distinct tokens a page
  could give each site its own colour.
- **A column switch for series.** `values` is fixed per dataset, so the page can't offer
  "100 m | 10 m | gusts" as a control. The rows hold 10 m speed, gusts, direction and more
  (80/120/180 m on the forecast model), and the page draws only the 100 m speed. A
  `values` that can be a function of the page's URL parameters (as `query` can) would let
  one page show each height.
- **A scatter panel.** The working panel sets each hour's speed against GB wind output as
  a scatter (`SpeedScatter.tsx`), composed from the theme's grid, ticks, value axis and
  tooltip. There is no shared scatter in `design/charts.tsx`, so the x axis props are
  written here. A shared `valueXAxis` (the numeric counterpart of `valueAxis`, with the
  unit caption) would keep every scatter alike.
- **A key built from the page's own list.** The default `SeriesKey` lists the series in
  one flat list. This page wants them under region headings, so it rebuilds the list
  (`SitesKey.tsx`) with the template's `gf-series-key` classes. A `groups[].section` field
  that `SeriesKey` headed would make that unnecessary.
- **Instant readings named and binned as hour-long periods.** The template names each
  hourly reading as a period (`Sun 27 Sep, 00:00–01:00 BST`), and this page pairs it with
  GB wind output's half-hours in the hour from its time stamp (`outputPerStep` in
  `figures.ts`). Open-Meteo is understood to give wind speed as an instant value at the
  hour, with only sums and means (rain, radiation) covering the hour before; that is not
  confirmed in the repo. Confirm Open-Meteo's instant or preceding-hour convention for
  `wind_speed_100m`. If it is instant, the template should name the reading as an instant,
  and this page should centre the output pairing on it (the half-hours either side).
