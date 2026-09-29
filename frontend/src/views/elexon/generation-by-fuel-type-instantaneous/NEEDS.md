# NEEDS: elexon / generation-by-fuel-type-instantaneous

What gridflow, the rows endpoint and the template lack for this page, and how the page works
around each gap inside its folder.

## gridflow (backlog)

1. **`fuelinst` is stamped at Elexon's publish time, not the reading's start.**
   `gridflow/src/gridflow/silver/elexon/fuelinst.py` builds `timestamp_utc` from
   `publishTime` when a file has it, and falls back to `startTime` only when it doesn't.
   In all 80,920 bronze rows held (checked 2026-09-29), `publishTime` is exactly five minutes
   after `startTime`, and every row's `startTime` falls in the `settlementDate` and
   `settlementPeriod` it carries. So the row stamped 00:00 is the reading Elexon puts in the
   day before's last settlement period.
   - Checked against `fuelhh` for 16–22 Sep 2026: the mean of the six readings stamped
     `T + 5` to `T + 30` minutes matches FUELHH's half-hour `T` to 0.4 MW on average (5,800
     half-hours, every code). The six stamped `T` to `T + 25` miss it by 15 MW on average.
     Three half-hours miss by more than 5 MW on several codes at once (16 Sep 12:30 and
     20:30 BST, 21 Sep 10:00 BST; CCGT by up to 98 MW). The page reports such gaps as it
     finds them and doesn't explain them; why FUELHH differs there is a research question.
   - The page pairs readings with FUELHH on that `T + 5` to `T + 30` rule, which is
     Elexon's own settlement-period assignment; it draws and names readings by their stamp,
     and says so in a caveat.
   - Asked for: stamp on `startTime`, or keep both columns.
2. **The silver drops the settlement day and period the files carry.** Every bronze row has
   `settlementDate` and `settlementPeriod`, but the transformer keeps neither (its comment
   says the output has no settlement coordinates). With them, the page could name each
   reading's settlement period, as the template does for FUELHH, and pair it with FUELHH
   without the five-minute rule above.

## Rows endpoint (backend)

3. **Downsampled means are grouped by stamp.** Past about a week (more than 50,000 rows at
   20 codes) the backend reads the window as 15- or 30-minute means bucketed on
   `timestamp_utc`. With the stamps above, a 30-minute mean holds the readings for 23:55 to
   00:25, five minutes off FUELHH's half-hours. The working panel doesn't compare means with
   FUELHH and says why. A bucket on the start time (item 1) would fix it.
4. **A related dataset is read even where the page can't use it.** At 30 days the page reads
   28,800 FUELHH rows it doesn't draw, as `RelatedSpec.query` is fixed. A related query that
   can be a function of the window (or of the page's parameters, as `query` is) would let the
   page skip it.

## Template

5. **`groups` can't fold several values of the split into one band.** The Generation mix
   screen's nine bands fold OCGT, coal and oil into peaking and every `INT…` code into net
   imports. The template draws one series per group value, so the page builds its own band
   rows (`fold` in `fuels.ts`) and draws them through `SeriesChart` in its own main panel.
   Asked for: a `band` on `GroupSpec` that sums group values into one series (null only where
   every member is null).
6. **`SeriesChart`'s tooltip has no sub-rows.** The pinned Generation mix tooltip itemises
   the sources inside a band. Here the tooltip gives the bands only; the key lists the folded
   codes at the latest reading and the table has a column per code.
7. **Periods are named from the start of a row.** `periodLabel` names a five-minute row
   stamped 00:00 as 00:00–00:05. The readings here are stamped five minutes after the start
   time Elexon gives them, so the page passes `stepMs: null` to its charts, which name each reading by its
   stamp as an instant, and its table does the same. A clock option saying rows are stamped
   at the end of their period would let the template name them itself.
8. **Key focus isn't in the URL** (as the physical notifications page's item 11). The
   working panel follows the band selected in the key, so a band's half-hour view can't be
   linked or shot. It is shot here with the default, total generation.
