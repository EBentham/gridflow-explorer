/**
 * The working panel of the net positions: each UK day of the window for the
 * selected zone (or the first), its quarter-hours held of those the day
 * holds, how many named the zone as the in area and as the out area, and
 * the mean on each side. The sides are never netted: the sign is
 * unconfirmed. Select a day to mark it on the chart.
 */
import { plural } from '../../../design/format'
import { dayLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { heldDayStarts, sideDays } from './figures'
import { focusedZone, zonesOf } from './model'
import { stepWords } from './words'

export function ZoneDays({ ctx }: { ctx: PageContext }) {
  const w = ctx.window
  const zones = zonesOf(ctx)
  const z = focusedZone(ctx, zones)
  if (!w || !z) return <p className="gf-hint">No zone holds a net position in this window, so there are no days to summarise.</p>
  const line = z.inSide ?? z.outSide
  const step = z.inSide?.step ?? z.outSide?.step ?? null
  const unit = line?.def.unit
  const days = sideDays(z.inSide?.points ?? [], z.outSide?.points ?? [], step, w)
  const mean = (v: number | null) => (v === null || !unit ? '–' : unit.plain(v))
  const both = days.some((d) => d.both > 0)
  const anyHeld = heldDayStarts(zones.flatMap((x) => [x.inSide?.points ?? [], x.outSide?.points ?? []]))

  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                As in area
              </th>
              <th scope="col" className="is-num">
                As out area
              </th>
              <th scope="col" className="is-num">
                Mean as in area, {unit?.label ?? 'unit unconfirmed'}
              </th>
              <th scope="col" className="is-num">
                Mean as out area, {unit?.label ?? 'unit unconfirmed'}
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={4}>{anyHeld.has(d.start) ? 'none held for this zone' : 'not held locally'}</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.expected === null || !partial ? d.held : `${d.held} of ${d.expected}`}</td>
                  <td className="is-num">{d.inSide.toLocaleString('en-GB')}</td>
                  <td className="is-num">{d.outSide.toLocaleString('en-GB')}</td>
                  <td className="is-num">{mean(d.inMean)}</td>
                  <td className="is-num">{mean(d.outMean)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        {z.name}: held counts the {stepWords(step)} with a value on either side, of those the day holds; a day held in part is set in bold. Each side’s mean is of its own {stepWords(step)}, and the two aren’t netted, as the sign is unconfirmed.
        {both ? ` Some ${stepWords(step)} name the zone on both sides at once; they count on each.` : ''}
        {ctx.mode === 'chart' ? ' Select a day to mark it on the chart.' : ' Select a day to mark it.'}
        {zones.length > 1 ? ' Select a zone in the key to read another.' : ''}
      </p>
    </>
  )
}
