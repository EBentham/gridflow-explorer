# Weather at solar sites: what the template and the data lack

- **Interval-end stamps (verified; a data-honesty template fix).** Each Open-Meteo radiation
  value is the mean of the hour *before* its stamp: the value stamped 13:00 covers 12:00–13:00.
  The review confirmed it from gridflow_models' v2.3 research (`L1-data-holdings.md`: P3 at
  line 36, the correlation measurement at line 254, the vendor citation at lines 86 and 295),
  and gridflow keeps the vendor time as `timestamp_utc` with no shift. `SeriesChart`'s tooltip,
  the series table's Period, bucket labels and the latest-day rule all read the stamp as the
  hour's *start* (`periodLabel`), so every irradiance hour reads one hour late, and the one
  00:00 stamp of Sun 27 Sep (Sat 23:00–24:00) makes Sunday the default window's last day.
  The template needs a per-dataset or per-column `stamp: 'end'`. What the page does instead:
  the first caveat says how to read the stamp, and the key names each peak as "hour to <time>".
- **Units of the secondary columns.** The card and the source list give `mixed` as the unit of
  `cloud_cover_*_pct`, `temperature_2m_c`, `snowfall_cm` and `snow_depth_m`. gridflow's
  `SolarWeather` schema names them %, °C, cm and m, but the card doesn't settle them, so the
  page leaves those columns out and says so. The card (and the manifest) should list them one by one.
- **`values` can't follow a control.** A "Measure" switch (tilted, flat ground, diffuse, cloud
  cover) would let one chart read each column across the six sites, but `values` and
  `chart.values` are static. Listing the other W/m² columns in `values` doesn't help either:
  with the lower panel taken by a related dataset, `planPanels` sends them to the table and the
  main panel says they are there "as their unit fits neither panel", which is untrue for W/m²
  columns beside a W/m² chart (30 site-column names in one sentence). What the page does
  instead: `values` holds the tilted panel only, and a caveat says the other columns are held.
- **No overlay of a related series on the main axis** (as `elexon/demand-outturn/NEEDS.md`
  says). The model re-run and the archive are both W/m² at the same sites, but the archive
  can only go in the lower panel. The working panel sets them side by side in numbers.
- **Shared weather helper.** The demand-centre and wind-site pages are built in parallel with
  the same shape. Each keeps its own site labels, colour-per-site list, hourly day totals and
  the fetched-after-the-fact wording for the forecast re-run. A shared `open_meteo` helper
  (site names for all three location lists, a day-total rule, the re-run caveat) would keep
  the three pages saying the same thing.
- **The backend is slow on this dataset.** One default-window read of `historical_solar` took
  about 320 s on the shared backend (27 Sep), the first read; later reads took under a
  minute. Worth watching rather than chasing.
