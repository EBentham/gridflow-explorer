/**
 * The embedded-wind hatch, as on the historic generation mix page: wind's
 * colour crossed by 1.5px lines of the chart surface every 5px, so embedded
 * wind reads the same on both NESO pages. The main chart fills its band with
 * `url(#…)`; the tokens keep it right in both themes. Drawn once, in the main
 * panel, beside the chart that uses it.
 */
import { WIND_HATCH_ID } from './figures'

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
