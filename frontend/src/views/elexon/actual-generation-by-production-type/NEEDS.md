# NEEDS: elexon / actual-generation-by-production-type

What gridflow, the rows endpoint and the template lack for this page, and how the page works
around each gap inside its folder.

## Rows endpoint (backend)

1. **`agws` refuses many past windows.** Live on :8003 on 29 Sep 2026, `group=psr_type` came
   back `ambiguous_series` with `varying_columns: ['generation_mw']`, no varying dimension
   and no filter that resolves it, for every 90-day window from 27 Sep 2025 to 30 Jun 2026,
   for March 2026, and for each of 28, 29 and 30 Mar 2026 alone. November 2025, May 2026,
   June 2026, 1 Jul – 27 Aug 2026 and the 30 days to 26 Sep 2026 read cleanly.
   - The silver keeps one row per key within a publish-day file (`agws.py` dedupes on
     settlement date, period and type), but the files are bucketed by publish day, so a
     key re-issued on a later day is held twice. The rows carry `published_at` and
     `document_revision`, but the manifest reads `agws` as `base` with no vintage rule.
   - Meanwhile the page says so in a caveat, and the template states the 422 in words.
   - Wanted: read `agws` (and `agpt`, which can re-issue the same way) latest per key, by
     `document_revision` then `published_at`, as `system_prices` reads `_latest`.
2. **A related dataset is read even where the page can't use it.** agpt reads FUELHH and
   agws beside it for the working panel. At 30 days that is 28,800 FUELHH rows and 4,320
   agws rows, and FUELHH's history runs well past agpt's 16 days held, so most of a custom
   window's FUELHH read is never compared. As the instantaneous page's NEEDS 4: a
   `RelatedSpec.query` that can depend on the page's parameters or the window would let the
   page skip it.

## gridflow (research, not template)

3. **agpt holds zeros at the start of each block of days.** From 31 Jul SP 47 to 4 Aug SP 18
   (164 of the block's 240 half-hours) and from 12 Sep SP 47 to 13 Sep SP 18, every type but
   wind and solar is exactly 0 MW, while FUELHH shows nuclear, CCGT and biomass running
   (e.g. 2 Aug SP 10: 3,372, 5,983 and 2,479 MW). A fetch made before Elexon filled in those
   types, with no later re-fetch, would look like this, but that is unconfirmed. The page
   finds such runs in the rows (`zeroRuns`), names them above the stack and in a caveat, and
   draws them as held. Wanted: a re-fetch of those days, and a rule for whether a zero across
   every non-weather type is a placeholder.
4. **agpt's pumped storage is never below zero.** In every agpt row held (1–5 Aug and
   12–21 Sep 2026), `Hydro Pumped Storage` is zero or above; FUELHH's `PS` is below zero
   while pumping (down to −1,214 MW on 15–21 Sep). Whether Elexon's B1620 figure is
   generation only, with pumping left out, is unconfirmed. The page reports the difference
   and doesn't explain it.
5. **agpt's wind is far from FUELHH's `WIND` on some days.** On 15–21 Sep 2026, onshore plus
   offshore sits a median 1.6 GW from FUELHH's `WIND`, up to 12.4 GW on 17 Sep at 20:30 BST,
   where agpt's offshore wind reads about 0.2 GW and FUELHH's wind about 15.9 GW. agws holds
   the same offshore figures. Why is a research question: which plant each counts, or a
   publishing fault on those days.
6. **Timing against FUELHH.** Paired on the settlement day and period both datasets carry,
   agpt's non-wind types sit a median 2–130 MW from FUELHH's matching codes on 15–21 Sep.
   Set one settlement period later, several of those medians shrink (biomass 9 → 5 MW,
   run-of-river hydro 7 → 2 MW, other 131 → 71 MW), though neither alignment matches
   exactly. The page pairs on the settlement period as served and says nothing of an offset;
   whether B1620's period labels line up with FUELHH's is unconfirmed.
7. **agws solar scope.** Whether the solar figure is all of GB's solar or only the metered
   part is unconfirmed (the vault's agws TODO). The page says so.

## Template

8. **Custom key swatches for patterned bands** (as the ENTSO-E generation page's NEEDS 5).
   Offshore wind and oil share wind's and peaking's colours, hatched, so the page draws its
   own main chart (`StackBody`, through `SeriesChart`) and its own key (`StackKey`) with a
   CSS stripe for their swatches. A `fill` and `swatch` on `GroupSpec` would let the
   template's body and key do it.
9. **Key focus isn't in the URL** (as the physical notifications page's item 11), so a type
   drawn alone can't be linked or shot. The working panel's pairing has its own parameter,
   `?pair=`, for that reason.
10. **No daily bars on the template's clock.** `SeriesChart` draws bars on the window's
   clock, centred on each row's time. The daily energy panel stamps each day's bars at the
   day's middle so they fall between the day rules, and the tooltip still names the day.
   A daily-bucket option on a panel would say this directly.
