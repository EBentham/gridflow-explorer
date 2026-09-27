# NEEDS: System prices joined with carbon intensity

1. **A filter-role dimension is used as the series split, and a page can't ask for no split.**
   - What: `gold_uk_imbalance_context` has one dim, `price_derivation_code` (role `filter`,
     values N, P and rarely K). With no `group` in the request, `backend/app/rows.py`
     (`validate`, around line 188) falls back to the first dim of any role. So every
     half-hour comes back once per code: the held row under its own code, and null rows
     padded under the others (672 rows for 336 half-hours in a week). `QuerySpec` has no way
     to say "no group": `group` must be a dim, and filtering to one code drops the other
     half of the half-hours.
   - Why the page needs it: the template's series model makes one line per code and
     column ("N, System sell price", "P, System sell price"), each broken wherever the
     other code holds the half-hour.
   - What the page does instead: `figures.ts` folds the rows back to one per half-hour
     (the row that holds values, or a null row where none does, so gaps stay gaps). A
     half-hour two codes both held would be kept as a gap and counted on the page; none
     was seen. The page replaces the main, key and working panels to draw from the folded
     rows.
   - Fix wanted: only a `series`-role dim becomes the default split, or `QuerySpec` gets an
     explicit "no split" (`group: null`) that the adapter sends and the backend honours.

2. **Bucket means come apart by that same code.** A long window is read as means per
   `price_derivation_code`.
   - Hourly means (a year, measured) join exactly: an hour spans two half-hours, and each
     half-hour carries one code. So two codes' means in one hour are each of one half-hour,
     and one code's mean is already the hour's. The page joins them and draws the chart. It
     leaves out the key's and the days' half-hour figures, because an hour's mean doesn't
     say how many half-hours it holds.
   - From two-hour buckets up, how many half-hours each code's mean covers isn't sent, so
     the means can't be joined. The page says so, draws no chart for such a window, and its
     Table shows the means as sent, one row per code.
   - Fixing item 1 fixes this too.

3. **The related coverage line reads as continuous coverage.** For a related dataset whose
   local depth differs from the page's own, `relatedFacts` (`panels.tsx`) calls
   `coverageSentences` (`text.ts`), which says "held locally for 1 Aug – 22 Sep 2026 only".
   NESO's `carbon_intensity` is held on 16 days in that span, with a five-week hole
   (7 Aug – 12 Sep).
   - Wanted: when `day_count` is smaller than the span, say "on N days between X and Y".
   - Meanwhile the page adds its own sentence under the chart, from the related rows: the
     days of the window that hold intensity, the runs without it, and the local day count.

4. **The one-day value axis can skip zero.** On `?days=1` the imbalance panel's ticks read
   250 / −250 / −750, so its zero line has no label. That comes from the template's tick
   generator, not from the page.
