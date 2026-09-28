# NEEDS: entsoe / day-ahead prices

What the template or the endpoint lacks for this page, why the page needs it, and what it
does meanwhile.

1. **A mixed clock is drawn straight across its gaps.** The continental zones are priced per
   quarter-hour and Ireland (SEM) per hour, so the rows response has `grain_ms` null, and the
   backend marks no missing step with a null ("stored timestamps are not gap-filled").
   `SeriesChart` then treats a zone that lacks a row at some time as sparse and draws it
   straight between its own held points. In the local rows the Netherlands misses about a day
   on 12 to 13 Sep and Ireland (SEM) about a day on 2 to 3 Sep: the template's chart would draw
   both as straight lines across a day that isn't held.
   - Meanwhile: the page's main body (`ZonesBody.tsx`) reads each zone's own step from its
     rows, puts a null at every step of that zone's clock in the window that it doesn't hold
     (`markGaps` in `figures.ts`), and hands its own panels to `SeriesChart`.
   - Wanted: the rows endpoint to mark missing steps per group on each group's own step, or
     `SeriesChart` to break a sparse series where its own points are more than its usual
     step apart.

2. **No partial days on a mixed clock.** `daySummaries` and `coverageSentences` need one
   step, so with `grain_ms` null the template can't say that Tue 22 Sep holds 4 of 96
   quarter-hours for one zone and nothing for the rest.
   - Meanwhile: the main body adds its own line of partial days, zone by zone on each zone's
     clock, and the working panel's days table gives each zone's count for a day held in part.
   - Wanted: a step per group in the rows response (or per group in the series model), so the
     template's coverage line can count each group on its own clock.

3. **Below-zero bands and period names need one step.** `runsBelowZero` returns nothing when
   the step is null, and tooltips name an instant rather than a period.
   - Meanwhile: with every zone drawn, the tooltip names the instant, and no band is drawn.
     With one zone selected, the page draws that zone alone on its own clock, so its tooltip
     names its quarter-hour or hour, its extremes are labelled and its runs below zero banded.

4. **No chart on a clock-time axis** (as the GB benchmark page's NEEDS item 1). The working
   panel's shape through the day is composed from the theme's parts in `ProfileChart.tsx`,
   with a hand-set x axis. A `clockAxis()` factory in `chartTheme.ts` would serve both pages.
   Its key also draws its own pale-band mark (the benchmark page's item 2).

5. **The table can't tell "not on this clock" from "not held".** In the template's table,
   Ireland's column shows a dash on the three quarter-hours after each hour, the same dash as
   a missing step. Meanwhile a note above the table says so. Wanted: a blank for a time off a
   group's own clock, and the dash kept for a step not held.

6. **A lone held step between gaps draws nothing** (as the demand outturn review noted): a
   line needs two points. Ireland holds one hour of 3 Sep between two gaps; the tables count
   it, the chart shows none. A dot for a held value with no held neighbour would show it.

7. **Area names.** The page names the five zones from gridflow's `area_codes.py` in its own
   `groups` (P4-0's NEEDS item 8 asked for a shared list). A shared EIC-to-name map would let
   every ENTSO-E page use the same words.

8. **A slow related read holds every panel** (as the power stack page's NEEDS item 9). While
   any related read is loading, `DatasetPage.tsx` keeps the page's state at loading, so the
   zones' chart, the key and the working panel all wait on GB's benchmark, which they could be
   drawn without. On `:8003` under load the benchmark took 139 s for 16 to 22 Sep, against
   about 55 s for this page's own rows; a page can't draw its rows first from inside its
   folder. The page keeps the read, and says in the main panel when it fails or holds
   nothing. Wanted: related reads that don't hold the page's own rows (draw those, then add
   the related panel with its own loading line), or a faster benchmark read in the backend.

9. **The upper panel's lowest tick has no label.** With a lower panel under it, `SeriesChart`
   gives the zones' panel a round scale down to −100 (7 days) or −200 (30 days) for a few
   euros below zero, and that lowest tick is drawn without its label, so the space under
   zero reads as unlabelled. The GB panel under it labels its own. Not worked around here;
   the scale and the ticks are the template's.
