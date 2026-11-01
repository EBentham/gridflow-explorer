# NEEDS: entsoe / outages-unavailable-capacity-per-interval

What the template or the endpoint lacks for this page, why the page needs it, and what it
does meanwhile.

3. **The default events source line names the wrong clock.** `mainSrc` says "one row per
   event, at its `timestamp_utc`" (the manifest clock), but the rows endpoint windows and dates
   events by `latest_day_rule.column` (`published_at`). The page overrides the main source
   line. The template could name the rule's column for events.

4. **Two coverages that disagree.** For these outage tables the source list's coverage is
   on the block-start clock (`outages_generation`: 15 Nov 2015 to 26 Jun 2069, 672 days),
   while the rows endpoint's is on publication time (2 Oct 2025 to 21 Sep 2026). About's
   "Held locally", `emptyWindowText` and `coverageSentences` all read the first.
   - Meanwhile: the side panel adds a line under About giving the publication run from the
     rows response. An empty custom window still says where the block starts run, not where
     the notices do.
   - Wanted: the source list's coverage for events on the rows' window column.

5. **Not in the rows (backend or gridflow):**
   - `outages_generation` has no document status, so its about 40% cancelled notices can't be
     filtered out; and no block end in any outage table, so durations and "out now" can't be
     drawn. Both are gridflow transformer gaps noted on the research card.
   - `outages_consumption` is served as events windowed on publication, though it is a
     regular 15-minute figure; a series read on `timestamp_utc` would let it chart.

6. **Domain question (labelled on the page, not guessed):** whether `unavailable_mw` is the
   capacity out or the capacity left. The column header says "MW (available or unavailable,
   unconfirmed)" and nothing adds it up until it is settled.
