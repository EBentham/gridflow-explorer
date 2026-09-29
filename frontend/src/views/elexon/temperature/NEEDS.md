# Temperature: what the template and the research lack

1. **No way to say where a unit comes from.** The source list gives `temp` the unit `degC`,
   and the page prints it as °C. That unit comes from gridflow's notes on the dataset; gridflow's
   schema (`schemas/elexon.py`) names none, and Elexon's own description of TEMP isn't held.
   The page says so in one caveat.
   - Asked for: a `unitConfirmed: false` flag (on the source list's value, or on `ValueSpec`)
     that keeps the label and lets the template caption it, so pages don't each write it.
   - Research asked for: a primary source (Elexon's TEMP description) for the unit.
2. **Daily markers sit on the day rules.** A `DATE` row arrives at UTC midnight, so each
   day's marker is drawn at 00:00 or 01:00 UK time, on its day's left rule, not across its
   day, and a one-day window shows it as a dot at 01:00 BST on a clock axis; the main
   panel's source line says it is drawn at midnight UTC (01:00 BST). `elexon/demand-outturn` asks the
   same for daily bars. Asked for: day-grain rows drawn
   at the middle of their UK day, or a band from midnight to midnight.
3. **No reference temperatures held.** gridflow's schema and notes list normal, low and high
   reference temperatures for `temp`, but gridflow's cleaned table keeps `temperature` only,
   so the page can't draw the seasonal normal the reader would compare against. The page
   says so in a caveat. Asked for: keep those columns in gridflow, or confirm Elexon no
   longer publishes them.
4. **The chart's extreme labels name one day and can sit on the time axis.** `extremesOf`
   keeps the first of a tie (16.0 on both Fri 18 and Mon 21 Sep labels Fri 18 only), and a
   lowest value that is also the axis floor puts its label over the day ticks. The page turns
   the chart's labels off (`extremes: false`); its key names the warmest and coolest days,
   every day of a tie included.
