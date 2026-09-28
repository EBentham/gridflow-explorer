/**
 * The key for both datasets: every series the chart draws (the six sites'
 * tilted irradiance, then GB solar generation or the archive's sites below)
 * with its line and its highest value in the window, and when. Select a
 * series to draw it alone. The latest value would read 0 W/m² after dark,
 * so the key gives the peak instead.
 *
 * Irradiance is stamped at the end of the hour it averages, so its peak is
 * named as the hour to its stamp; generation keeps the template's period.
 */
import { KeyList } from '../../../design/charts'
import { instantLabel } from '../../../design/time'
import { planPanels } from '../../_template/seriesPanels'
import { extremesOf, periodName, seriesId, type SeriesDef } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { SOLAR_MW, siteLabel } from './figures'

export function SiteKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const plan = planPanels(ctx)
  const drawn = plan.panels.flatMap((p) => p.series)
  if (!model || !drawn.length) {
    return <p className="gf-hint">No irradiance is held in this window, so there is nothing to key.</p>
  }
  const modelOf = (d: SeriesDef) => (d.from === 'self' ? model : ctx.related[d.from]?.series)
  const pickable = drawn.length > 1
  const bucketed = drawn.some((d) => modelOf(d)?.bucketed)

  const when = (d: SeriesDef, t: number) => {
    const m = modelOf(d)
    if (!m || m.bucketed || d.column === SOLAR_MW) return periodName(t, m?.stepMs ?? null, m?.settlement)
    return `hour to ${instantLabel(t)}`
  }

  // One list per chart panel, headed by what it draws, so each series is named by its site alone.
  const lists = plan.panels.map((p) => p.series)
  const heading = (series: SeriesDef[]) => {
    const from = series[0]?.from
    if (!from || from === 'self') return ctx.view.label
    return ctx.related[from]?.spec.label ?? from
  }

  return (
    <>
      {lists.map((series) => (
        <div key={series[0]?.from ?? 'none'}>
          {lists.length > 1 && <p className="gf-hint">{heading(series)}{ctx.mode !== 'chart' ? '' : series[0]?.from === 'self' ? ', the upper chart' : ', the lower chart'}</p>}
          <ul className="gf-series-key">
            {series.map((d) => {
              const id = seriesId(d)
              const m = modelOf(d)
              const peak = m ? extremesOf(m.rows, d)?.high : null
              const on = ctx.focus === id
              return (
                <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
                  <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : id)}>
                    <KeyList items={[{ key: id, mark: { kind: 'line', color: d.color, dashed: ctx.fixture }, label: <span className="gf-series-name">{d.group !== null ? siteLabel(d.group) : d.label}</span> }]} />
                    <span className="gf-series-value">{peak ? d.unit.format(peak.v) : '–'}</span>
                  </button>
                  {peak && <span className="gf-series-when">{when(d, peak.t)}</span>}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <p className="gf-hint">
        Each figure is the series’ highest {bucketed ? 'mean' : 'value'} in {ctx.windowText}
        {bucketed && model.stepMs ? `, read as ${meansText(model.stepMs)}` : ''}.{pickable && ctx.mode === 'chart' ? (ctx.focus ? ' Select it again to draw them all.' : ' Select a series to draw it on its own.') : ''}
      </p>
      {model.empty.length > 0 && <p className="gf-hint">No value held in this window for {model.empty.map((d) => d.label).join(', ')}.</p>}
    </>
  )
}
