import { useMemo, useState } from 'react'
import type { ForecastMetric } from '../../../api/types'
import { DataTable, TooltipBox, fmt0, niceTicks, toFanRows } from '../../../design/charts'
import { HALF_HOUR, clock, halfHourWindow } from '../../../design/time'
import { FixtureBadge } from '../../controls'
import { WIND_FIXTURE_DAY, WIND_FIXTURE_METRICS, WIND_FIXTURE_MODEL } from '../../fixtures/windForecast'
import { DayRules, TOP, TipAt, YAxis, useHover } from './chart'
import { gutOf, plOf, prOf, runsOf, scaleX, scaleY, useWidth, type Interval } from './geo'
import { CHART_H, Head, ViewToggle, type View } from './screens'
import { Id, Strata, type Layer } from './strata'

const HALF = HALF_HOUR / 2
const DASH = '5 4'

type FanRow = ReturnType<typeof toFanRows>[number]

const GATES: Record<string, { label: string; fmt: (v: number) => string; rule: (t: number) => string }> = {
  coverage_nominal90: { label: '90% interval coverage', fmt: (v) => `${(v * 100).toFixed(1)}%`, rule: (t) => `at least ${(t * 100).toFixed(0)}%` },
  monotonicity: { label: 'Quantile crossings', fmt: (v) => fmt0(v), rule: (t) => `at most ${fmt0(t)}` },
  'pinball_q0.5': { label: 'Pinball loss, median', fmt: (v) => `${fmt0(v)} MW`, rule: (t) => `at most ${fmt0(t)} MW` },
}

