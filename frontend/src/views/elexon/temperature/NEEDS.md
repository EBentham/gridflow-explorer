# Temperature: what the template and the research lack

1. **No way to mark a recognised unit as doubtful.** The source list gives `temp` the unit
   `degC`, which `units.ts` recognises, so a plain config would print `°C` on the axis, the
   tooltips, the table and About. That unit comes from gridflow's notes alone: the rows carry
   none, and gridflow's schema for the dataset (`schemas/elexon.py`) states none. The page
   must not assert it. What the page does instead: its `values[].unit` is the string
   `unit unconfirmed`, which `units.ts` doesn't recognise, so every template part prints
   "as published, unit unconfirmed". `define.ts` meant that field for settling a null unit,
   not for unsettling a known one.
   - Asked for: a `unitConfirmed: false` flag on a manifest value (or on `ValueSpec`) that
     keeps the label but captions it "°C, unit unconfirmed", or the backend nulling a unit
     whose only source is the vault.
   - Research asked for: a primary source (Elexon's TEMP description) for the unit, so the
     page can name it.
2. **Unconfirmed units print with `autoDigits`.** With no unit rule the template's tooltip,
   extreme labels and table give `16.0` but would give `4.50` or `−1.20` below 10, while
   the rows hold one decimal. The page's own key and day table print one decimal
   (`tempText`). Asked for: a `digits` field on `ValueSpec`.
3. **Daily markers sit on the day rules.** A `DATE` row arrives at UTC midnight, so each
   day's marker is drawn at 00:00 or 01:00 UK time, on its day's left rule, not across its
   day. `elexon/demand-outturn` asks the same for daily bars. Asked for: day-grain rows drawn
   at the middle of their UK day, or a band from midnight to midnight.
4. **No reference temperatures held.** gridflow's schema and notes list normal, low and high
   reference temperatures for `temp`, but gridflow's cleaned table keeps `temperature` only,
   so the page can't draw the seasonal normal the reader would compare against. The page
   says so in a caveat. Asked for: keep those columns in gridflow, or confirm Elexon no
   longer publishes them.
5. **The chart's extreme labels name one day and can sit on the time axis.** `extremesOf`
   keeps the first of a tie (16.0 on both Fri 18 and Mon 21 Sep labels Fri 18 only), and a
   lowest value that is also the axis floor puts its label over the day ticks. The page turns
   the chart's labels off (`extremes: false`); its key names the warmest and coolest days,
   every day of a tie included.
