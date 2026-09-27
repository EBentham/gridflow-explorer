/**
 * National demand's key: the two lines' marks, the latest half-hour held
 * with both measures named by its settlement period, then the window's peak,
 * trough and mean national demand, and how far transmission demand ran above
 * it. Every figure comes from the rows read (`ctx.series` and the related
 * transmission demand); the gap is read only at half-hours both hold.
 */
import { KeyList, type KeyItem } from '../../../design/charts'
import { stepNoun } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { extremesOf, latestValue, periodName } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { INDO, ITSDO, TSD_KEY, gapRows, seriesOf } from './figures'

export function DemandKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const national = seriesOf(model, INDO)
  if (!model || !national || !national.count || national.mean === null) {
    return <p className="gf-hint">No national demand is held in this window, so there is nothing to key.</p>
  }
  const rel = ctx.related[TSD_KEY]
  const tModel = rel?.series ?? null
  const transmission = seriesOf(tModel, ITSDO)
  const step = model.stepMs
  const noun = model.bucketed && step ? meansText(step) : stepNoun(step)
  const when = (t: number) => periodName(t, step, model.settlement)
  const latest = latestValue(model, national)
  const tAtLatest = latest && tModel && transmission ? tModel.rows.find((r) => r.t === latest.t)?.[transmission.field] : null
  const ex = extremesOf(model.rows, national)
  const gap = tModel && transmission ? gapRows(model, national, tModel, transmission) : null
  const unit = national.unit

  const items: KeyItem[] = [{ key: 'national', mark: { kind: 'line', color: national.color, dashed: ctx.fixture }, label: `${national.label}, ${unit.label ?? 'unit unconfirmed'}` }]
  if (transmission && transmission.count > 0) {
    items.push({ key: 'transmission', mark: { kind: 'line', color: transmission.color, dashed: ctx.fixture }, label: ctx.mode === 'chart' ? `${transmission.label}, lower chart` : transmission.label })
  }

  return (
    <>
      <KeyList items={items} />
      {latest && (
        <>
          <dl className="gf-stats">
            <div>
              <dt>{model.bucketed ? 'Latest mean, national' : 'National'}</dt>
              <dd>{unit.format(latest.v)}</dd>
            </div>
            {transmission && (
              <div>
                <dt>Transmission</dt>
                <dd>{typeof tAtLatest === 'number' ? transmission.unit.format(tAtLatest) : 'not held'}</dd>
              </div>
            )}
          </dl>
          <p className="gf-hint">For {when(latest.t)}, the latest national demand held.</p>
        </>
      )}
      <dl className="gf-stats">
        {ex && (
          <>
            <div>
              <dt>Peak</dt>
              <dd>
                {unit.format(ex.high.v)}
                <span className="gf-stat-when">{when(ex.high.t)}</span>
              </dd>
            </div>
            <div>
              <dt>Trough</dt>
              <dd>
                {unit.format(ex.low.v)}
                <span className="gf-stat-when">{when(ex.low.t)}</span>
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>Mean</dt>
          <dd>{unit.format(national.mean)}</dd>
        </div>
        {gap && gap.count > 0 && gap.min !== null && gap.max !== null && (
          <div>
            <dt>Mean gap</dt>
            <dd>
              {unit.format(gap.sum / gap.count)}
              <span className="gf-stat-when">
                {unit.plain(gap.min)} to {unit.format(gap.max)}
              </span>
            </dd>
          </div>
        )}
      </dl>
      <p className="gf-hint">
        Peak, trough and mean are of the {national.count.toLocaleString('en-GB')} {noun} of national demand held in the window.
        {gap && gap.count > 0 ? ` The gap is transmission demand less national demand, read at the ${gap.count.toLocaleString('en-GB')} ${noun} where both are held.` : ''}
      </p>
      {rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          Transmission demand could not be read: <ErrorWords error={rel.error} />
        </p>
      )}
      {rel && rel.state === 'empty' && <p className="gf-hint">No transmission demand is held in this window, so there is no gap to read.</p>}
      {gap && transmission && transmission.count > 0 && gap.count === 0 && <p className="gf-hint">The two measures hold no {noun} in common in this window, so there is no gap to read.</p>}
    </>
  )
}