function GateIcon({ pass }: { pass: boolean | null }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray={pass === null ? '2 2' : undefined} />
      {pass === true && <path d="M4 7.2l2 2 4-4.4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
      {pass === false && <path d="M4.8 4.8l4.4 4.4M9.2 4.8l-4.4 4.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  )
}

function Gates({ metrics }: { metrics: ForecastMetric[] }) {
  return (
    <div className="g-gates">
      <p className="g-col-head">Run gates, fixture values</p>
      <ul>
        {metrics.map((m) => {
          const meta = GATES[m.metric_name]
          const state = m.gate_passed === null ? 'unknown' : m.gate_passed ? 'pass' : 'fail'
          return (
            <li key={m.metric_name}>
              <span className="g-gate-name">{meta?.label ?? m.metric_name}</span>
              <span className={`g-gate-result is-${state}`}>
                <GateIcon pass={m.gate_passed} />
                {state === 'pass' ? 'Pass' : state === 'fail' ? 'Fail' : 'Unknown'}
              </span>
              <span className="g-gate-rule">
                {meta ? meta.fmt(m.metric_value) : m.metric_value.toFixed(3)}, {m.gate_threshold === null ? 'no gate' : meta ? meta.rule(m.gate_threshold) : String(m.gate_threshold)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FanChartG({ rows, domain, width, height, onCursor }: { rows: FanRow[]; domain: Interval; width: number; height: number; onCursor: (t: number | null) => void }) {
  const pr = prOf(width)
  const hi = width - pr
  const PL = plOf(width)
  const { x } = scaleX(width, domain)
  const bottom = height - 3
  const yf = useMemo(() => {
    const v = rows.flatMap((r) => [r.q05, r.q95, r.actual ?? r.q50])
    return niceTicks(Math.min(0, ...v), Math.max(...v))
  }, [rows])
  const y = scaleY(yf.domain, TOP, bottom)
  const pts = (run: FanRow[], get: (r: FanRow) => number) => [
    [x(run[0].t), y(get(run[0]))] as const,
    ...run.map((r) => [x(r.t + HALF), y(get(r))] as const),
    [x(run[run.length - 1].t + HALF_HOUR), y(get(run[run.length - 1]))] as const,
  ]
  const line = (p: readonly (readonly [number, number])[]) => p.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
  const band = (lo: (r: FanRow) => number, up: (r: FanRow) => number) => {
    const a = pts(rows, up)
    const b = [...pts(rows, lo)].reverse()
    return `${line(a)} ${b.map(([px, py]) => `L${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')} Z`
  }
  const actualRuns = runsOf(rows.filter((r) => r.actual !== null))
  const lastActual = actualRuns.at(-1)?.at(-1)
  const lastRow = rows[rows.length - 1]

  const { hover, move, leave } = useHover(rows, width, domain, onCursor)
  const tip = hover?.row ? (
    <TooltipBox
      title={`SP ${hover.row.sp}, ${halfHourWindow(hover.row.t)}`}
      rows={[
        { key: 'a', color: 'var(--chart-actual)', label: 'Actual', value: hover.row.actual === null ? 'pending' : `${fmt0(hover.row.actual)} MW`, strong: true },
        { key: 'm', color: 'var(--chart-fan)', label: 'Median, fixture', value: `${fmt0(hover.row.q50)} MW`, dashed: true },
        { key: '80', color: 'var(--chart-fan-soft)', label: '80% interval', value: `${fmt0(hover.row.q10)}–${fmt0(hover.row.q90)}` },
        { key: '90', color: 'var(--chart-fan-soft)', label: '90% interval', value: `${fmt0(hover.row.q05)}–${fmt0(hover.row.q95)}` },
      ]}
      note="Synthetic fixture values"
    />
  ) : null

  return (
    <div className="g-plot" style={{ height }}>
      <svg width={width} height={height} className="g-plot-svg" aria-hidden="true">
        <YAxis ticks={yf.ticks} y={y} width={width} unit="MW" bottom={bottom} />
        <DayRules domain={domain} width={width} top={TOP} bottom={height} />
        <path d={band((r) => r.q05, (r) => r.q95)} fill="var(--chart-fan)" fillOpacity="0.12" />
        <path d={band((r) => r.q10, (r) => r.q90)} fill="var(--chart-fan)" fillOpacity="0.14" />
        <path d={band((r) => r.q25, (r) => r.q75)} fill="var(--chart-fan)" fillOpacity="0.22" />
        <path d={line(pts(rows, (r) => r.q50))} fill="none" stroke="var(--chart-fan)" strokeWidth="2" strokeDasharray={DASH} />
        {actualRuns.map((run) => (
          <path key={run[0].t} d={line(pts(run, (r) => r.actual as number))} fill="none" stroke="var(--chart-actual)" strokeWidth="2" strokeLinejoin="round" />
        ))}
        {lastActual && (
          <text x={x(lastActual.t + HALF_HOUR)} y={y(lastActual.actual as number) + 22} textAnchor="middle" className="g-note">
            Actual, settled to {clock(lastActual.t + HALF_HOUR)}
          </text>
        )}
        <text x={hi - 6} y={y(lastRow.q50) - 10} textAnchor="end" className="g-note">
          Median, fixture
        </text>
        <text x={PL + 10} y={TOP + 14} className="g-note g-note-fixture">
          Fixture: synthetic numbers generated in the browser, not a model run
        </text>
        {hover && <line x1={hover.px} x2={hover.px} y1={TOP} y2={height} stroke="var(--chart-cursor)" strokeWidth="1" />}
        <rect x={PL} y={TOP} width={Math.max(0, hi - PL)} height={height - TOP} fill="transparent" onPointerMove={move} onPointerLeave={leave} />
      </svg>
      <div className="g-col" style={{ left: hi + 18, top: TOP - 24, width: pr - gutOf(width) - 26 }}>
        <ul className="g-key">
          <li>
            <svg width="22" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="22" y2="5" stroke="var(--chart-actual)" strokeWidth="2.5" />
            </svg>
            Actual (settled)
          </li>
          <li>
            <svg width="22" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="22" y2="5" stroke="var(--chart-fan)" strokeWidth="2.5" strokeDasharray={DASH} />
            </svg>
            Median forecast (dashed: fixture)
          </li>
          <li>
            <svg width="22" height="12" aria-hidden="true">
              <rect x="0" y="0" width="22" height="12" fill="var(--chart-fan)" fillOpacity="0.14" />
              <rect x="0" y="3" width="22" height="6" fill="var(--chart-fan)" fillOpacity="0.3" />
            </svg>
            50, 80 and 90% intervals
          </li>
        </ul>
        <Gates metrics={WIND_FIXTURE_METRICS} />
      </div>
      <TipAt hover={hover} width={width} top={TOP + 6}>
        {tip}
      </TipAt>
    </div>
  )
}

export function WindG() {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [view, setView] = useState<View>('chart')
  const [cursor, setCursor] = useState<number | null>(null)
  const rows = useMemo(() => toFanRows(WIND_FIXTURE_DAY), [])
  const domain: Interval = [rows[0].t, rows[rows.length - 1].t + HALF_HOUR]

  const layers: Layer[] = [
    {
      kind: 'made',
      name: 'made ground',
      height: 84,
      terminal: {
        ids: ['fixtures/windForecast.ts'],
        body: 'Fixture: 48 synthetic half-hours built in the browser. Nothing below feeds it.',
      },
    },
    { kind: 'bronze', name: 'bronze', height: 52, empty: true, terminal: { ids: [], none: true, body: 'No vendor feed for a wind forecast yet.' } },
    { kind: 'silver', name: 'silver', height: 52, empty: true, terminal: { ids: [], none: true, body: 'No silver table for it yet.' } },
    {
      kind: 'gold',
      name: 'gold',
      height: 96,
      empty: true,
      terminal: {
        ids: ['/api/forecasts/day'],
        planned: true,
        body: (
          <>
            Planned source. Only <Id>day_ahead.lgbm_demand</Id> writes to the forecast store; no wind model does yet.
          </>
        ),
      },
    },
  ]

  const tableRows = rows.map((r) => ({
    sp: String(r.sp),
    t: clock(r.t),
    actual: r.actual === null ? 'pending' : fmt0(r.actual),
    q50: fmt0(r.q50),
    i80: `${fmt0(r.q10)}–${fmt0(r.q90)}`,
  }))
  const columns = [
    { key: 'sp', label: 'SP', align: 'end' as const },
    { key: 't', label: 'From, UK time' },
    { key: 'actual', label: 'Actual, MW', align: 'end' as const },
    { key: 'q50', label: 'Median, MW', align: 'end' as const },
    { key: 'i80', label: '80% interval, MW', align: 'end' as const },
  ]

  return (
    <section className="g-screen">
      <Head
        title="Wind forecast"
        badge={<FixtureBadge />}
        sub="Day-ahead quantile forecast of GB wind generation against the settled actual. This view runs on a synthetic fixture until a wind model writes to the forecast store."
        controls={<ViewToggle view={view} setView={setView} />}
      />
      <div className="g-section" ref={ref}>
        <p className="g-caption">
          Fixture <Id>{WIND_FIXTURE_MODEL}</Id>, MW per settlement period, for Tue 15 Sep 2026, issued Mon 14 Sep at 12:00 BST, UK time
        </p>
        {width > 0 &&
          (view === 'chart' ? (
            <FanChartG rows={rows} domain={domain} width={width} height={CHART_H} onCursor={setCursor} />
          ) : (
            <div className="g-table-slot" style={{ height: CHART_H }}>
              <DataTable caption="Wind forecast by settlement period (fixture)" columns={columns} rows={tableRows} />
            </div>
          ))}
        <Strata width={width} domain={domain} layers={layers} cursor={view === 'chart' ? cursor : null} cable="fixture" />
      </div>
    </section>
  )
}
