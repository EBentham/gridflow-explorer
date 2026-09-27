/**
 * The working panel. In the Chart view, the shape of the benchmark through
 * the day: at each UK clock time, the window's mean price, and the band from
 * its lowest to its highest (`ProfileChart`), with a picked day drawn over
 * them. Then each UK day: the half-hours held, the price's mean, lowest and
 * highest, and the volume summed over the half-hours held. Select a day to
 * mark it on the main chart and draw it on the clock-time chart.
 */
import { CHART } from '../../../design/chartTheme'
import { plural } from '../../../design/format'
import { dayLabel, stepNoun } from '../../../design/time'
import { daySummaries } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { PRICE, RANGE_OPACITY, VOLUME, profileOf, seriesOf, slotText, volumeByDay } from './figures'
import { ProfileChart } from './ProfileChart'

const DAY_COLOR = 'var(--chart-price-2)'

export function ProfilePanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const price = seriesOf(model, PRICE)
  const volume = seriesOf(model, VOLUME)
  if (!model || !ctx.window || !price || !price.count) {
    return <p className="gf-hint">No benchmark price is held in this window, so there is no shape to draw or day to summarise.</p>
  }
  const days = daySummaries(model, ctx.window, price)
  const heldDays = days.filter((d) => d.held > 0).length
  const summed = !model.bucketed && volume !== undefined
  const sums = volume ? volumeByDay(model, ctx.window, volume) : new Map<number, { sum: number | null; held: number }>()
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const fmt = (x: { v: number } | null) => (x ? price.unit.plain(x.v) : '–')
  const profile = ctx.mode === 'chart' ? profileOf(model, price, ctx.picked) : null
  const pickedLabel = ctx.picked !== undefined && days.some((d) => d.start === ctx.picked && d.held > 0) ? dayLabel(ctx.picked) : null
  const step = model.stepMs
  const longDay = step !== null && days.some((d) => d.expected !== null && d.expected * step > 24 * 3600e3)
  const held = profile?.slots.filter((s) => s.n > 0) ?? []
  const peak = held.reduce<(typeof held)[number] | null>((a, s) => (a === null || (s.mean ?? 0) > (a.mean ?? 0) ? s : a), null)
  const trough = held.reduce<(typeof held)[number] | null>((a, s) => (a === null || (s.mean ?? 0) < (a.mean ?? 0) ? s : a), null)

  return (
    <>
      {ctx.mode === 'chart' && profile && heldDays > 1 && (
        <>
          {/* The shared KeyList has no mark for a single pale band, so this key draws its own, in the same list. */}
          <ul className="gf-key">
            <li>
              <svg width="22" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="22" y2="5" stroke={price.color} strokeWidth="2" strokeDasharray={ctx.fixture ? CHART.fixtureDash : undefined} />
              </svg>
              Mean at each clock time, {price.unit.label ?? 'unit unconfirmed'}
            </li>
            <li>
              <svg width="22" height="12" aria-hidden="true">
                <rect x="0" y="0" width="22" height="12" fill="var(--chart-fan)" fillOpacity={RANGE_OPACITY} />
              </svg>
              Lowest to highest at that time
            </li>
            {pickedLabel && (
              <li>
                <svg width="22" height="10" aria-hidden="true">
                  <line x1="0" y1="5" x2="22" y2="5" stroke={DAY_COLOR} strokeWidth="2" strokeDasharray={ctx.fixture ? CHART.fixtureDash : undefined} />
                </svg>
                {pickedLabel}, the day selected
              </li>
            )}
          </ul>
          <ProfileChart
            slots={profile.slots}
            stepMin={profile.stepMin}
            price={price}
            dayColor={DAY_COLOR}
            pickedLabel={pickedLabel}
            bucketed={model.bucketed}
            fixture={ctx.fixture}
          />
          <p className="gf-hint">
            Each clock time gathers the {noun} held at it across {plural(heldDays, 'day', 'days')}, so a day held in part adds to some times only.
            {peak && trough && peak.mean !== null && trough.mean !== null && peak !== trough
              ? ` In this window the mean is highest at ${slotText(peak.minute, profile.stepMin)} and lowest at ${slotText(trough.minute, profile.stepMin)}, on the UK clock.`
              : ''}
            {longDay ? ` On the clock-change day in this window, the repeated hour adds two ${noun} to its clock times.` : ''}
          </p>
        </>
      )}
      {ctx.mode === 'chart' && !profile && (
        <p className="gf-hint">The window is read as {noun}, which don’t fall on single clock times, so there is no shape through the day to draw. Choose a shorter window to see it.</p>
      )}
      {ctx.mode === 'chart' && profile && heldDays <= 1 && (
        <p className="gf-hint">Only one day in this window holds a price: the main chart shows its shape. Choose a longer window to see the shape across days.</p>
      )}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Mean, {price.unit.label}
              </th>
              <th scope="col" className="is-num">
                Lowest
              </th>
              <th scope="col" className="is-num">
                Highest
              </th>
              {summed && volume && (
                <th scope="col" className="is-num">
                  Volume, {volume.unit.label}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const v = sums.get(d.start)
              if (d.held === 0 && !v?.held) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={summed ? 4 : 3}>not held locally</td>
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
                  <td className="is-num">{d.mean === null ? '–' : price.unit.plain(d.mean)}</td>
                  <td className="is-num">{fmt(d.low)}</td>
                  <td className="is-num">{fmt(d.high)}</td>
                  {summed && volume && <td className="is-num">{v?.sum === null || v === undefined ? '–' : volume.unit.plain(v.sum)}</td>}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Held counts the {noun} with a price.{' '}
        {summed ? `Volume sums the ${noun} held, so a day held in part sums in part.` : 'The window is read as means, so volume per day is not summed.'} The mean price counts each {noun.replace(/s$/, '')} once.
        {ctx.mode !== 'chart' ? ' Select a day to mark it.' : profile && heldDays > 1 ? ' Select a day to mark it on the main chart and draw it on the clock-time chart.' : ' Select a day to mark it on the main chart.'}
      </p>
    </>
  )
}
