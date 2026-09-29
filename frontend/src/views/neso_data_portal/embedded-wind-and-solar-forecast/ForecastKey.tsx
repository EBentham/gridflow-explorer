/**
 * The key: the two forecasts, top of the stack first as on the chart, each
 * with its swatch and its highest half-hour in the window; select one to draw
 * it alone. Then the forecast behind the window (its issue time and how far
 * ahead it was made), the highest embedded total, solar's peak as a share of
 * the solar capacity NESO assumed for that half-hour, wind's range, and the
 * capacities as the rows hold them. Every figure is read from the rows.
 */
import { plural, pct } from '../../../design/format'
import { instantLabel } from '../../../design/time'
import { periodName, type WideRow } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { SOLAR_CAP, SOLAR_FC, WIND_CAP, WIND_FC, WIND_STRIPE, SOLAR_COLOR, aheadParts, capacityOf, idOf, issuesOf, seriesOf } from './figures'

const ITEMS = [
  { column: SOLAR_FC, label: 'Solar, embedded', swatch: SOLAR_COLOR },
  { column: WIND_FC, label: 'Wind, embedded', swatch: WIND_STRIPE },
]

export function ForecastKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const wind = seriesOf(model, WIND_FC)
  const solar = seriesOf(model, SOLAR_FC)
  if (!model || !ctx.window || ctx.state === 'empty' || !wind || !solar || (!wind.count && !solar.count)) {
    return <p className="gf-hint">No forecast is held in this window, so there is nothing to key.</p>
  }
  const unit = wind.unit
  const when = (t: number) => periodName(t, model.stepMs, model.settlement)
  const issues = issuesOf(ctx.response)
  const focus = ctx.focus
  const solarCap = seriesOf(model, SOLAR_CAP)

  // The highest half-hour of wind and solar together, where both are held; and solar's peak against its capacity that half-hour.
  let top: { t: number; v: number } | null = null
  let solarPeak: WideRow | null = null
  let windHigh: WideRow | null = null
  let windLow: WideRow | null = null
  for (const r of model.rows) {
    const w = r[wind.field]
    const s = r[solar.field]
    if (typeof w === 'number' && typeof s === 'number' && (!top || w + s > top.v)) top = { t: r.t, v: w + s }
    if (typeof s === 'number' && (!solarPeak || s > (solarPeak[solar.field] as number))) solarPeak = r
    if (typeof w === 'number') {
      if (!windHigh || w > (windHigh[wind.field] as number)) windHigh = r
      if (!windLow || w < (windLow[wind.field] as number)) windLow = r
    }
  }
  const peakOf = (column: string) => {
    const d = column === WIND_FC ? wind : solar
    return d.max
  }
  const peakSolar = solarPeak ? (solarPeak[solar.field] as number) : null
  const capAtPeak = solarPeak && solarCap ? solarPeak[solarCap.field] : null
  const share = peakSolar !== null && typeof capAtPeak === 'number' && capAtPeak > 0 ? peakSolar / capAtPeak : null

  const caps = [
    { name: 'Wind', cap: capacityOf(model, WIND_CAP) },
    { name: 'Solar', cap: capacityOf(model, SOLAR_CAP) },
  ]

  return (
    <>
      <ul className="gf-fuel-key">
        {ITEMS.map((f) => {
          const id = idOf(f.column)
          const on = focus === id
          const v = peakOf(f.column)
          return (
            <li key={f.column} className={on ? 'is-focus' : focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <span className="gf-swatch" style={{ background: f.swatch }} />
                <span className="gf-fuel-name">{f.label}</span>
                <span className="gf-fuel-value">{v === null ? '–' : unit.format(v)}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="gf-hint">Each forecast’s highest half-hour in the window. Select one to draw it alone.</p>
      <dl className="gf-stats">
        {issues && (
          <>
            <div>
              <dt>{issues.times.length === 1 ? 'Forecast issued' : 'Newest issue'}</dt>
              <dd>
                {instantLabel(issues.times[issues.times.length - 1], { year: true })}
                {issues.times.length > 1 && <span className="gf-stat-when">{plural(issues.times.length, 'issue', 'issues')} behind this window</span>}
              </dd>
            </div>
            <div>
              <dt>Made ahead</dt>
              <dd>
                {aheadParts(issues).value}
                <span className="gf-stat-when">before the half-hours in this window{aheadParts(issues).late ? '.' : ''}</span>
                {aheadParts(issues).late && <span className="gf-stat-when">{aheadParts(issues).late}</span>}
              </dd>
            </div>
          </>
        )}
        {top && (
          <div>
            <dt>Wind and solar, highest</dt>
            <dd>
              {unit.format(top.v)}
              <span className="gf-stat-when">{when(top.t)}</span>
            </dd>
          </div>
        )}
        {solarPeak && peakSolar !== null && (
          <div>
            <dt>Solar, highest</dt>
            <dd>
              {unit.format(peakSolar)}
              {share !== null && typeof capAtPeak === 'number' && (
                <span className="gf-stat-when">
                  {pct(share)} of the {unit.format(capAtPeak)} of solar NESO assumed then
                </span>
              )}
              <span className="gf-stat-when">{when(solarPeak.t)}</span>
            </dd>
          </div>
        )}
        {windHigh && windLow && (
          <div>
            <dt>Wind, range</dt>
            <dd>
              {unit.format(windLow[wind.field] as number)} to {unit.format(windHigh[wind.field] as number)}
              <span className="gf-stat-when">lowest {when(windLow.t)}</span>
              <span className="gf-stat-when">highest {when(windHigh.t)}</span>
            </dd>
          </div>
        )}
        {caps.map(({ name, cap }) =>
          cap ? (
            <div key={name}>
              <dt>{name} capacity assumed</dt>
              <dd>
                {cap.min === cap.max ? cap.def.unit.format(cap.min) : `${cap.def.unit.format(cap.min)} to ${cap.def.unit.format(cap.max)}`}
                <span className="gf-stat-when">{cap.min === cap.max ? 'the same in every half-hour held' : 'varying across the half-hours held'}</span>
              </dd>
            </div>
          ) : null,
        )}
      </dl>
      <p className="gf-hint">
        Over the {wind.count.toLocaleString('en-GB')} half-hours with a wind forecast and {solar.count.toLocaleString('en-GB')} with a solar one in {ctx.windowText}.
      </p>
    </>
  )
}
