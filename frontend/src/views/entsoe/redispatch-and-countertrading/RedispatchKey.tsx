/**
 * The key: the template's key (each zone with its latest quarter-hour held,
 * select one to draw it alone), then for each zone over the window how many
 * quarter-hours are held and how many of them redispatch, the peak, and the
 * energy the held quarter-hours add up to. Every figure is read from the
 * rows; a quarter-hour not held counts for nothing, never as 0 MW.
 */
import { listText } from '../../../design/format'
import { SeriesKey } from '../../_template/panels'
import { periodName } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { allFigures, mwText, mwh, mwhText, zoneList, zoneName } from './figures'

export function RedispatchKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model || !model.all.length) return <SeriesKey ctx={ctx} />
  if (model.bucketed && model.stepMs) {
    return (
      <>
        <SeriesKey ctx={ctx} />
        <p className="gf-hint">This window is read as {meansText(model.stepMs)}, so the page doesn’t count quarter-hours or add up energy from it. A window of 30 days or fewer is read quarter-hour by quarter-hour.</p>
      </>
    )
  }
  const figures = allFigures(ctx).filter((f) => f.held > 0)
  // A zone with no quarter-hour held in the window has no series to key, so it is named here instead.
  const missing = zoneList(model).filter((z) => !figures.some((f) => f.zone === z.def))
  const step = model.stepMs ?? 0
  return (
    <>
      <SeriesKey ctx={ctx} />
      {figures.map((f) => (
        <div key={f.zone.key}>
          <p className="gf-hint">{zoneName(f.zone.group)}, over the window:</p>
          <dl className="gf-stats">
            <div>
              <dt>Redispatching</dt>
              <dd>
                {f.active.toLocaleString('en-GB')} of {f.held.toLocaleString('en-GB')}
                <span className="gf-stat-when">
                  quarter-hours held, {f.stretches.length.toLocaleString('en-GB')} {f.stretches.length === 1 ? 'stretch' : 'stretches'}
                </span>
              </dd>
            </div>
            {f.peak && f.peak.v !== 0 && (
              <div>
                <dt>Peak</dt>
                <dd>
                  {mwText(f.peak.v)} MW
                  <span className="gf-stat-when">{periodName(f.peak.t, model.stepMs, model.settlement)}</span>
                </dd>
              </div>
            )}
            <div>
              <dt>Energy</dt>
              <dd>
                {mwhText(mwh(f.sumMw, step))} MWh
                <span className="gf-stat-when">over the quarter-hours held</span>
              </dd>
            </div>
          </dl>
        </div>
      ))}
      {missing.length > 0 && (
        <p className="gf-hint">
          {listText(missing.map((z) => zoneName(z.group)))}: no quarter-hour held in {ctx.windowText}.
        </p>
      )}
      <p className="gf-hint">Energy is each quarter-hour’s MW times a quarter of an hour, added up over the quarter-hours held. It covers those quarter-hours only: what happened in a quarter-hour not held is unknown, not 0 MW.</p>
    </>
  )
}
