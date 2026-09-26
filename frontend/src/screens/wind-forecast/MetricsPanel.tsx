import type { ForecastMetric } from '../../api/types'
import { fmt0 } from '../../design/format'

const gw2 = (mw: number) => `${(mw / 1000).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} GW`

/** Gate metrics in plain words; the pinball loss is stored in MW and shown in GW like the chart. */
const METRIC_LABELS: Record<string, { label: string; fmt: (v: number) => string; rule: (t: number) => string }> = {
  coverage_nominal90: { label: '90% interval coverage', fmt: (v) => `${(v * 100).toFixed(1)}%`, rule: (t) => `at least ${(t * 100).toFixed(0)}%` },
  monotonicity: { label: 'Quantile crossings', fmt: (v) => fmt0(v), rule: (t) => `at most ${fmt0(t)}` },
  'pinball_q0.5': { label: 'Pinball loss, median', fmt: gw2, rule: (t) => `at most ${gw2(t)}` },
}

function StatusIcon({ state }: { state: 'pass' | 'fail' | 'unknown' }) {
  if (state === 'pass')
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 7.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  if (state === 'fail')
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4.8 4.8l4.4 4.4M9.2 4.8l-4.4 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
    </svg>
  )
}

/** A run's gate metrics: value, rule and result per gate, then the perfect-prog caveat in words. */
export function MetricsPanel({ metrics, caveat }: { metrics: ForecastMetric[]; caveat: boolean | null }) {
  return (
    <div className="gf-metrics">
      <table>
        <thead>
          <tr>
            <th scope="col">Gate</th>
            <th scope="col" className="is-num">
              Value
            </th>
            <th scope="col">Rule</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => {
            const meta = METRIC_LABELS[m.metric_name]
            const state = m.gate_passed === null ? 'unknown' : m.gate_passed ? 'pass' : 'fail'
            return (
              <tr key={m.metric_name}>
                <th scope="row">{meta?.label ?? m.metric_name}</th>
                <td className="is-num">{meta ? meta.fmt(m.metric_value) : m.metric_value.toFixed(4)}</td>
                <td className="gf-metrics-rule">{m.gate_threshold === null ? 'no gate' : meta ? meta.rule(m.gate_threshold) : String(m.gate_threshold)}</td>
                <td>
                  <span className={`gf-status is-${state}`}>
                    <StatusIcon state={state} />
                    {state === 'pass' ? 'Pass' : state === 'fail' ? 'Fail' : 'Unknown'}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="gf-caveat">
        {caveat === true
          ? 'Scored with realised weather (perfect prog), so it flatters the model by the unmeasured weather-forecast error.'
          : caveat === false
            ? 'Scored on genuine day-ahead inputs; the perfect-prog caveat does not apply.'
            : 'No metrics recorded for this run yet, so the perfect-prog caveat is unknown.'}
      </p>
    </div>
  )
}
