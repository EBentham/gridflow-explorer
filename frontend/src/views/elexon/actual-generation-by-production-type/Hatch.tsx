/**
 * The two hatches the page's charts fill with: wind's colour for offshore
 * wind and peaking's for oil, each crossed by 1.5px lines of the chart
 * surface every 5px, as the ENTSO-E and NESO pages mark a second kind of
 * wind. Drawn once beside each chart that uses them; the tokens keep them
 * right in both themes.
 */
import { HATCH } from './types'

function Pattern({ id, token }: { id: string; token: string }) {
  return (
    <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <rect width="5" height="5" style={{ fill: `var(${token})` }} />
      <line x1="0" y1="0" x2="0" y2="5" style={{ stroke: 'var(--chart-surface)', strokeWidth: 1.5 }} />
    </pattern>
  )
}

export function Hatch() {
  return (
    <svg className="gf-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <Pattern id={HATCH.wind} token="--fuel-wind" />
        <Pattern id={HATCH.peaking} token="--fuel-peaking" />
      </defs>
    </svg>
  )
}
