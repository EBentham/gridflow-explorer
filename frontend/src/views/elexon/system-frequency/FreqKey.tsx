/**
 * The key: the latest reading held, the lowest and highest in the window
 * with their times, how many readings the window holds of those a full
 * clock would, and what each line on the chart is, with where its figure
 * comes from. On a window read as means every figure says it is a mean.
 */
import { useMemo } from 'react'
import { KeyList } from '../../../design/charts'
import { instantLabel, periodLabel } from '../../../design/time'
import { extremesOf } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { BAND_FILL, FREQ_COLOR, NARROW, NOMINAL_HZ, STATUTORY, bandText, freqDef, heldPoints, meanNoun, periodNoun } from './figures'

export function FreqKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const def = freqDef(model)
  const rows = model?.rows
  const points = useMemo(() => (rows && def ? heldPoints(rows, def) : []), [rows, def])
  const ex = useMemo(() => (rows && def ? extremesOf(rows, def) : null), [rows, def])
  if (!model || !def || !rows || !points.length) return <p className="gf-hint">No reading is held in this window, so there is nothing to key.</p>
  const bucketed = model.bucketed
  const latest = points[points.length - 1]
  const when = (t: number) => (bucketed ? periodLabel(t, model.stepMs) : instantLabel(t, { seconds: true }))
  const noun = bucketed ? meanNoun(model.stepMs) : 'reading'
  const period = periodNoun(model.stepMs)
  const unit = def.unit

  return (
    <>
      <dl className="gf-stats">
        <div>
          <dt>Latest {noun}</dt>
          <dd>
            {unit.format(latest.v)}
            <span className="gf-stat-when">{when(latest.t)}</span>
          </dd>
        </div>
        {ex && (
          <>
            <div>
              <dt>Lowest {noun}</dt>
              <dd>
                {unit.format(ex.low.v)}
                <span className="gf-stat-when">{when(ex.low.t)}</span>
              </dd>
            </div>
            <div>
              <dt>Highest {noun}</dt>
              <dd>
                {unit.format(ex.high.v)}
                <span className="gf-stat-when">{when(ex.high.t)}</span>
              </dd>
            </div>
          </>
        )}
        <div>
          <dt>{bucketed ? `${period[0].toUpperCase()}${period.slice(1)}s held` : 'Readings held'}</dt>
          <dd>
            {points.length.toLocaleString('en-GB')}
            <span className="gf-stat-when">of {rows.length.toLocaleString('en-GB')} on the clock in this window</span>
          </dd>
        </div>
      </dl>
      {bucketed && (
        <p className="gf-hint">
          These are means of the readings, not readings: a mean hides the swings inside its {period}, and a {period} next to a gap may hold only some of its readings, its mean being over those. Choose
          7 days or fewer for the readings’ own lowest and highest.
        </p>
      )}
      <div className="sf-key">
        <KeyList
          items={[
            {
              key: 'f',
              mark: { kind: 'line', color: FREQ_COLOR, dashed: ctx.fixture },
              label: bucketed ? `System frequency, ${noun}s` : 'System frequency, each reading',
            },
            {
              key: 'n',
              mark: { kind: 'line', color: 'var(--chart-axis)' },
              label: `${NOMINAL_HZ} Hz, nominal (the middle rule)`,
            },
            {
              key: 's',
              mark: { kind: 'line', color: 'var(--chart-axis)' },
              label: `Statutory limits, ${bandText(STATUTORY)} (labelled)`,
            },
            {
              key: 'b',
              mark: { kind: 'swatch', color: BAND_FILL },
              label: bucketed ? `${bandText(NARROW)}, the shaded band` : `${bandText(NARROW)}, the shaded band counted below`,
            },
          ]}
        />
      </div>
      <p className="gf-hint">
        The statutory range is the one gridflow’s notes on this dataset give. The {bandText(NARROW)} band is a narrower reference band around 50 Hz; no source held here says who sets it, so the page
        doesn’t call it a limit.
      </p>
    </>
  )
}
