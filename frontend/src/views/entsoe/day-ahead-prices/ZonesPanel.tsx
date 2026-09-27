/**
 * The working panel. First the zones side by side over the window: how
 * often each is priced, the steps held of those its clock has, the mean,
 * lowest and highest (and when), and how many went below zero. In the Chart
 * view, then, each zone's mean at each UK clock time (`ProfileChart`), with
 * the selected zone's range and the picked day drawn over it. Last, each UK
 * day's mean per zone; a zone held for part of a day says how much. Select a
 * day to mark it on the charts. Every figure is on the zone's own clock and
 * counts each step once: the rows carry no volume to weight by.
 */
import { plural } from '../../../design/format'
import { clock, dayLabel, dayTick, londonMidnight } from '../../../design/time'
import { seriesId } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { RANGE_OPACITY, perStep, slotText, zoneDays, zoneFigures, zoneNoun, zoneProfile, type ZoneFigures } from './figures'
import { ProfileChart, type ProfileLine } from './ProfileChart'

const DAY_COLOR = 'var(--chart-actual)'

const dash = <span className="gf-cell-missing">–</span>

function Swatch({ color }: { color: string }) {
  return (
    <svg width="18" height="10" aria-hidden="true" style={{ marginRight: 7, verticalAlign: 'middle' }}>
      <line x1="0" y1="5" x2="18" y2="5" stroke={color} strokeWidth="2" />
    </svg>
  )
}

