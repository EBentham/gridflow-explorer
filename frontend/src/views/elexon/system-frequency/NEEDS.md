# NEEDS: elexon / system-frequency

What the rows endpoint, the template and the research behind this page lack, and how the page
works around each gap inside its folder.

## Rows endpoint (backend)

1. **Downsampling serves means only.** Past about eight days (more than 50,000 steps at 15 s)
   the backend reads `freq` as 15-minute means (`truncation.aggregation: 'mean'`). A mean
   flattens the swings inside its quarter-hour, and for frequency the swings are the point: a
   quarter-hour can hold readings below 49.8 Hz while its mean sits at 49.95 Hz.
   - At 30 days the page draws the means, calls its highest and lowest "means", and counts no
     time outside a band. The working panel says why and lists the periods held per day.
   - Asked for: per-bucket `min` and `max` (and a count of readings held in the bucket) beside
     the mean, as the card's suggested view already says ("per-minute min/mean/max"). With
     them the page could draw the envelope and count time outside at any window length.
2. **A bucket doesn't say how much of it is held.** A 15-minute mean over 1 of its 60 readings
   looks the same as one over all 60. The first and last quarter-hour of each run of held
   days (e.g. 22 Sep 2026, which holds one hour) are such means. The page can't flag them.
   The count asked for in item 1 would cover this.

## Template

3. **`SeriesChart` has no horizontal reference lines.** The page needs 50 Hz and the band
   edges drawn on the value axis, and a value axis that always takes in both statutory
   limits. `ChartPanel` has neither, so `FreqMain.tsx` composes its own chart from the shared
   theme's pieces (`ChartFrame`, `timeAxis`, `valueAxis`, `DayRules`, `TooltipBox`,
   `Extreme`, `lineProps`), as `gold/power-stack-clearing/CurveMain.tsx` does. Its line
   labels copy that page's `LineLabel` (the `gf-extreme` class with a surface halo).
   - Asked for: `ChartPanel.refs: { y, label, strong }[]` and `ChartPanel.domain` (a floor
     and ceiling the scale must include).
4. **The chart draws every reading.** At 7 days that is 40,320 points in one Recharts line.
   It renders, and hover keeps up. This was measured on 29 Sep 2026 in headless Edge at 1440
   px, sweeping 60 positions across the chart in each theme:
   - from a mouse move to the second animation frame after it took a median of 39 ms and at
     most 65 ms, including the harness's own round trips;
   - no task ran 50 ms or longer;
   - the console showed no errors.
   The page doesn't thin readings client-side, so no excursion is
   hidden. A min/max envelope from the endpoint (item 1) would let long native windows be
   drawn lighter without losing one.

## Research (labelled on the page, not guessed)

5. **The 49.8–50.2 Hz band has no source.** The research card's sketch asks for "minutes
   outside 49.8–50.2 Hz per day", and nothing in its evidence (the silver transformer, the
   connector, gridflow's notes on the dataset) names that band or who sets it. The page
   counts it, calls it "the band this page was asked to count", and never calls it a limit.
   It needs a primary source (the NESO operating standard or Grid Code clause) before the
   page names it as an operational limit.
6. **The statutory 49.5–50.5 Hz range is sourced to gridflow's own notes only**
   (`30-vendors/elexon/datasets/freq.md`: "a statutory operating range of 49.5–50.5 Hz"),
   with no regulation cited. The page says where the figure comes from. A primary source
   (the regulation that sets it) would let it say so.
7. **Cadence and what a reading is.** Every day held has readings 15 seconds apart, 5,760 a
   day (measured again 29 Sep 2026 on 16–22 Sep: one gap, no other spacing). gridflow's
   notes say Elexon samples about every 2 seconds and publishes one-minute aggregates, which
   disagrees with what is held. Whether a reading is a spot sample or an average over its
   15 seconds is not confirmed. The page counts time outside at 15 seconds a reading and
   says that anything between two readings isn't seen. If a reading is an average, the
   extremes are understated; that needs confirming from Elexon's documentation.
