# NEEDS: neso_data_portal / embedded-wind-and-solar-forecast

For the seat to batch. Each item says what is missing, why this page needs it, and what the
page does meanwhile.

1. **The default window rests on the latest local day being the last forecast day.**
   - The research card's rule for this dataset is the day of the newest issue, and the
     forecast runs about two weeks past it. The source list, read live on 29 Sep, gives
     `latest_local_day` 2 Sep, the last forecast day held, so the default week (27 Aug –
     2 Sep) holds 336 of 336 half-hours.
   - If the backend is changed to follow the card's rule, the default week would end on
     20 Aug, the issue day, and hold 4 half-hours.
   - Meanwhile the page relies on the template's default and adds no window control of its
     own. Wanted: a ruling that a forecast's latest local day is its last forecast day, or a
     per-view default window.
2. **No line over a stacked chart.** The main chart stacks the two forecasts, so its top is
   the embedded total. The template can't draw NESO's generation mix figure as a line over
   that stack, as a panel has one mark. Meanwhile the working panel sets each forecast against
   the mix in charts of its own, on the same clock.
3. **No reference line for a ceiling.** The capacity columns are one value through the issue
   held (6,417 MW wind, 23,301 MW solar). The research card sketched them as dashed ceilings,
   but in the chart language dashes mean made-up data, and on one axis the solar capacity
   squashes the forecasts. Meanwhile the key gives the capacities and solar's peak as a share
   of its capacity, and the table lists them per half-hour. Wanted: a quiet reference-line
   style for a constant, if the design wants ceilings drawn.
4. **The table view has no issue time per row.** The rows carry `issue_time`, but the
   template's table lists only the value columns. Meanwhile a sentence under the table and
   the key name the issue and how far ahead it was made, read from the rows. With one issue
   held that is enough; once several are held, a column would say which half-hour came from
   which.
