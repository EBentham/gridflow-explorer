# NEEDS: neso_data_portal / wind-availability-per-bm-unit

What the template and the rows endpoint lack for this page, and how the page works around
each gap inside its folder.

## Rows endpoint (backend)

1. **No default top-N for this dataset.** The backend's top-N cut (`_top_pn` in
   `backend/app/rows.py`) is for `elexon/pn` only, so a read returns every unit, about 276 a
   day. That is small (1,932 rows for 7 days; the whole local copy is 3,589), so the page
   reads every unit once and picks the ten largest for the key, and the one unit asked for
   (`?unit=`), from those rows. A filtered read per unit would lose the total the page sets
   each unit against. If the dataset grows (more captures), a per-dataset top-N or a server
   sum per day would keep reads small.
2. **No name, owner or technology for a `bmu_id`.** The BM unit register's rows carry no unit
   id (P4-0 NEEDS item 1), so the page names units by id only. Elexon's `uou2t14d` holds a
   `national_grid_bm_unit` column that may match NESO's ids, but nothing confirms the join,
   so the page doesn't use it.

## Template

3. **`values[].display` is fixed per dataset.** The total reads in GW and one unit in MW
   (DESIGN §6). The page builds its own chart rows for both (`totalPanel` and `unitPanel` in
   `figures.ts`). The physical notifications page asks the same (its item 5).
4. **A daily figure on a half-hourly chart.** The rows put a DATE at UTC midnight, 01:00 BST,
   an hour after the day rule, and a daily line alone draws its points joined across days.
   Each figure is for the whole day, so the page carries it on every half-hour of its UK day
   (the line holds it flat from midnight to midnight) and sets GB wind output on the same
   clock. A `ChartPanel` option to draw a daily series as a held level would make this
   shared.
5. **Empty state for a unit the rows don't hold.** The unit is picked from the rows, not the
   request, so an unknown `?unit=` reads fine and the main, key and working panels each say
   "No unit X in this window's rows". A template sentence for a view-level miss would do
   this once.
