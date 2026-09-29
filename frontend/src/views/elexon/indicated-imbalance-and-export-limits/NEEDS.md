# Indicated imbalance and margin: what the template, the endpoint and gridflow lack

- **The table view has no issue time per row.** Which issue a half-hour's figure comes from
  is what says what it is, and the template's table leaves `published_at` out (the same item
  as `elexon/indicated-demand-and-generation/NEEDS.md`). What the page does instead: its own
  table, with the issue behind each figure and how far ahead it was made.
- **No second dataset in the main panel's chart.** The imbalance and the margin are the pair
  the page is for, but the template draws a related dataset only in its lower panel, and
  both need an axis of their own (the imbalance runs either side of zero, the margin tens of
  GW above it). What the page does instead: a main body of its own that draws the page's own
  dataset on top and the other below it with `SeriesChart`, on one clock and one axis width.
- **Sign and meaning of the imbalance (for the gridflow backlog).** Only gridflow's own
  description of the rows (the `ElexonImbalNGC` schema) says a figure below zero is the
  system short and above zero long; Elexon's definition isn't held here. The research note
  describes the imbalance as generation minus demand, but Elexon's indicated generation plus
  indicated demand (held negative) at boundary N matches it at none of the 782 half-hours held
  for all three (checked 29 Sep 2026). The page gives the sign reading as gridflow's, says
  Elexon's own isn't held, and says the imbalance is not generation plus demand.
- **Meaning of the margin (for the gridflow backlog).** gridflow's schema describes it as
  available generation less demand, in MW; Elexon's definition isn't held here. The page
  gives it as gridflow's description.
- **Unit of the imbalance (for the gridflow backlog).** gridflow's schema, the source list and
  the research card give MW; the vault note's column table gives MWh. The page uses the source
  list's MW. Worth settling against Elexon's documentation.
- **Boundary and vintage (for the gridflow backlog).** gridflow's copy of both datasets drops
  the boundary column and keeps one row per half-hour per day fetched: the last in file
  order, which was N's at every half-hour, and the first issue of that day to cover the
  half-hour. Checked against the files fetched for both datasets on all 14 days held (1 to 5
  Aug and 13 to 21 Sep 2026; 47 issues and 18 boundaries in each day's files). The page says
  so, shows boundary N only, and can't offer B1 to B17 or a later issue until gridflow keeps
  the boundary and sorts by issue time before it deduplicates.
- **The figures move at 23:00 BST inside every issue (for the gridflow backlog, with the
  vintage item).** At 23:00 BST on all 16 nights held, the imbalance moves by 1.5 to 7.1 GW
  within the same issue (median half-hour move within an issue: 0.4 GW); the margin by 1.3 to
  5.8 GW on 12 nights and 0.6 GW or less on 4. Both move again where a newer issue takes over
  (imbalance 0.1 to 10.1 GW, margin 0.6 to 7.0 GW over 14 takeovers). The indicated demand and
  generation page sees the same 23:00 step. Whether later issues, which gridflow doesn't
  keep, revise these half-hours, and why the figures move, isn't known here. The page states
  what the rows show and names no cause.
- **The family's label (for the catalogue).** The source list calls the family "Indicated
  imbalance and export limits", but its second dataset, `melngc`, is Elexon's indicated
  margin (the endpoint, gridflow's schema and the vault all say so). The page's title is
  "Indicated imbalance and margin" and a caveat says the source list's name differs. The
  route keeps the source list's slug.
