/**
 * The key: the plain mean of the sites at the latest hour every site holds,
 * with the calmest and windiest sites then; the window's highest, lowest and
 * mean of that site mean; then every site under its region, with its latest
 * 100 m speed (select one to draw it alone and to read it in the working
 * panel); and GB wind output, when the page reads it. Every figure comes
 * from the rows read.
 */
import { KeyList } from '../../../design/charts'
import { stepNoun } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { latestValue, periodName, seriesId, type SeriesDef, type SeriesModel } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { OUTPUT, OUTPUT_KEY, REGIONS, heldSites, siteRegion, speedPoints, statsOf } from './figures'

function SiteItem({ ctx, model, def }: { ctx: PageContext; model: SeriesModel; def: SeriesDef }) {
  const id = seriesId(def)
  const on = ctx.focus === id
  const latest = latestValue(model, def)
  return (
    <li className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
      <button type="button" aria-pressed={on} onClick={() => ctx.setFocus(on ? undefined : id)}>
        <KeyList items={[{ key: id, mark: { kind: 'line', color: def.color, dashed: ctx.fixture }, label: <span className="gf-series-name">{def.label}</span> }]} />
        <span className="gf-series-value">{latest ? def.unit.format(latest.v) : '–'}</span>
      </button>
    </li>
  )
}

export function SitesKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const sites = heldSites(model)
  if (!model || !sites.length) {
    return <p className="gf-hint">No wind speed is held at any site in this window, so there is nothing to key.</p>
  }
  const step = model.stepMs
  const noun = model.bucketed && step ? meansText(step) : stepNoun(step)
  const when = (t: number) => periodName(t, step, null)
  const unit = sites[0].unit
  const points = speedPoints(model)
  const fleet = statsOf(points)
  const last = points.at(-1) ?? null
  const lastRow = last ? model.rows.find((r) => r.t === last.t) : undefined
  const atLast = lastRow
    ? sites.map((d) => ({ d, v: lastRow[d.field] })).filter((x): x is { d: SeriesDef; v: number } => typeof x.v === 'number').sort((a, b) => a.v - b.v)
    : []
  const calmest = atLast[0]
  const windiest = atLast.at(-1)
  const latestAny = Math.max(...sites.map((d) => latestValue(model, d)?.t ?? -Infinity))
  const staggered = last !== null && latestAny > last.t

  const rel = ctx.related[OUTPUT_KEY]
  const outDef = rel?.series?.all.find((d) => d.column === OUTPUT)
  const outLatest = rel?.series && outDef ? latestValue(rel.series, outDef) : null
  const others = model.all.filter((d) => d.count === 0).map((d) => d.label)

  return (
    <>
      {last ? (
        <>
          <dl className="gf-stats">
            <div>
              <dt>{model.bucketed ? 'Latest mean of the sites' : 'Mean of the sites'}</dt>
              <dd>{unit.format(last.v)}</dd>
            </div>
            {calmest && windiest && calmest.d !== windiest.d && (
              <>
                <div>
                  <dt>Calmest site</dt>
                  <dd>
                    {unit.format(calmest.v)}
                    <span className="gf-stat-when">{calmest.d.label}</span>
                  </dd>
                </div>
                <div>
                  <dt>Windiest site</dt>
                  <dd>
                    {unit.format(windiest.v)}
                    <span className="gf-stat-when">{windiest.d.label}</span>
                  </dd>
                </div>
              </>
            )}
          </dl>
          <p className="gf-hint">
            For {when(last.t)}, the latest {model.bucketed ? 'period' : 'hour'} every site holds.{staggered ? ' Some sites hold later hours.' : ''}
          </p>
          <dl className="gf-stats">
            {fleet.high && (
              <div>
                <dt>Highest</dt>
                <dd>
                  {unit.format(fleet.high.v)}
                  <span className="gf-stat-when">{when(fleet.high.t)}</span>
                </dd>
              </div>
            )}
            {fleet.low && (
              <div>
                <dt>Lowest</dt>
                <dd>
                  {unit.format(fleet.low.v)}
                  <span className="gf-stat-when">{when(fleet.low.t)}</span>
                </dd>
              </div>
            )}
            {fleet.mean !== null && (
              <div>
                <dt>Mean</dt>
                <dd>{unit.format(fleet.mean)}</dd>
              </div>
            )}
          </dl>
          <p className="gf-hint">
            The mean of the {sites.length} sites, each counted the same, over the {fleet.count.toLocaleString('en-GB')} {noun} where every one holds a speed.
          </p>
        </>
      ) : (
        <p className="gf-hint">No {model.bucketed ? 'period' : 'hour'} in this window holds a speed at every site, so there is no mean of the sites.</p>
      )}
      {REGIONS.map((region) => {
        const defs = sites.filter((d) => siteRegion(d.group)?.key === region.key)
        if (!defs.length) return null
        return (
          <div key={region.key}>
            <p className="gf-hint">{region.label}</p>
            <ul className="gf-series-key">
              {defs.map((d) => (
                <SiteItem key={d.key} ctx={ctx} model={model} def={d} />
              ))}
            </ul>
          </div>
        )
      })}
      {sites.some((d) => !siteRegion(d.group)) && (
        <ul className="gf-series-key">
          {sites
            .filter((d) => !siteRegion(d.group))
            .map((d) => (
              <SiteItem key={d.key} ctx={ctx} model={model} def={d} />
            ))}
        </ul>
      )}
      <p className="gf-hint">Each site’s latest 100 m speed, in its region’s colour. {ctx.focus ? 'Select it again to draw them all.' : 'Select a site to draw it on its own.'}</p>
      {others.length > 0 && <p className="gf-hint">No speed held in this window at {others.join(', ')}.</p>}
      {rel && (
        <>
          <ul className="gf-series-key">
            <li>
              <button type="button" disabled>
                <KeyList items={[{ key: 'output', mark: { kind: 'line', color: outDef?.color ?? 'var(--fuel-wind)', dashed: ctx.fixture }, label: <span className="gf-series-name">{rel.spec.label}</span> }]} />
                <span className="gf-series-value">{outLatest && outDef ? outDef.unit.format(outLatest.v) : '–'}</span>
              </button>
            </li>
          </ul>
          {outLatest && rel.series ? (
            <p className="gf-hint">
              {ctx.mode === 'chart' ? 'Under the chart. ' : ''}For {periodName(outLatest.t, rel.series.stepMs, rel.series.settlement)}, the latest held.
            </p>
          ) : rel.state === 'error' || rel.state === 'refreshing' ? (
            <p className="gf-hint">
              <ErrorWords error={rel.error} />
            </p>
          ) : (
            <p className="gf-hint">No wind output is held in this window.</p>
          )}
        </>
      )}
    </>
  )
}
