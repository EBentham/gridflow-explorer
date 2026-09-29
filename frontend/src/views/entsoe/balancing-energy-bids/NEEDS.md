# NEEDS: entsoe / balancing energy bids

What the template or the endpoint lacks for this page, why the page needs it, and what it
does meanwhile.

1. **The rows endpoint can't add bids up.**
   - What: the natural view of this dataset, the one its research card suggests, is the MW
     offered per zone and direction, summed over the bids. The rows endpoint only splits by one
     dim and only averages (when it downsamples). `bid_mrid` is part of each row's identity, so
     any read that doesn't pin it must split by it.
   - Why the page needs it: to draw one total a read has to bring back every bid's row at every
     step of the window, with nulls where a bid isn't offered. The default, Belgium A01 over
     7 days, is 74 bids × 672 quarter-hours = 49,728 rows (6.4 MB) against a 50,000-row cap:
     one more bid in the week and it comes back as 30-minute means, and the headline becomes a
     count of bids. A 30-day window of one product comes back as hourly means. A sum of per-bid
     means isn't the MW offered, so such a window gets a count of bids per step and no MW.
   - A 30-day window of every product (Belgium's default) is refused: 413 `mixed_identity`, as one
     bid id carries A05 at one time and A07 at another, so its means would mix two series. The
     template's error says "Choose a shorter window". The page can't add that picking one
     product also works: on an error the main body doesn't render and the key and working
     panels show the pending line. It says so in the toolbar, beside the product control,
     which is the one place it can. Wanted: a page hook into the error state (a sentence of its
     own under the template's), or the sum in the next bullet.
   - What the page does instead: reads one zone and one direction split by `bid_mrid`, and adds
     the bids up in `figures.ts` (`bookOf`). On means it draws the bids per step and says why.
   - Wanted: a `sum` aggregation (and a count of contributing rows) across a dim that isn't the
     split, e.g. `group=direction&filter=area_code:…&agg=sum`.

2. **A related read can't follow the page's parameters.** `RelatedSpec.query` is fixed, so the
   page can't read the other direction of the zone chosen beside its own and draw up and down
   mirrored, as the market depth page does. It shows one direction at a time instead
   (`?dir=`). Wanted: `RelatedSpec.query` as a function of the URL parameters, as `query` is.

3. **Isolated points draw nothing on a sub-day clock.** France and Germany / Luxembourg hold one
   quarter-hour a day. On the window's full grid a `stacked` or `line` mark draws nothing
   between gaps, and `bars` on 672 steps are under 2px wide. The page passes only the held rows
   and draws bars when no two held steps sit side by side (`Book.isolated`). Wanted:
   `SeriesChart` to dot a line's isolated points whatever the step.

4. **No unit for a count.** `units.ts` has no rule for a count of rows, so a count of bids would
   read "unit unconfirmed". The page builds its own `DisplayUnit` (`BIDS_UNIT`, `figures.ts`).
   Wanted: a `count` unit in `units.ts`.

5. **Which zones hold which directions isn't in the source list.** `dims` gives cardinalities,
   not values. The page lists each zone's directions from the local rows as read on
   29 Sep 2026 (`zones.ts`: Germany / Luxembourg holds A02 only), so its control never offers a
   read that comes back empty. A zone or direction that lands later won't be offered until
   `zones.ts` is edited. Wanted: the distinct values of low-cardinality dims in the source list.

6. **A blank product can't be filtered.** Most of France's bids carry an empty
   `standard_market_product`, and a filter value must hold at least one character, so the page
   has no product control (it would miss those bids). It adds every product together and says
   so.

7. **The source list's notes for this dataset are stale.** They give "BE 30,335 rows; FR and
   DE-LU 500 each" and a `bid_mrid` cardinality of 1,082, from 5 days. On 29 Sep 2026 the store
   held 14 days (1–5 Aug, 13–21 Sep), 81,563 rows: Belgium 78,763, France and
   Germany / Luxembourg 1,400 each, exactly 100 bids a day for each, all at 00:00 UTC. That is
   the cut-off pattern the card suspected, now on every day held. Belgium's rows also stop at
   21:45 UTC and start at 00:00 UTC, so each UK day lacks 23:00 to 01:00 BST; the page names
   that stretch from the rows (`dailyHoleText`). Wanted: a refresh of the card and the notes,
   and a look at the download's page limit for France and Germany / Luxembourg.
