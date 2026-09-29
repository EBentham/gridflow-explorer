# Loss of load probability and de-rated margin: what the template, the endpoint and gridflow lack

- **No display rule for a probability.** The source list gives `loss_of_load_probability`
  the unit "dimensionless (0-1)", which `_template/units.ts` doesn't know, so the template
  would print it as "unit unconfirmed" and, through `autoDigits`, round small means towards
  zero. What the page does instead: reads the probability from the rows as held, prints it
  to seven decimal places at least (`figures.ts`, `lolpText`) with a "4.1 in a million"
  gloss, and draws it per million on its own axis. A `probability` rule in `units.ts`
  would let the defaults do it. The template's About panel still lists the probability as
  "unit unconfirmed", while the key says it runs from 0 to 1 as the source list and gridflow
  describe it; the same rule would settle both.
- **A tall chart panel that isn't the lowest loses its zero tick.** In `SeriesChart`, the
  margin's 0 went unlabelled when its 300px panel sat above the probability's (seen in the
  screenshot; likely the 2px bottom margin with Recharts' tick thinning, which panels under
  200px turn off). What the
  page does instead: draws the probability (a short panel, which shows every tick) on top and
  the margin, which carries the clock, below it.
- **The table view has no issue time per row.** The template's table leaves `published_at`
  out, and which issue a half-hour's figures come from is what says what they are (the same
  item as the two indicated pages' NEEDS). What the page does instead: its own table, with
  the issue behind each half-hour and how far ahead it was made.
- **Vintage (for the gridflow backlog).** Elexon issues these figures every half-hour, each
  issue reaching from under an hour to 17 to 40 hours ahead. gridflow's transformer
  (`silver/elexon/lolpdrm.py`) reads a day's two 12-hour files in file-name order, whose hash
  part isn't time order, and keeps the last row per half-hour without sorting by
  `published_at`; the files are newest first, so it keeps the earliest issue of whichever
  file is read last. The Explorer's read then keeps, across days fetched, the newest of those.
  Reproduced from the files for all 14 days fetched at every one of the 780 half-hours
  held (checked 29 Sep 2026): the half-hour shows the last issue fetched for it at only 26.
  The page says so and names each figure's issue. Fix: sort by `published_at` before the
  `unique`, or keep every issue and let the read choose.
- **The issue's own period is dropped (for the gridflow backlog).** Elexon's rows carry
  `publishingPeriodCommencingTime`, the half-hour an issue was made for; gridflow keeps
  `published_at` only. The page reads the issue from its publish time.
- **Is a 0 a zero? (for the gridflow backlog).** Elexon's files write the probability to nine
  decimal places, and every value above zero in them is a whole number of 0.0000001 (largest
  0.0000165). Whether a 0 is a true zero or a value rounded below that step isn't known here.
  The page says the rows don't say.
- **Meanings (for the gridflow backlog).** Only gridflow's schema (`ElexonLOLPDRM`) describes
  the columns: a unitless probability in [0, 1], and the system margin in MW after de-rating
  capacity for unavailability risk. Elexon's own definitions, and what area the figures
  cover, aren't held here. The page gives both as gridflow's description.
- **Stale source-list note.** The source list's note says the probability is 0.0 on all 510
  rows; on 29 Sep 2026 it is above zero at 12 of the 780 half-hours held. The page doesn't
  repeat the note.
