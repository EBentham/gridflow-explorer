# NEEDS: gold / GB day-ahead benchmark

1. **No chart on a clock-time axis.** The working panel draws the benchmark by UK clock time
   of day (00:00 to 23:30), gathered across the window's days. `SeriesChart` and
   `chartTheme.timeAxis` draw instants only, so `ProfileChart.tsx` composes its own Recharts
   chart from the theme's parts (`GRID`, `TICK`, `CURSOR`, `valueAxis`, `lineProps`,
   `fanBandProps`, `ChartFrame`, `TooltipBox`, `Extreme`). The one thing it sets by hand is
   the x axis: ticks every three hours, labelled `HH:MM`, with the axis stroke and tick style
   copied from `timeAxis`. A `clockAxis()` factory in `chartTheme.ts` would let any page draw
   a daily shape without repeating that.
2. **No key mark for a single pale band.** `KeyMark` has `swatch` (solid) and `fan` (three
   forecast bands), neither of which looks like one lowest-to-highest band drawn at the
   fan's opacity. The working panel draws its own `ul.gf-key` with an SVG rect at that
   opacity. A `{ kind: 'range', color, opacity }` mark would cover it.
