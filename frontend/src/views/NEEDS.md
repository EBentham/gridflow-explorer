# NEEDS (P4-0): gaps the reference batch and the pilot worked around

For the seat to batch into a backend or template-fix unit. Each line says what is missing,
why a page needs it, and what the page does meanwhile.

## Rows endpoint (backend)

1. **Reference tables carry only their spec columns.** The projection is values, dims, clock
   and dedup keys, so identifying columns never reach the page.
   - `elexon/bmunits_reference` has no unit id or name: rows of one company can't be told
     apart. The page says so in a caveat.
   - `entsoe/generation_units_master_data` has no unit names. The page shows codes and says so.
   - `entsog/tariffs` lacks the paired unit and currency columns. Both tariff values show as
     published, unit unconfirmed.
   - `entsog/tariffs` and `tariff_simulations` carry direction (entry or exit) and capacity
     (firm or interruptible) only inside the composite `id`, and the simulations carry the
     point only there too. Rows look duplicated without them, so the pages show the `id` as
     the last column and say why.
   - `gie_agsi/unavailability` lacks the outages' start, end and publication times. Rows are
     dated by `event_time` only, and the page says so.
2. **One split column only.** `entsog/available_through_oversubscription` exit varies by
   `operator_key` as well as `point_key`, so every one-column request answers
   `ambiguous_series`. Released capacity reads one direction at a time, and Exit shows the
   ambiguous state for that dataset, with a caveat. It needs a two-column group, or a
   composite series key.
3. **No day range for a clockless events table.** `gie_agsi/unavailability` has
   `clock: null`, so its coverage has no `first_day` or `day_count` (0). About now counts its
   rows instead of "nothing yet", but the page can't say which days are held.
4. **Numbers held as text** (`gie_agsi/unavailability` figures,
   `entsog/tariff_simulations` cost). The template shows them as published and sorts them as
   numbers. A numeric cast in the backend would let a page chart them.

## Shared code outside this unit's boundary

5. **DESIGN.md §9** still says the template demo is deleted by P4-0. P4-0 keeps it, as its
   brief asked: it is the only way to shoot the error, refreshing, toomany and empty states
   on demand. The line needs updating.
6. **Pages hang on "Reading gridflow's source list…" (shots time out).** Vite's `/api`
   proxy reuses keep-alive sockets to the backend, and uvicorn drops them after its 5 s
   keep-alive. Measured on 27 Sep:
   - Direct to :8001 with a keep-alive agent, 2 of 40 requests were reset, each on a
     reused socket after a 5 s gap.
   - Through the proxy, 4 of 40 requests stalled: headers and about 195 KB of the 197 KB
     manifest arrived, then nothing. Vite logs `http proxy error … ECONNRESET`. Once the
     headers are out it can't send its 502, so the browser waits forever.
   - The shoot harness timed out on 4 of 24 page loads, and on 5 of 20 in one run.

   The fix is one line in `vite.config.ts`, which is outside P4-0's boundary: give the
   proxy `agent: new http.Agent({ keepAlive: false })` (import `http` from `node:http`).
   With that agent, the same probes gave 0 of 80 requests and 0 of 24 page loads failing.
   It fixes Bobbo's own `:5173` as well.

## Domain questions for research (labelled on the pages, not guessed)

7. **ENTSO-E's GB unit lists look stale.** `installed_capacity_units` and
   `generation_units_master_data` still list 10 GB hard-coal units dated 2026, and GB's last
   coal plant closed in 2024. The pages label GB's rows as the last list sent, not the 2026
   fleet. It needs confirming before any stack work uses these capacities.
8. **EIC area names.** There is no shared EIC→name list, so pages show area codes. A
   research-confirmed map would let `ColumnSpec.text` name them.
