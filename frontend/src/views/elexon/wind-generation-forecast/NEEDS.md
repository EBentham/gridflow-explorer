# Wind generation forecast: what the template and the endpoint lack

- **No choice of forecast issue.** The rows endpoint keeps one issue per hour, the one with
  the latest issue time. Each `windfor` issue also gives figures for about a day before it
  was made, so for most past hours that latest issue was made after the hour: the page
  can't show what was forecast ahead of time, and the card's sketch (the latest line with
  a fan of earlier issues) can't be drawn. Same gap as demand forecasts item 1. The page
  needs a way to ask for another issue, e.g. the latest issued at least N hours before the
  hour, or every issue for a window. What the page does instead: reads each row's issue
  time, counts in the key the hours issued before and after them, charts each hour's lead
  in the working panel, and splits metered less forecast the same way.
- **Lead-time helpers are copied.** `leadText` and the issue-time reading in `figures.ts`
  repeat demand forecasts' `figures.ts`, as a page may not import another family's folder.
  A template module (say `_template/issues.ts`) holding the lead text and an issue summary
  would keep the forecast pages alike.
- **No overlay of a related series in the main panel.** Metered output can't share the
  main chart's axis with the forecast, so the working panel draws both on one axis, with
  the difference and the lead as bars under them.
- **A unit the template doesn't know.** The lead chart's hours are set out as a
  `DisplayUnit` in `figures.ts` (`LEAD_UNIT`); `units.ts` has no `h`. A signed-hours unit in
  the template would cover every lead chart.
- **Hourly stamps named as hour-long periods.** The rows carry Elexon's start time on the
  hour, and the template names each as `Tue 22 Sep, 14:00–15:00 BST`. Whether Elexon's
  figure is for that hour or the instant at its start is unconfirmed; the page pairs it
  with the two metered half-hours from its stamp and says so. Confirm the convention for
  `WINDFOR`; if it is an instant, the template should name it as one and the pairing
  should centre on it.
- **The table view has no issue time per row.** The template's hourly table lists the
  period and the value, but not `published_at`, which is what says which issue a row is.
  What the page does instead: the working panel's days table names each issue drawn per
  day and whether its hours were issued before or after them.
