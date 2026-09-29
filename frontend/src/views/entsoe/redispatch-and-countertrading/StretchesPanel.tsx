/**
 * The working panel: when each zone redispatched. First each UK day per
 * zone (quarter-hours held, those redispatching, and the energy they add up
 * to), so a day held in part reads as such; then every stretch of
 * consecutive quarter-hours redispatching, with its length, peak, mean and
 * energy, and what met it at each end: a held 0 MW, a quarter-hour not held
 * (the stretch may run on past it), or the window's edge. The rows carry no
 * id, direction or reason, so a stretch is read from the quarter-hours
 * alone, never matched to an action.
 */
import type { ReactNode } from 'react'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import { meansText } from '../../_template/text'
import { plural } from '../../../design/format'
import { dayLabel, instantLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { allFigures, mwText, mwh, mwhText, zoneDays, zoneList, zoneName, type Edge, type Stretch, type ZoneDay } from './figures'

const EDGE: Record<Edge, string> = {
  zero: 'held 0 MW',
  gap: 'not held',
  window: 'window’s edge',
}

/** `3 h 45 min`, `45 min`. */
function lengthText(ms: number): string {
  const min = Math.round(ms / 60000)
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

function DayTable({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  if (!model || !window) return null
  const zones = zoneList(model)
  const none: ZoneDay = { held: 0, active: 0, sumMw: 0 }
  // The window's days, whichever zone holds rows; a zone with none in the window gets a column of "none held".
  const blank = zoneDays(model, null, window).map((d) => ({ ...d, z: none }))
  const perZone = zones.map((z) => (z.def ? zoneDays(model, z.def, window) : blank))
  const days = blank
  const heldOn = (i: number) => perZone.some((zd) => zd[i].z.held > 0)
  // A long window opening on days not held shows them as one row, so the held days aren't below the fold.
  let lead = 0
  while (lead < days.length && !heldOn(lead)) lead += 1
  if (lead === days.length) lead = 0
  const collapse = lead >= 2
  const step = model.stepMs ?? 0
  const cols = zones.length * 3
  const cells = (i: number): ReactNode =>
    perZone.map((zd, zi) => {
      const { z } = zd[i]
      const expected = zd[i].expected
      const key = zones[zi].group
      if (!z.held) {
        return (
          <td key={key} colSpan={3}>
            none held
          </td>
        )
      }
      return [
        <td key={`${key}-h`} className="is-num">
          {expected !== null && z.held < expected ? <strong>{`${z.held} of ${expected}`}</strong> : z.held}
        </td>,
        <td key={`${key}-a`} className="is-num">
          {z.active}
        </td>,
        <td key={`${key}-e`} className="is-num">
          {mwhText(mwh(z.sumMw, step))}
        </td>,
      ]
    })
  return (
    <>
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Day
              </th>
              {zones.map((z) => (
                <th key={z.group} scope="colgroup" colSpan={3}>
                  {zoneName(z.group)}
                </th>
              ))}
            </tr>
            <tr>
              {zones.map((z) => [
                <th key={`${z.group}-h`} scope="col" className="is-num">
                  Held
                </th>,
                <th key={`${z.group}-a`} scope="col" className="is-num">
                  Redispatching
                </th>,
                <th key={`${z.group}-e`} scope="col" className="is-num">
                  MWh
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {collapse && (
              <tr className="is-missing">
                <th scope="row">
                  {dayLabel(days[0].start)} – {dayLabel(days[lead - 1].start)}
                </th>
                <td colSpan={cols}>not held locally, {plural(lead, 'day', 'days')}</td>
              </tr>
            )}
            {days.map((d, i) => {
              if (collapse && i < lead) return null
              if (!heldOn(i)) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td colSpan={cols}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              // A partly held day is marked in its zone's own Held cell, not on the row.
              return (
                <tr key={d.day} className={on ? 'is-on' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  {cells(i)}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length - (collapse ? lead : 0) > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
    </>
  )
}

export function StretchesPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model || ctx.state === 'empty' || !model.all.some((d) => d.count > 0)) {
    return <p className="gf-hint">No quarter-hour is held in {ctx.windowText}, so there is no redispatching to list.</p>
  }
  if (model.bucketed && model.stepMs) {
    return <p className="gf-hint">This window is read as {meansText(model.stepMs)}, so the page doesn’t read stretches or energy from it: a mean can hide a quarter-hour at 0 MW. A window of 30 days or fewer is read quarter-hour by quarter-hour.</p>
  }
  const figures = allFigures(ctx)
  const stretches = figures.flatMap((f) => f.stretches)
  const step = model.stepMs ?? 0

  const columns: TableCol<Stretch>[] = [
    { key: 'zone', label: 'Zone', render: (s) => zoneName(s.zone.group), sortValue: (s) => zoneName(s.zone.group) },
    { key: 'start', label: 'From', render: (s) => instantLabel(s.start), sortValue: (s) => s.start },
    { key: 'end', label: 'To', render: (s) => instantLabel(s.end), sortValue: (s) => s.end },
    { key: 'length', label: 'Length', num: true, render: (s) => lengthText(s.end - s.start), sortValue: (s) => s.steps },
    { key: 'peak', label: 'Peak, MW', num: true, render: (s) => mwText(s.peak.v), sortValue: (s) => s.peak.v },
    { key: 'mean', label: 'Mean, MW', num: true, render: (s) => mwText(s.sumMw / s.steps), sortValue: (s) => s.sumMw / s.steps },
    { key: 'energy', label: 'MWh', num: true, render: (s) => mwhText(mwh(s.sumMw, step)), sortValue: (s) => s.sumMw },
    { key: 'before', label: 'Before it', render: (s) => EDGE[s.before], sortValue: (s) => EDGE[s.before] },
    { key: 'after', label: 'After it', render: (s) => EDGE[s.after], sortValue: (s) => EDGE[s.after] },
  ]
  const open = stretches.filter((s) => s.before === 'gap' || s.after === 'gap').length
  const counts = zoneList(model).map((z) => {
    const f = figures.find((x) => x.zone === z.def)
    return f && f.held > 0 ? `${zoneName(z.group)} ${f.stretches.length.toLocaleString('en-GB')}` : `${zoneName(z.group)} none held`
  })

  return (
    <>
      <p className="gf-hint">Each UK day, per zone: quarter-hours held, those redispatching (held at a value other than 0 MW), and the energy of the quarter-hours held.</p>
      <DayTable ctx={ctx} />
      {stretches.length > 0 ? (
        <WindowedTable
          columns={columns}
          rows={stretches}
          rowKey={(s) => `${s.zone.key}:${s.start}`}
          initialSort={{ key: 'start', dir: 'desc' }}
          maxHeight={300}
          caption={`${plural(stretches.length, 'stretch', 'stretches')} of consecutive quarter-hours redispatching in ${ctx.windowText} (${counts.join(', ')}), newest first.`}
        />
      ) : (
        <p className="gf-hint">Every quarter-hour held in {ctx.windowText} is at 0 MW: no redispatching is held.</p>
      )}
      <p className="gf-hint">
        A stretch runs while quarter-hours are held at a value other than 0 MW; a held 0 MW or a quarter-hour not held ends it.
        {open > 0 ? ` ${open === 1 ? 'One stretch meets' : `${open} stretches meet`} a quarter-hour not held, so ${open === 1 ? 'it' : 'they'} may run on past what is held.` : ''} The rows name no action, direction or reason, so a stretch can hold several actions, or part of one.{ctx.mode === 'chart' && ctx.window && ctx.window.start !== ctx.window.end ? ' Select a day to mark it on the chart.' : ''}
      </p>
    </>
  )
}
