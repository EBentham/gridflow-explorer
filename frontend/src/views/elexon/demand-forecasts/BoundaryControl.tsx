/**
 * The transmission forecast’s boundary, after Chart | Table: N, national,
 * by default, or one of B1 to B17, written as `?boundary=`. The
 * boundaries are named by their codes alone: the rows don't say what area
 * each one bounds.
 */
import type { PageContext } from '../../define'
import { BOUNDARIES, BOUNDARY_PARAM, NATIONAL_BOUNDARY, boundaryOf } from './figures'

export function BoundaryControl({ ctx }: { ctx: PageContext }) {
  const value = boundaryOf(ctx)
  return (
    <label className="gf-range-custom">
      <span>Boundary</span>
      <select className="gf-select" value={value} onChange={(e) => ctx.setParam(BOUNDARY_PARAM, e.target.value === NATIONAL_BOUNDARY ? null : e.target.value)}>
        {BOUNDARIES.map((b) => (
          <option key={b} value={b}>
            {b === NATIONAL_BOUNDARY ? 'N, national' : b}
          </option>
        ))}
      </select>
    </label>
  )
}
