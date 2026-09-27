# Demand outturn: what the template lacks

- **Daily bars sit on the day rules.** The daily figure (`indod`) is one value per UK day,
  stamped at London midnight. `SeriesChart` draws a bar at its timestamp, so each bar
  straddles the midnight day rule instead of filling its own day, and reads as a thin
  stroke on the grid line. The page needs a way to draw a day-grain bar across its day
  (centred on noon, or a band from midnight to midnight). What the page does instead:
  draws the bars as they fall, and lists each day's figure in the working panel.
- **No overlay of a related series in the main panel.** `planPanels` puts only the page's
  own series in the main panel, so transmission demand (`itsdo`, read as a related
  dataset) can only go in a lower panel, not on the same axis as national demand. The page
  draws it in the lower panel and draws the gap between the two in the working panel.
