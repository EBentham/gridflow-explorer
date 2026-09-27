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

2. **Bucket means come apart by that same code.** For a window of a year (measured), the rows are read as
   hourly means per `price_derivation_code`. An hour whose two half-hours carry different
   codes comes back as two means, and the endpoint doesn't send how many half-hours each
   covers, so they can't be joined honestly. The page says so in words, draws no chart for
   such a window, and its Table shows the means as sent, one row per code. Fixing item 1
   fixes this too.
