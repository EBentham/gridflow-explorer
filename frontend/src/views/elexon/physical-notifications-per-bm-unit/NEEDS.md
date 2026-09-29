# NEEDS: elexon / physical-notifications-per-bm-unit

What the template, the rows endpoint and gridflow lack for this page, and how the page works
around each gap inside its folder.

## gridflow (backlog)

1. **gridflow keeps one run of each half-hour's notification, the first, so `level_to` is
   not the half-hour's end.** In `gridflow/src/gridflow/silver/elexon/pn.py` the transformer
   runs `df.unique(subset=["settlement_date", "settlement_period", "bm_unit_id"], keep="last")`.
   Elexon sends a unit's plan for a half-hour as one or more runs (`timeFrom`, `levelFrom` →
   `timeTo`, `levelTo`), and its files list them newest first. In bronze
   `elexon/pn/2026/09/16`, all 33 multi-run half-hours of `T_KEAD-2`, `T_SPLN-1`, `T_DRAXX-1`
   and `I_ISG-NDPL1` list the latest run first. So `keep="last"` keeps the earliest run.
   - `level_from` is the level at the half-hour's start, which is right.
   - `level_to` is where the first run ends. It is the half-hour's end only when the plan held
     one run. Three cases on 16 Sep 2026:
     - `T_KEAD-2`, SP 42: notified 240 → 10 → 0 MW by 20:00 UTC; silver holds 240 → 240.
     - `T_SPLN-1`, SP 9: ramped 0 → 53 MW; silver holds 0 → 0.
     - `T_KEAD-2`, SP 28: silver holds 0 → 225 MW; the half-hour ends at 240.
   - In the 7-day read of the top 20 (16–22 Sep 2026), 1,567 of 6,700 consecutive pairs
     (23%) have an end level that isn't the next half-hour's start level.
   - The backend ranks its default top 20 by `avg(level_to)` (`backend/app/rows.py`,
     `_top_pn`), so the ranking carries the same bias. `avg(level_from)` would rank on the
     sound column.

   Fix in gridflow: keep the first run's `levelFrom` and the last run's `levelTo` for each
   half-hour, or keep every run with its times. Meanwhile the page draws `level_from` only,
   shows `level_to` in the table as "End level as kept", and says why in a caveat.

## Rows endpoint (backend)

2. **The BM unit register can't name this dataset's units.** `bmunits_reference` rows carry
   only `registered_capacity_mw`, `fuel_type`, `gsp_group_id` and `company_name`, and no
   `bm_unit_id` or name (P4-0's NEEDS item 1). So nothing joins a notification to the register.
   - What the page does instead: it reads each unit's fuel beside it from `uou2t14d`, which
     carries both `bm_unit_id` and `fuel_type`. That costs about 770 KB for 7 days, read
     only for the fuel.
   - `uou2t14d` lists about 475 units per window, against pn's 2,490, and nothing before
     3 Aug 2026. A unit it doesn't list is drawn in a neutral colour as "Fuel not listed".
     `I_ISG-NDPL1`, the top unit for 16–22 Sep 2026, is one.
   - Asked for: `bm_unit_id`, the unit's name and `bmUnitType` in the register's rows; or a
     fuel column on pn, joined in the backend; or a light unit-to-fuel lookup.
3. **Fuel totals over every unit need the backend.** The page can only sum the units it
   reads, the top 20, and says so ("the sum of these 20 units only, not GB's total"). A
   GB-wide sum of notified levels by fuel needs the join above and an aggregate over about
   118,000 rows a day. That is server work.
4. **The top-N is fixed at 20.** `_top_pn` has `LIMIT 20`, so a page can't ask for 10 or
   50. The toolbar's "Top 20" comes from a constant here (`TOP_N` in `figures.ts`) that
   mirrors it.

## Template

5. **`values[].display` is fixed per dataset.** The stack of units reads in GW; one unit
   reads in MW (DESIGN §6). The page asks the model for MW and builds its own GW rows for
   the stack (`stackPanel` in `figures.ts`). A `values` that can be a function of the URL
   parameters, as `query` can, would let the template's own panels follow the mode. The wind
   sites page asks the same.
6. **The empty state blames the window when a page's filter matches nothing.** Take
   `?unit=` naming a unit with no rows in the window. The main panel says "Its local rows
   run from 1 Aug to 22 Sep 2026, with none in …", which is the dataset's coverage, not the
   unit's. The toolbar, key and working panel say "No rows for <unit> in <window>" instead.
   Asked for: an empty-state sentence a view can supply, or a template sentence naming the
   filters when a filtered read is empty.
7. **No tooltip note per panel in `SeriesChart`.** The tooltip names each half-hour as a
   window (`14:30–15:00 BST`), while the value drawn is the level at its start. The hint
   under the chart and the key say so. A panel-level tooltip note would let the tooltip say
   it too. The power stack page asks for the same piece.
8. **No shared scatter.** `PriceScatter` composes the theme's grid, ticks, value axis and
   tooltip, as the wind sites page's `SpeedScatter` does, with its x-axis props written
   here. A shared `valueXAxis` would keep every scatter alike.
9. **No neutral data token for an unknown category.** Units with no fuel listed are drawn
   in `--chart-tick`, the neutral ink the power stack page uses for its price floor. A token
   meant for "not known" data would be cleaner.
10. **A lowest-value label at the panel's floor is clipped.** `SeriesChart` sets the
    "lowest" label 15px under its dot. In an upper panel with a lower one beneath it, the
    SVG's bottom margin is 2px, so a lowest at the axis floor shows its dot but no words.
    `T_KEAD-2`'s 0 MW, at the foot of its 0–1,000 MW axis, is one. The key names the lowest
    and when, so nothing is lost. Asked for: a lowest label that flips above its dot near
    the floor, as `extremeAnchor` flips the text's side near the right edge.
