# Indicated demand and generation: what the template and the endpoint lack

- **No way to turn a column's sign for display.** `inddem` holds demand as a negative
  figure, and the card asks for it drawn with its sign flipped and labelled. `ValueSpec`
  has no sign or scale option, so the template's chart, key, days table and table would
  all show it negative. What the page does instead: its own main, key and working panels
  build the pair from `ctx.series` and `ctx.related`, turn demand's sign in one place
  (`figures.ts`, `pairOf`), and name it "sign flipped" wherever it is drawn; the table
  gives the figure as held and flipped side by side. A `ValueSpec.negate` (display only,
  with the template adding "sign flipped" to the label) would let the defaults do it.
- **A related dataset can't follow the page's own parameters.** The boundary is a page
  parameter (`?boundary=`), but `RelatedSpec.query` is fixed. What the page does instead:
  reads the other dataset split by boundary with no filter (18 series, 18 times the rows of
  one boundary: about 6,000 rows for 7 days, 26,000 for 30), and picks the page's boundary
  from it. A `query` function on `RelatedSpec`, like the dataset's own, would cut that read
  to one boundary. A custom window longer than about 57 days would push that read past the
  row cap and come back as means; the page then draws the page's own dataset alone and
  says why.
- **No overlay of a related series in the main panel.** The pair is the point of the page,
  but the template draws a related dataset only in the lower panel. What the page does
  instead: a main body of its own that draws both on one axis with `SeriesChart`.
- **The table view has no issue time per row.** Which issue a half-hour's figure comes
  from is what says what it is, and the template's table leaves `published_at` out. What
  the page does instead: its own table, with the issue and how far ahead it was made.
- **Unconfirmed meaning (for the gridflow backlog, not the template).** What indicated
  demand and indicated generation count, what area each of B1 to B17 bounds, and what the
  gap between the two figures stands for aren't set out in the rows held or in gridflow's
  description of them. Generation plus demand as held is not `imbalngc`'s indicated
  imbalance at any of 96 half-hours on 18 and 19 Sep 2026 (checked 29 Sep 2026). The page
  says the gap is not the indicated imbalance and draws no difference line.
- **Vintage (for the gridflow backlog).** gridflow keeps only the earliest issue from each
  day's fetch of both datasets, so the page can't show the issue made closest to each
  half-hour. It is bronze-checked for `inddem` only; `indgen` is expected to match.
- **Both figures step down at 23:00 BST inside every issue (for the gridflow backlog, with
  the vintage item).** At boundary N, in every issue held (1 to 6 Aug and 13 to 23 Sep 2026,
  the two 10:47 UTC issues included; checked 29 Sep 2026), demand and generation step down
  at 23:00 BST on the last evening the issue covers, by different amounts on different
  nights: demand by 1.2 to 6.3 GW, generation by 0.6 to 9.7 GW. They stay down to the end of
  that issue's figures and step back up only where a newer issue takes over, usually at
  01:30 BST (05:00 BST on 22 Sep; not at all on 23 Sep, where the rows end). So the fall
  follows the clock and the recovery follows the issue. Whether later issues, which gridflow
  doesn't keep, revise these half-hours, and why the figures step down, isn't known here.
  What the page does instead: a caveat states what the rows show, names no cause, and warns
  that the key's latest and lowest figures and the days' ranges can fall in these half-hours.
