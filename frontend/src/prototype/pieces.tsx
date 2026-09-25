import { useMemo, type ReactNode } from 'react'
import type { ForecastMetric } from '../api/types'
import { fmt0, fmt1 } from '../design/charts'
import { FUEL_BANDS, fuelVar, totalGeneration, type MixRow } from '../design/fuels'
import { clock, dayLabel, londonMidnight } from '../design/time'
import { rangeText } from './controls'
import type { DateRange } from '../lib/range'

export function ScreenHead({ title, sub, range, stamp, badge }: { title: string; sub: string; range?: DateRange | null; stamp?: string; badge?: ReactNode }) {
  return (
    <header className="gf-screen-head">
      <div className="gf-screen-title">
        <h1>{title}</h1>
        {badge}
      </div>
      <p className="gf-screen-sub">{sub}</p>
      {(range || stamp) && <p className="gf-stamp">{stamp ?? (range ? `${rangeText(range.start, range.end)}, UK time` : '')}</p>}
    </header>
  )
}

// ---------------------------------------------------------------- heat strip (D signature)

export interface HeatCell {
  t: number
  value: number | null
}

/**
 * Day × half-hour grid: one row per London day, one cell per half-hour in
 * clock order (a 23h or 25h clock-change day simply has fewer or more
 * cells). A single-hue sequential ramp, scale shown beside it. Clicking a
 * row selects that day.
 */
export function HeatStrip({
  cells,
  unit,
  label,
  selected,
  onSelect,
  format = fmt0,
}: {
  cells: HeatCell[]
  unit: string
  label: string
  selected?: number
  onSelect?: (dayStart: number) => void
  format?: (v: number) => string
}) {
  const days = useMemo(() => {
    const map = new Map<number, HeatCell[]>()
    for (const c of cells) {
      const d = londonMidnight(c.t)
      if (!map.has(d)) map.set(d, [])
      map.get(d)!.push(c)
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [cells])
  const vals = cells.map((c) => c.value).filter((v): v is number => v !== null)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pct = (v: number) => (hi === lo ? 50 : Math.round(((v - lo) / (hi - lo)) * 100))
  return (
    <figure className="gf-heat">
      <figcaption>
        <span>{label}</span>
        <span className="gf-heat-scale">
          <span>{`${format(lo)}${unit === '%' ? '' : ' '}${unit}`}</span>
          <span className="gf-heat-ramp" aria-hidden="true" />
          <span>{`${format(hi)}${unit === '%' ? '' : ' '}${unit}`}</span>
        </span>
      </figcaption>
      <div className="gf-heat-grid" role="list">
        {days.map(([d, row]) => (
          <button
            type="button"
            role="listitem"
            key={d}
            className={`gf-heat-row${selected === d ? ' is-on' : ''}`}
            onClick={onSelect ? () => onSelect(d) : undefined}
            aria-label={`${dayLabel(d)}, select day`}
          >
            <span className="gf-heat-day">{dayLabel(d)}</span>
            <span className="gf-heat-cells">
              {row.map((c) => (
                <span
                  key={c.t}
                  className="gf-heat-cell"
                  title={`${dayLabel(c.t)} ${clock(c.t)}: ${c.value === null ? 'no data' : `${format(c.value)}${unit === '%' ? '' : ' '}${unit}`}`}
                  style={{
                    background:
                      c.value === null ? 'transparent' : `color-mix(in oklab, var(--heat-hi) ${pct(c.value)}%, var(--heat-lo))`,
                  }}
                />
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="gf-heat-hours" aria-hidden="true">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </figure>
  )
}

export function windShareCells(rows: MixRow[]): HeatCell[] {
  return rows.map((r) => {
    const total = totalGeneration(r)
    return { t: r.t, value: total > 0 ? (Math.max(r.wind, 0) / total) * 100 : null }
  })
}

// ---------------------------------------------------------------- latest mix bars (B side panel)

export function LatestMixBars({ row }: { row: MixRow }) {
  const total = totalGeneration(row)
  const bands = FUEL_BANDS.map((b) => ({ ...b, v: row[b.key] })).sort((a, b) => b.v - a.v)
  const max = Math.max(...bands.map((b) => Math.abs(b.v)))
  return (
    <div className="gf-now">
      <table>
        <tbody>
          {bands.map((b) => (
            <tr key={b.key}>
              <th scope="row">{b.label}</th>
              <td className="gf-now-bar">
                <span
                  style={{
                    width: `${(Math.abs(b.v) / max) * 100}%`,
                    background: fuelVar(b.key),
                    marginLeft: b.v < 0 ? 'auto' : undefined,
                  }}
                />
              </td>
              <td className="is-num">{fmt1(b.v)}</td>
              <td className="is-num gf-now-share">{b.v > 0 ? `${Math.round((b.v / total) * 100)}%` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="gf-now-total">
        Total generation {fmt1(total)} GW, at {clock(row.t)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------- metrics (forecast)

const METRIC_LABELS: Record<string, { label: string; fmt: (v: number) => string; rule: (t: number) => string }> = {
  coverage_nominal90: { label: '90% interval coverage', fmt: (v) => `${(v * 100).toFixed(1)}%`, rule: (t) => `at least ${(t * 100).toFixed(0)}%` },
  monotonicity: { label: 'Quantile crossings', fmt: (v) => fmt0(v), rule: (t) => `at most ${fmt0(t)}` },
  'pinball_q0.5': { label: 'Pinball loss, median', fmt: (v) => `${fmt0(v)} MW`, rule: (t) => `at most ${fmt0(t)} MW` },
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

export function FanKey({ fixture, fan }: { fixture?: boolean; fan: 'bands' | 'contours' | 'hairlines' }) {
  const dash = fixture ? '5 4' : undefined
  return (
    <ul className="gf-fan-key">
      <li>
        <svg width="22" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="22" y2="5" stroke="var(--chart-actual)" strokeWidth="2.5" />
        </svg>
        Actual (settled)
      </li>
      <li>
        <svg width="22" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="22" y2="5" stroke="var(--chart-fan)" strokeWidth="2.5" strokeDasharray={dash} />
        </svg>
        Median forecast{fixture ? ' (dashed: fixture)' : ''}
      </li>
      <li>
        {fan === 'bands' ? (
          <svg width="22" height="12" aria-hidden="true">
            <rect x="0" y="0" width="22" height="12" fill="var(--chart-fan)" fillOpacity="0.14" />
            <rect x="0" y="3" width="22" height="6" fill="var(--chart-fan)" fillOpacity="0.3" />
          </svg>
        ) : (
          <svg width="22" height="12" aria-hidden="true">
            {[1.5, 4.5, 7.5, 10.5].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="22"
                y2={y}
                stroke={fan === 'contours' ? 'var(--chart-fan-soft)' : 'var(--chart-fan)'}
                strokeOpacity={fan === 'hairlines' ? 0.6 : 1}
                strokeWidth="1"
                strokeDasharray={dash}
              />
            ))}
          </svg>
        )}
        {fan === 'bands' ? '50, 80 and 90% intervals' : 'Quantiles p5, p10, p25, p75, p90, p95'}
      </li>
    </ul>
  )
}
