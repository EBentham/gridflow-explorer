/**
 * Words for what a stack can't draw. Each fuel is a band between neighbouring
 * delivery days, so a window holding one day, or a held day with no held day
 * either side, has nothing to draw as a band (NEEDS.md): the panel says so and
 * points to where the day's figures are, rather than leave an empty plot
 * (`loneWords` in `figures.ts` covers the lone days of a longer window).
 */
import { fmtDay } from '../../../design/time'
import type { Day } from './figures'

export function OneDayWords({ day, where }: { day: Day | undefined; where: string }) {
  return (
    <p className="gf-state">
      This window holds one delivery day{day ? `, ${fmtDay(day.date)}` : ''}. The chart draws each fuel as a band from one day to the next, so a single day has no band to draw. The key gives its figures fuel by fuel, and {where} and the Table view list them; a window of 7 days or more draws the days as bands.
    </p>
  )
}
