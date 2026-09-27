/**
 * The embedded-wind hatch: wind's colour crossed by 1.5px lines of the chart
 * surface every 5px, at 45° the other way from the highlight band's hatch, so
 * a selected period can't be mistaken for it. Charts on the page fill the
 * embedded band with `url(#…)` (`fuels.ts`), as the dark theme's `--band`
 * points at the shell's band hatch. Drawn once in the main panel, beside the
 * chart; the tokens keep it right in both themes.
 */
import { WIND_HATCH_ID } from './fuels'

export function WindHatch() {
  return (
    <svg className="gf-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={WIND_HATCH_ID} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width="5" height="5" style={{ fill: 'var(--fuel-wind)' }} />
          <line x1="0" y1="0" x2="0" y2="5" style={{ stroke: 'var(--chart-surface)', strokeWidth: 1.5 }} />
        </pattern>
      </defs>
    </svg>
  )
}
