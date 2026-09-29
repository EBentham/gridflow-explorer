/**
 * The key: each border's revenue over the hours held in the window, how many
 * hours it holds and how many of them are €0; select one to draw it alone.
 * Then the lines beneath (capacity allocated on the same borders), and the
 * selected border's figures: mean per hour held, highest hour, latest hour.
 * Every figure is of the hours held, each counted once.
 */
import { KeyList } from '../../../design/charts'
import { listText } from '../../../design/format'
import { dayLabel, HOUR_MS, periodLabel } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { seriesId } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { ALLOC_KEY, bordersOf, fewerAllocatedDays, heldText, totalsReadable, windowTally } from './figures'

export function RevenueKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const w = ctx.window
  const borders = bordersOf(model)
  if (!model || !w || !borders.length) return <p className="gf-hint">No border holds revenue in this window, so there is nothing to key.</p>
  if (!totalsReadable(model)) {
    return (
      <p className="gf-hint">
        The rows came back as {model.stepMs ? meansText(model.stepMs) : 'means'}, so no total is worked out: a total needs each hour as published. A window of 30 days or
        fewer reads every hour.
      </p>
    )
  }
  const tallies = new Map(borders.map((d) => [seriesId(d), windowTally(model, d, w)]))
  const pickable = borders.length > 1
  const sel = borders.find((d) => seriesId(d) === ctx.focus) ?? borders[0]
  const st = tallies.get(seriesId(sel))
  const unit = sel.unit
  const when = (t: number) => periodLabel(t, HOUR_MS)
  const both = [...tallies.values()]
  const sameHours = both.every((t) => t.held === both[0].held)
  const rel = ctx.related[ALLOC_KEY]
  const beneath = rel?.series?.drawn ?? []
  const fewer = rel?.series && beneath.length ? fewerAllocatedDays(model, rel.series, w) : []
  const fewerText = fewer.length > 4 ? `${fewer.slice(0, 4).map(dayLabel).join(', ')} and ${fewer.length - 4} more` : listText(fewer.map(dayLabel))

  return (
    <>
      <ul className="gf-series-key">
        {borders.map((d) => {
          const id = seriesId(d)
          const t = tallies.get(id)
          const on = ctx.focus === id
          return (
            <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <KeyList items={[{ key: id, mark: { kind: 'swatch', color: d.color }, label: <span className="gf-series-name">{d.label}</span> }]} />
                <span className="gf-series-value">{t ? unit.format(t.total) : '–'}</span>
              </button>
              {t && (
                <span className="gf-series-when">
                  {heldText(t)} hours held, {t.zero.toLocaleString('en-GB')} at {unit.format(0)}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {pickable && <p className="gf-hint">{ctx.focus ? 'Select it again to draw both borders.' : 'Select a border to draw it alone.'}</p>}
      {model.empty.length > 0 && <p className="gf-hint">No revenue held in this window: {listText(model.empty.map((d) => d.label))}.</p>}
      {pickable && (
        <dl className="gf-stats">
          <div>
            <dt>Both borders</dt>
            <dd>
              {unit.format(both.reduce((s, t) => s + t.total, 0))}
              <span className="gf-stat-when">{sameHours ? `over the same ${both[0].held.toLocaleString('en-GB')} hours held` : 'over each border’s own hours held'}</span>
            </dd>
          </div>
        </dl>
      )}
      {ctx.mode === 'chart' && beneath.length > 0 && (
        <>
          <p className="gf-hint">Beneath, the capacity allocated on each border, in MW:</p>
          <KeyList items={beneath.map((d) => ({ key: seriesId(d), mark: { kind: 'line' as const, color: d.color, dashed: ctx.fixture }, label: d.label }))} />
        </>
      )}
      {fewer.length > 0 && <p className="gf-hint">The capacity allocated holds fewer hours than the revenue on {fewerText}. An hour it lacks is not held, not zero.</p>}
      {rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          The capacity allocated isn’t drawn. <ErrorWords error={rel.error} />
        </p>
      )}
      {st && st.held > 0 && (
        <>
          <p className="gf-hint">In this window, {sel.label}:</p>
          <dl className="gf-stats">
            <div>
              <dt>Mean per hour held</dt>
              <dd>{unit.format(st.total / st.held)}</dd>
            </div>
            {st.high && (
              <div>
                <dt>Highest hour</dt>
                <dd>
                  {unit.format(st.high.v)}
                  <span className="gf-stat-when">{when(st.high.t)}</span>
                </dd>
              </div>
            )}
            {st.latest && (
              <div>
                <dt>Latest hour held</dt>
                <dd>
                  {unit.format(st.latest.v)}
                  <span className="gf-stat-when">{when(st.latest.t)}</span>
                </dd>
              </div>
            )}
            <div>
              <dt>Hours at {unit.format(0)}</dt>
              <dd>
                {st.zero.toLocaleString('en-GB')} of {st.held.toLocaleString('en-GB')}
              </dd>
            </div>
          </dl>
          <p className="gf-hint">Totals add up the hours held. An hour not held adds nothing and isn’t counted as {unit.format(0)}; an hour at {unit.format(0)} is as published.</p>
        </>
      )}
    </>
  )
}
