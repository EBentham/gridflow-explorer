# NEEDS: neso_data_portal / historic-generation-mix

For the seat to batch into a backend or template-fix unit. Each item says what is missing,
why this page needs it, and what the page does meanwhile.

## Rows endpoint (backend)

1. **Long windows ship far more than the page draws, and slowly.** The endpoint has no bucket
   choice and no column projection. The full history (1 Jan 2009 – 26 Sep 2026) comes back in
   one request as 38,868 4-hour means of all 33 value columns: about 27 MB, about 6.5 s on an
   idle backend. The page needs 12 of those columns as 213 monthly means. Five years come back
   as 43,824 hourly means, about 28 MB.
   - Live on 27 Sep, one request per window:
     - On :8003, the fixed instance: one year was ready in 13 s, two years in 14 s and five
       years in 51 s. The full history was not ready within 120 s. The week missed 120 s
       twice, while the health check answered in milliseconds.
     - On :8002, earlier: the week took 46 s on its own, one day about 55 s, and the full
       history was not back within 212 s.
   - `scripts/shoot.mjs` waits 20 s unless `SHOOT_TIMEOUT_MS` says otherwise, so these shots
     can time out on the loading state. While a long window is read, the page's toolbar says
     so: past a year it can take a minute or more, past five years several minutes.
   - The endpoint accepted every span this page asks for. It never refused: past 400 days it
     downsampled and set `truncated`, which the page states above the chart and in its hints.
   - Meanwhile the page makes one request per window and averages the rows into days, months
     and years in the browser.
   - Wanted: a `columns=` projection, and a `bucket=` choice (day, month) or a byte budget.

## Shared code outside this unit's boundary

2. **No solar colour.** The locked palette has no Explorer `--fuel-solar`: the site's solar is
   chartreuse, which DESIGN reserves for the brand and never uses as a data colour.
   - The page borrows `--chart-tick` for solar. Measured against the nine fuel colours in both
     themes, its minimum ΔE is 17.8 (18.9 under simulated colour-blindness), and its contrast
     on the chart surface is 5.2 in light and 8.3 in dark.
   - Embedded wind has no colour of its own. It sits directly above transmission-connected
     wind, and a 1 px surface gap alone didn't part them (review, pass 1). Meanwhile it is
     `--fuel-wind` hatched with `--chart-surface`: an SVG pattern in the charts
     (`WindHatch.tsx`) and a matching CSS stripe in the key and the mix bar.
   - Wanted: a CVD-checked `--fuel-solar` for both themes, and a ruling on embedded wind: its
     own tint, or the hatch as a design pattern for a fuel's sub-band.
3. **The chart clock stops at months, and dates name no year.**
   - `ukTimeTicks` ticks every 14 days past 120 days, labelled like `15 Sep`, with no year.
   - `periodLabel` and `dayLabel` also name no year, so the template's chart and table can't
     tell September 2025 from September 2026.
   - Meanwhile, past 31 days the page draws its own `LongChart`, composed from `chartTheme`
     and `charts.tsx` as `SeriesChart` is, with month and year ticks, plus its own table of
     days or months with the year in every row.
   - Wanted: a year-aware clock in `design/time.ts`, so long windows can use the template's
     chart and table.
4. **No long range presets.** The template's range offers 1, 7 and 30 days and custom. A
   17-year dataset needs a year, five years and its full depth. The page adds a "Long view"
   control and a year picker in `controls`, both of which set the template's own custom range
   through `ctx.range.setCustom`. Wanted: optional per-view presets in `defineView`.
5. **Day coverage stops at 1,000 days.** `datesBetween` caps at 1,000 dates, so
   `daySummaries` and the panel helpers count coverage only for a window's first 1,000 days.
   - On the five-year and full-history windows, the template's coverage note is silent about
     the last day, which holds 37 of 48 half-hours. The two-year window names it.
   - The page's own tables show held counts for every day, month and year, so the partial
     day still shows (for example "1,613 of 1,614" for 2026).
   - Wanted: count coverage from the response without walking each day, or lift the cap.
6. **The default series cap (10) is below this dataset's 11 fuels.** The page sets
   `maxSeries: 12`. It's noted here in case another NESO or ENTSO-E mix meets the same limit.
7. **The template chart's lowest label can land on the time ticks.** `SeriesChart` always
   sets a lowest label under its dot, and its scale leaves no room under a lowest value near
   the axis floor.
   - On 30 days, "30 gCO₂/kWh, lowest, Sat 12 at 14:00" runs over the "Tue 15" and "Fri 18"
     ticks. The week's label sits just clear of them.
   - Meanwhile the page sets `extremes: false` on the lower panel, so the template labels no
     carbon intensity extremes. The main panel gives the window's highest and lowest half-hours
     in words under the chart instead.
   - The page's own long chart avoids this: `withRoom` in `LongChart.tsx` adds a step under
     a low near the bottom, or half a step with no tick where zero is the floor.
   - Wanted: the same room in `SeriesChart`'s scale, or a `lower` option that asks for it.
     Then the page can label them on the chart again.
