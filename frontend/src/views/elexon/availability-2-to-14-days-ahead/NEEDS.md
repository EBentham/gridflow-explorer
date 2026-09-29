# NEEDS: elexon / availability-2-to-14-days-ahead

What the template, the rows endpoint and gridflow lack for this page, and how the page works
around each gap inside its folder.

## gridflow (backlog)

1. **The by-unit forecast keeps an issue chosen by file order.** `uou2t14d` holds one issue
   per unit and delivery day from each fetch, picked by the order of Elexon's files rather than
   by `published_at` (the P1 card: in bronze 2026-08-03, 6,006 of 6,468 keys kept neither the
   earliest nor the latest issue). The rows endpoint then keeps the newest held, which is not
   always the newest made. What the page does: says so in a caveat, and names the issue behind
   every figure (key, tables, side panel).

## Rows endpoint (backend)

2. **No way to read every issue of the by-fuel forecast.** `fou2t14d` is read from its
   latest-issue table only, so the page can't show how one delivery day's availability moved
   from issue to issue (the P1 card's working-panel sketch), which is the part a power-stack
   model most wants to see revised. Asked for: a way to read the base table for one delivery
   day, or the latest issue made at least N days ahead. What the page does: shows the latest
   issue held per day and names it.
3. **The default window ends on today, not on the newest issue.** The source list gives both
   datasets `latest_local_day` 29 Sep 2026 while the newest issue held was made on 22 Sep: the
   day comes from the delivery clock capped at today, though the P1 card's rule is
   `max(published_at)`. Not wrong for a window of delivery days, but a reader can't tell from the
   toolbar that the forecast is a week old. What the page does: the key names the newest issue
   held and the days it covers.

3a. **Rows naming no BM unit are deduplicated together.** The by-unit read keeps the newest
   issue per (`settlement_date`, `bm_unit_id`), so every row with no `bm_unit_id` on one day
   falls in one partition: two id-less units from different issues would keep only the newer.
   Today one such unit is listed (National Grid id `WTGRW-1`). Asked for: `national_grid_bm_unit`
   in the dedup key where `bm_unit_id` is null.

## Template

4. **The window can't run past the latest local day.** These forecasts run up to two weeks
   ahead, but the toolbar's windows end on the latest local day. What the page does: a toolbar
   control, "On to <last day>", sets the template's custom window from a week before the latest
   local day to the last delivery day held (the demand forecasts page asks the same).
5. **`SeriesChart` doesn't stack bars.** `mark: 'bars'` never takes a `stackId`, so the P1
   card's "stacked bars by fuel per delivery date" can't be drawn. What the page does: stacked
   areas with one point per delivery day, and the hint says the lines only join the days. A
   stacked-bars mark would suit every one-figure-a-day series better.
6. **The rows request can't trim columns.** The backend now takes `columns=`, but `RowsQuery`
   and `rowsPath` don't send it. The by-unit read carries `national_grid_bm_unit`,
   `timestamp_utc` and the rest for 475 units a day, about 6,650 rows for two weeks. Asked for:
   `columns` on `QuerySpec`/`RelatedSpec`, passed through `rowsPath`.
7. **Elexon's fuel codes have no shared map onto the design's bands.** This page copies the
   physical notifications page's map (`INT…` to interconnectors, OCGT, coal and oil to peaking)
   into `figures.ts`. One map in `design/fuels.ts` would keep every Elexon page alike.
8. **No neutral data token for an unknown category.** A fuel code the page doesn't know would
   be drawn in `--chart-tick`, as the physical notifications page does (its NEEDS item 9).
9. **A line held at zero all window gets a −1 to 1 axis.** `SeriesChart` scales a flat zero
   series around zero, so a unit forecast at 0 MW every day (`T_PEHE-1`, 23–29 Sep 2026) draws
   on an axis running below zero, which availability never does. The key says the unit held
   one figure every day. Asked for: a floor at zero when a panel's values never go below it.
10. **A stacked area can't draw a held day with no held neighbour.** `SeriesChart` draws a
    stack as `Area`s with no dots (`bandProps`), so a day needs a held day beside it to have any
    width. A window holding one delivery day (the 1-day preset), or a held day with a gap either
    side in a longer window, draws nothing. What the page does: for one day it puts a sentence in
    place of the chart; for a lone day in a longer window the hint says it has no band and where
    its figures are. Asked for: a dot or a one-step block for a stacked point with no held
    neighbour.
11. **Daily bars sit astride the day rule.** `SeriesChart` draws a point at its row time, and a
    daily row comes at the day's start, so a bar is split by the midnight rule and the first is
    half clipped. What the page does: its own rows put each day's point at the middle of the UK
    day. A day-centred mark for a daily step in the template would serve every daily page.
