# Explorer design loop — round log

Interactive loop with Bobbo (UI-design rule, 2026-09-25). Tried / kept / rejected per
round, so later rounds don't circle back. The lock output is `DESIGN.md`,
`src/design/tokens.css` and the Recharts theme module; this file is the history.

## Shared across every variant (method, not look)

- **Time:** a numeric x axis in epoch ms. Ticks land on Europe/London midnights (multi-day)
  or local 3-hour marks (single day). Labels are in UK clock time, and the tooltip names the
  half-hour window (`14:30–15:00 BST`). Settlement-period *numbers* appear only where the
  backend supplies them (forecast rows); dataset rows carry UTC only. Adding
  `settlement_date`/`settlement_period` to dataset rows is a plumbing handoff item, because
  gridflow owns SP semantics.
- **Units on every axis:** generation in GW (source MW ÷ 1000, display only), prices
  £/MWh, wind MW.
- **Fuel structure:** 9 display bands from 11 source series, fixed stack order bottom→top:
  nuclear · hydro · biomass · wind · gas · peaking (OCGT + coal + oil folded; coal and oil
  are ~0 in Jun–Sep 2026, OCGT averages 22 MW) · other · pumped storage · imports.
  The tooltip itemises the folded series. Negative values (pumping, net exports) stack
  below zero in their own stack. Colour is keyed by series key and follows the entity,
  never its index. Families separate by lightness as well as hue: gas and peaking share
  a warm hue two steps apart, and storage and trade sit in low-chroma neutrals.
- **Wind forecast:** synthetic fixture shaped exactly like `ForecastDayRecord` +
  `ForecastMetric`, badged "Fixture" in the UI.

## Round 1 — five directions (2026-09-25)

Divergence gates: light-first and dark-first both present; five nav topologies; at least
one direction uses no cards; no two directions share a type register. Seed roll
`3410aa5c` assigned grounded candidate 5 (Synoptic), which is built as variant A.

Grounded list (by resonance): 1 chart recorder · 2 control room wall · 3 settlement
ledger · 4 statistical print · 5 synoptic chart · 6 trading terminal · 7 substation
enamel signage. Wildcard from the roll: emission-line rail (challenger 4).

### A — Synoptic (Met Office surface-pressure chart)
- **Palette:** Restrained, light-first. Chart-paper blue-grey ground, navy ink, isobar
  grey-blue rules; fuels as map-legend fills.
- **Type:** Barlow Semi Condensed (cartographic condensed humanist), with Barlow for
  body text.
- **Layout:** left key panel, where nav and fuel legend share one map key. The chart gets
  full width; there is no card chrome.
- **Chart language:** flat fills with 2px paper gaps; the fan as contour lines, not washes.
- **Signature:** the quantile fan drawn as isobars, each contour labelled in-line with
  its quantile, like pressure values on a synoptic chart.
- **"Energy dashboard" default check:** no. Weather-chart notation isn't the category
  default.

### B — Control room (NESO control-room wall)
- **Palette:** Committed, dark-first. A deep mimic-panel slate (not black), panel greys,
  lamp colours reserved for state only.
- **Type:** Overpass (a Highway Gothic / DIN signage register), with Overpass Mono only
  for measured readouts.
- **Layout:** a top tab strip plus a persistent system strip; the content is panels on
  a wall grid.
- **Signature:** the system strip, a live readout of the last settled half-hour
  (generation, wind share, SSP) with a freshness lamp.
- **Default check:** at risk of look #2 (near-black + neon). Countered with a blue-slate
  ground, multiple lamp colours, no glow.

### C — Chart recorder (strip-chart paper)
- **Palette:** Restrained, light-first. White paper with a green graticule; pen inks in
  red, blue and black. No cream.
- **Type:** Archivo, narrow widths for data (technical grotesk).
- **Layout:** no cards. Full-bleed paper, with controls in the recorder's margin panel.
- **Signature:** the graticule *is* the time grid, with minor rules on half-hour
  multiples and major rules at London midnight, plus a pen-head marker on the latest
  reading.
- **Default check:** no.

### D — Settlement ledger (BMRS tables and DUKES statistical print)
- **Palette:** Restrained, light-first. Paper white, ink, one ledger-green accent.
- **Type:** Source Serif 4 with tabular lining figures (print statistical register).
- **Layout:** a left rail listing each dataset with its latest value; the chart sits
  over a ledger table, which doubles as the table-view twin.
- **Signature:** a day × half-hour heat strip that acts as navigation.
- **Default check:** at risk of broadsheet look #3. Countered by avoiding hairline
  column rules and italic display, and by making the heat strip the hero.

### E — Emission lines (roll challenger 4, fused)
- **Palette:** dark-first. A charcoal continuum with bone text; colour appears only as
  hairline lines.
- **Type:** Host Grotesk at one size, ranked by weight and ink.
- **Layout:** an off-centre vertical rail for navigation.
- **Signature:** state as line form. Solid means live data, dashed means fixture, and
  half-height means stale.
- **Default check:** charcoal risks look #2. Countered because colour is spectral and
  multi-line, never one accent.

Rejected before build: oscilloscope (it is the current explorer's look #2), Game Boy /
calendar / streetwear / iridescent cloud (fail Operate or fail product truth).
