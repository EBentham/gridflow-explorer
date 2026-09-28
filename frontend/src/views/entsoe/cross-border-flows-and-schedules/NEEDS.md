# NEEDS: entsoe / cross-border-flows-and-schedules

What the template or the endpoint lacks for this page, why the page needs it, and what it
does meanwhile.

## Template

1. **A related read can't follow the page's URL parameters.** `RelatedSpec.query` is static
   (`define.ts`), while the page's own `query` can be a function of the parameters.
   - The page reads borders one in area at a time (`?in=`), and draws each GB border's
     schedule beside its flow (and the flow beside its schedule). The beside read is pinned
     to GB's borders, so with France or the Netherlands as the in area nothing is drawn
     beside the continental pairs, and the GB read is still made.
   - Meanwhile: the page draws the beside line only when the two reads share an in area,
     and says why it doesn't otherwise.
   - Wanted: `query` on `RelatedSpec` as a function of the parameters, as on the dataset.

2. **Mixed-clock rows aren't gap-filled, and `SeriesChart` draws a sparse series straight
   across a hole.** `cross_border_flows` and `commercial_schedules` have `grain_ms: null`
   (hourly on some borders, 15 minutes on others), so a missing hour is just absent, and the
   chart's straight run between a sparse series' own points spans it (GB–Ireland (SEM)
   stops at 11:00 on 20 Sep and would be drawn through to the next day).
   - Meanwhile: the page reads each line's step from its own points (their median
     spacing) and places a null one step after each held value that the next doesn't
     follow within a step, so the line breaks there (`figures.ts`, `withBreaks`).
   - Wanted: a per-series step in the model, and breaks at missing steps in `SeriesChart`.
   - With the breaks, a value with nothing held a step either side on its own line draws
     nothing: `SeriesChart` dots a line's values only on a clock of a day or longer
     (`dots`), so on an hourly or 15-minute line no mark is left for it. Meanwhile: the
     page counts these values per border or zone under the chart (`aloneIn`), and the
     Table view lists them. Wanted: a dot for a lone held value on any clock.

3. **No held-of-expected counts on a mixed clock.** With `stepMs` null, `daySummaries`
   gives `expected: null`, and `coverageSentences` names no partial day.
   - Meanwhile: the page counts each line's values per UK day against the steps its own
     step fits in that day, and says which days miss steps under the chart.

4. **No label for each panel of a stacked `SeriesChart`.** The page draws one panel per
   border (their scales run from under 300 MW to about 3,000 MW, so one axis would flatten
   the smaller borders). `ChartPanel` has no title.
   - Meanwhile: each panel's value-axis caption names its border and unit
     (`GB–France, MW`).

5. **One split column only** (P4-0 NEEDS 2, again). A border is two columns (in and out
   area). Read whole, the flows answer `ambiguous_series`, so the page reads one in area
   at a time with a control. A two-column group would let one read carry all eight pairs.

## Domain questions for research (labelled on the page, not guessed)

6. **Which way the power moves on a held flow or schedule row.** The research card and
   the vault read `flow_mw` as the flow from the in area to the out area. ENTSO-E's own
   convention may be the reverse: entsoe-py's `query_crossborder_flows(from, to)` sends
   `in_Domain` = `to` and `out_Domain` = `from`, which would make the held GB rows flows
   into GB. The held values lean that way too (GB–France is rarely zero and runs to about
   3,000 MW; GB–Ireland (SEM) stays under 300 MW), but that is not proof. Until the ENTSO-E
   API guide (A11 and A09) settles it, the page names borders in area first
   (`GB–France`), never with an arrow, and never says import or export.

7. **The net positions' sign.** Each zone is named as the in area or as the out area, with
   `REGION_CODE-----` on the other side and a positive value. Checked for 15–21 Sep, each of
   the four zones is named on exactly one side in every one of its 672 quarter-hours (none
   on both, none on neither), and no value is negative. That is the shape a sign carried by
   the side would have; which side means export is the open question. The vault's
   "negative means export" doesn't fit these rows. The page keeps the two sides apart, and
   says under the chart when they take turns.

8. **Why GB–France comes hourly.** In the week checked, GB–France and GB–Ireland (SEM) come
   once an hour and GB–Belgium and GB–Netherlands every 15 minutes, which accounts for the
   card's 432 against about 1,728 rows. Whether ENTSO-E publishes GB–France more finely,
   and why GB–Ireland (SEM) misses hours, is open.
