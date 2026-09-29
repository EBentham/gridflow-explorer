# NEEDS: entsoe / transfer-capacity

What the template or the endpoint lacks for this page, why the page needs it, and what it
does meanwhile. Items 1, 2 and 4 are the flows page's NEEDS 1, 2 and 5 again; the same
template fix would serve both pages.

## Template

1. **A related read can't follow the page's URL parameters.** `RelatedSpec.query` is static.
   - The page reads borders one in area at a time (`?in=`) and draws the family's other
     measures beside each border: allocated and nominated beside the net transfer capacity,
     the net transfer capacity beside the others. The beside reads are pinned to GB's
     borders, so with France or the Netherlands as the in area nothing is drawn beside the
     continental pairs, and the GB reads are still made.
   - Meanwhile: a beside line is drawn only when its read shares the page's in area, and
     the main panel says why it isn't otherwise.
   - Wanted: `query` on `RelatedSpec` as a function of the parameters.

2. **Rows that aren't gap-filled, and `SeriesChart` drawing a sparse series across a hole.**
   `total_nominated_capacity` (hourly on GB's borders, 15 minutes on France–Germany/
   Luxembourg) and `dc_link_intraday_transfer_limits` (published only when a limit is set)
   come with `grain_ms: null`. The limits on 1 Aug and 5 Aug would be drawn as one line.
   - Meanwhile: each line's step is read from its own held points, and a null is placed
     one step after each value the next doesn't follow within a step (`figures.ts`,
     `withBreaks`). Held values with nothing either side are counted under the chart
     (`aloneIn`) and listed in the Table view.
   - Wanted: a per-series step in the model, breaks at missing steps in `SeriesChart`,
     and a dot for a lone held value on any clock.

3. **Helpers copied from the flows page.** `figures.ts` and `words.ts` here are trimmed
   copies of the flows page's (per-line step, breaks, per-day tallies against a line's
   own clock, cadence and missing-step sentences). No page imports another family's
   folder, so they were copied. Wanted: promote them to `_template/` (a per-line clock
   module) so both pages read one copy.

4. **One split column only.** A border is two columns (in and out area); read whole, every
   dataset here answers `ambiguous_series`. The page reads one in area at a time with a
   control, offering only the in areas each dataset holds rows for. A two-column group
   would let one read carry every pair.

5. **No label for each panel of a stacked `SeriesChart`.** The page draws one panel per
   border, each on its own scale (GB–France runs to about 4,000 MW, GB–Ireland (SEM) to
   about 1,400). Meanwhile: each panel's value-axis caption names its border and unit.

## Domain questions for research (labelled on the page, not guessed)

6. **Which way the capacity runs on a held row.** As on the flows page, the page names a
   border in area first, never with an arrow, and never says import or export capacity.
   The same research (ENTSO-E API guide, `in_Domain` / `out_Domain` for A61, A26 and A93)
   would settle it here.

7. **Whether nominated and allocated can be read as shares of the net transfer capacity.**
   The research card sketches "utilisation %" and "nominated share". The page draws the
   measures beside each other under the same in and out area codes, and works out no
   ratio: whether the three datasets count the same direction the same way isn't
   confirmed.

8. **The three offered-capacity datasets and the use of transfer capacity.** All four came
   back empty. For the three offered-capacity datasets ENTSO-E's reply named its implicit-
   allocation data each time, so the explicit and continuous requests look mis-parameterised
   in gridflow's connector (a gridflow backlog item, not an Explorer one). The page names
   all four as not held, with the reason in words.

## Manifest note out of date

9. The `net_transfer_capacity` note says "14–20 Sep: only 14 Sep held". The local rows as
   read on 29 Sep hold every hour of 8–21 Sep (and 1–5 Aug). The page doesn't print the
   note; the template's coverage sentences read the rows.
