/**
 * The offshore-wind hatch: wind's colour crossed by 1.5px lines of the chart
 * surface every 5px, as the historic generation mix page marks a second kind
 * of wind, so offshore keeps wind's colour and still reads apart from the
 * onshore band under it. Drawn once beside the chart that fills a band with
 * it; the tokens keep it right in both themes.
 */
import { OFFSHORE_HATCH_ID } from './figures'

export function WindHatch() {
  return (
    <svg className="gf-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={OFFSHORE_HATCH_ID} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width="5" height="5" style={{ fill: 'var(--fuel-wind)' }} />
          <line x1="0" y1="0" x2="0" y2="5" style={{ stroke: 'var(--chart-surface)', strokeWidth: 1.5 }} />
        </pattern>
      </defs>
    </svg>
  )
}
