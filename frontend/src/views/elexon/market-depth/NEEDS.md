# NEEDS: Market depth

1. **The system prices read beside the page come split by a filter-role dimension.**
   - What: `system_prices` has one dim, `price_derivation_code` (role `filter`). With no
     `group`, the rows endpoint splits by it anyway, so every half-hour comes back once per
     code, the held row under its own code and a null row under the other (672 rows for 336
     half-hours in a week). This is the same gap as item 1 of
     `gold/system-prices-joined-with-carbon-intensity/NEEDS.md`.
   - Why the page needs it: the template's related model makes a broken line per code and
     column, so `lower.from` can't draw the price.
   - What the page does instead: `figures.ts` (`systemPrices`) folds the related rows to one
     per half-hour (a clash between codes stays a gap and is counted), builds its own model,
     and the working panel draws from it. A window read as means isn't folded; the panel
     says so and draws no price.
   - Fix wanted: only a `series`-role dim becomes the default split, or `QuerySpec` gets an
     explicit "no split" that related datasets can use too.

2. **The coverage line reads as continuous coverage.** `market_depth` is held on 16 days
   between 1 Aug and 22 Sep 2026 (1–5 Aug, 1 Sep, 13–22 Sep). Where a window reaches past
   the local depth the template says "Held locally for 1 Aug – 22 Sep 2026 only", which
   reads as every day in that span. Same as item 3 of the gold page's NEEDS. The page adds
   its own sentence from `coverage.day_count` (`DepthWords`).

3. **A half-hour counts as held when any column holds it.** On 1 Sep the indicated
   imbalance holds 48 of 48 half-hours, the offer and bid volumes 27 and the accepted
   volumes 23. `heldDays` / `coverageSentences` count 1 Sep as full, so the template's
   note says nothing. The page counts each part itself: in the key, under the chart, and
   in the days table. Wanted: a per-column held count in the coverage note when columns
   differ.

4. **The source list's notes for `market_depth` are stale.** They say the local days are
   "1–5 Aug, then 1, 17 and 21 Sep only" and that 21 Sep holds nulls. On 29 Sep 2026 the
   rows endpoint returned 1–5 Aug, 1 Sep and 13–22 Sep, every one full but 1 Sep, and
   21 Sep held all 48 half-hours of every column. So a later fetch did fill 21 Sep's
   nulls, which answers the card's open question for that day; 1 Sep's remain. The page
   words its caveats without those dates. Wanted: a refresh of the card and the notes.
