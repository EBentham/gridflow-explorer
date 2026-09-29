# NEEDS: NESO national carbon intensity

What this page lacks, why it matters, and what it does meanwhile.

## Domain questions for research

1. **The index grades' boundaries, and what they grade.** The rows carry NESO's grade
   (`intensity_index`) for each half-hour. gridflow's schema names the five grades, but
   nothing held locally gives their boundaries in gCO₂/kWh: not gridflow's code or docs,
   the source list, or the vault's `carbon_intensity` note. Nor does anything say whether
   NESO grades the forecast or the estimated actual. The vault's 2024 sample is graded
   "moderate" at 239 to 248 gCO₂/kWh, and 2026 rows are graded "high" from 170, so the
   boundaries look to change over time and can't be read off the rows.
   - **Why it matters:** with the boundaries held, per period of validity, the main chart
     could shade the grades on its value axis, as the card's sketch asks. A model could
     then use the grade as a feature knowing what it measures.
   - **Meanwhile:** the page draws each half-hour's grade as published, in a strip over the
     chart, with no grade on the value axis. A caveat says both unknowns.

## Source list (backend)

2. **`intensity_current` and `intensity_today` give `never-fetched` as their cause.** Both
   serve only the present moment, which `text.ts` already words for the `current-only`
   cause. The toolbar says "gridflow hasn't fetched them", which is true but leaves out that
   no fetch could build their history.
   - **Meanwhile:** the side panel says NESO serves only the present half-hour and the
     present day.

## Template

3. **No strip of categories on a series chart's clock.** A text column holding one category
   per step, like NESO's grade, has no way onto the chart. It could be a strip over or
   under the chart, or a background wash.
   - **Meanwhile:** `IndexStrip.tsx` draws it as a 30px chart of its own over the template's
     `SeriesChart`. It has the same margins and value-axis width, so the clocks line up.
   - **What's missing:** the strip doesn't share the lines' tooltip. It has its own, when
     hovered.
   - **The fix:** a `chart.strip: { column, levels }` option would give it to other
     categorical columns, such as regional grades or system warnings.