export function ZonesPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  if (!model || !window) return <p className="gf-hint">No price is held in this window, so there are no zones to compare or days to summarise.</p>
  const zones = zoneFigures(model, window)
  const held = zones.filter((z) => z.points.length > 0)
  if (!held.length) return <p className="gf-hint">No price is held in this window, so there are no zones to compare or days to summarise.</p>
  const unit = held[0].def?.unit
  const plain = (v: number) => (unit ? unit.plain(v) : String(v))
  const at = (t: number) => `${dayTick(t)}, ${clock(t)}`
  const focus = held.find((z) => z.def && seriesId(z.def) === ctx.focus)
  const perZone = zones.map((z) => ({ z, days: zoneDays(z, window, model.bucketed) }))
  const dayCount = perZone[0]?.days.length ?? 0

  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Zone</th>
              <th scope="col">Priced</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                Mean, {unit?.label ?? 'unit unconfirmed'}
              </th>
              <th scope="col" className="is-num">
                Lowest
              </th>
              <th scope="col">When</th>
              <th scope="col" className="is-num">
                Highest
              </th>
              <th scope="col">When</th>
              <th scope="col" className="is-num">
                Below zero
              </th>
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <ZoneRow key={z.value} z={z} on={z === focus} bucketed={model.bucketed} plain={plain} at={at} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Held counts the steps with a price, of those the zone’s clock has in the {plural(dayCount, 'UK day', 'UK days')} of the window. The mean counts each step once; the rows carry no volume to weight it by.
      </p>

      {ctx.mode === 'chart' && <Profile ctx={ctx} zones={held} focus={focus ?? null} bucketed={model.bucketed} />}

      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {zones.map((z) => (
                <th key={z.value} scope="col" className="is-num">
                  {z.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perZone[0]?.days.map((d, i) => {
              const cells = perZone.map(({ z, days }) => ({ z, zd: days[i] }))
              if (cells.every((c) => c.zd.held === 0)) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td colSpan={zones.length}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              return (
                <tr key={d.day} className={on ? 'is-on' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  {cells.map(({ z, zd }) => (
                    <td key={z.value} className="is-num">
                      {zd.mean === null ? dash : plain(zd.mean)}
                      {zd.held > 0 && zd.expected !== null && zd.held < zd.expected ? ` (${zd.held} of ${zd.expected})` : ''}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Each zone’s mean price over the UK day, in {unit?.label ?? 'the unit as published'}. A zone held for part of a day gives its steps held of those in the day in brackets; a dash is a day it holds nothing of.
        {dayCount > 8 ? ' Oldest first: scroll the table for the rest.' : ''}
        {ctx.mode === 'chart' ? ' Select a day to mark it on the charts.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}

function ZoneRow({ z, on, bucketed, plain, at }: { z: ZoneFigures; on: boolean; bucketed: boolean; plain: (v: number) => string; at: (t: number) => string }) {
  if (!z.points.length) {
    return (
      <tr className="is-missing">
        <th scope="row">
          <Swatch color={z.color} />
          {z.label}
        </th>
        <td>{perStep(z.step)}</td>
        <td className="is-num">{z.expected === null ? '0' : `0 of ${z.expected.toLocaleString('en-GB')}`}</td>
        <td colSpan={6}>none held in this window</td>
      </tr>
    )
  }
  const partial = z.expected !== null && z.points.length < z.expected
  return (
    <tr className={on ? 'is-on' : undefined}>
      <th scope="row">
        <Swatch color={z.color} />
        {z.label}
      </th>
      <td>{bucketed ? zoneNoun(z, bucketed) : perStep(z.step)}</td>
      <td className="is-num">{partial ? `${z.points.length.toLocaleString('en-GB')} of ${(z.expected as number).toLocaleString('en-GB')}` : z.points.length.toLocaleString('en-GB')}</td>
      <td className="is-num">{z.mean === null ? dash : plain(z.mean)}</td>
      <td className="is-num">{z.low ? plain(z.low.v) : dash}</td>
      <td>{z.low ? at(z.low.t) : dash}</td>
      <td className="is-num">{z.high ? plain(z.high.v) : dash}</td>
      <td>{z.high ? at(z.high.t) : dash}</td>
      <td className={`is-num${z.below ? ' is-flag' : ''}`}>{z.below.toLocaleString('en-GB')}</td>
    </tr>
  )
}

function Profile({ ctx, zones, focus, bucketed }: { ctx: PageContext; zones: ZoneFigures[]; focus: ZoneFigures | null; bucketed: boolean }) {
  const shown = focus ? [focus] : zones
  const lines: ProfileLine[] = []
  for (const z of shown) {
    const p = zoneProfile(z, focus ? ctx.picked : undefined)
    if (p && z.def) lines.push({ key: z.value, label: z.label, color: z.color, stepMin: p.stepMin, slots: p.slots })
  }
  const unit = zones[0]?.def?.unit
  const days = new Set(zones.flatMap((z) => z.points.map((p) => londonMidnight(p.t)))).size
  if (!lines.length || !unit) {
    return <p className="gf-hint">The window is read as means that don’t fall on single clock times, so there is no shape through the day to draw. Choose a shorter window to see it.</p>
  }
  if (days <= 1) {
    return <p className="gf-hint">Only one day in this window holds a price: the main chart shows its shape. Choose a longer window to see the shape across days.</p>
  }
  const pickedHeld = focus && ctx.picked !== undefined && focus.points.some((p) => londonMidnight(p.t) === ctx.picked)
  const dayLine = pickedHeld ? { label: `${dayLabel(ctx.picked as number)}, the day selected`, color: DAY_COLOR } : null
  const line = lines[0]
  const held = line.slots.filter((s) => s.mean !== null)
  const peak = held.reduce<(typeof held)[number] | null>((a, s) => (a === null || (s.mean ?? 0) > (a.mean ?? 0) ? s : a), null)
  const trough = held.reduce<(typeof held)[number] | null>((a, s) => (a === null || (s.mean ?? 0) < (a.mean ?? 0) ? s : a), null)

  return (
    <>
      {/* The shared KeyList has no mark for a single pale band, so this key draws its own, in the same list. */}
      <ul className="gf-key">
        {lines.map((l) => (
          <li key={l.key}>
            <svg width="22" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="22" y2="5" stroke={l.color} strokeWidth="2" />
            </svg>
            {focus ? `${l.label}: mean at each clock time, ${unit.label ?? 'unit unconfirmed'}` : l.label}
          </li>
        ))}
        {focus && (
          <li>
            <svg width="22" height="12" aria-hidden="true">
              <rect x="0" y="0" width="22" height="12" fill="var(--chart-fan)" fillOpacity={RANGE_OPACITY} />
            </svg>
            Lowest to highest at that time
          </li>
        )}
        {dayLine && (
          <li>
            <svg width="22" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="22" y2="5" stroke={DAY_COLOR} strokeWidth="2" />
            </svg>
            {dayLine.label}
          </li>
        )}
      </ul>
      <ProfileChart lines={lines} band={Boolean(focus)} day={dayLine} unit={unit} bucketed={bucketed} fixture={ctx.fixture} />
      <p className="gf-hint">
        {focus ? `${focus.label}’s mean` : 'Each zone’s mean'} price at each UK clock time, gathered across the {plural(days, 'day', 'days')} holding one, so a day held in part adds to some times only.
        {focus && peak && trough && peak !== trough && peak.mean !== null && trough.mean !== null ? ` Its mean is highest at ${slotText(peak.minute, line.stepMin)} and lowest at ${slotText(trough.minute, line.stepMin)}, on the UK clock.` : ''}
        {focus ? (dayLine ? '' : ' Select a day in the table below to draw it here.') : ' Select a zone in the key to see its range at each time, and a day to draw over it.'}
      </p>
    </>
  )
}
