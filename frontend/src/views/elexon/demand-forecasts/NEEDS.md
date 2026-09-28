# Demand forecasts: what the template and the endpoint lack

- **No choice of forecast issue.** The rows endpoint keeps one issue per period, the one
  with the latest issue time. For `ndf`, which holds every issue, that is mostly the issue
  made minutes before the half-hour, so the page can't show the day-ahead forecast its
  type names, or how the forecast changed as the half-hour came closer. For `tsdf` it is
  the first issue of the latest day fetched (gridflow keeps only each day's first issue).
  The page needs a way to ask for another issue, e.g. the latest issued at least N hours
  ahead, or every issue for one period. What the page does instead: reads each row's issue
  time, says in the key how far ahead the drawn forecasts were issued, and says which issue
  is shown in the caveats.
- **The window can't run past the latest local day.** The daily forecasts (`ndfd`,
  `tsdfd`) run up to two weeks past today, but the toolbar's windows end on the latest
  local day. What the page does instead: a toolbar control, "On to <last day>", sets the
  template's custom window from a week before the latest local day to the last delivery
  day held.
- **No overlay of a related series in the main panel.** As on the demand outturn page,
  outturn can't share the main chart's axis with the forecast. The working panel draws the
  forecast and its outturn on one axis, with the miss as bars under them.
- **A related dataset can't follow the page's own parameters.** `tsdf`'s boundary is a
  page parameter, but the related transmission demand outturn is read whatever the
  boundary, though only boundary N is set against it. The page reads it anyway and says
  that other boundaries have no outturn to compare.
