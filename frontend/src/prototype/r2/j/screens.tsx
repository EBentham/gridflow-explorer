import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ForecastMetric } from '../../../api/types'
import { DataTable, fmt0, fmt1, money, niceTicks } from '../../../design/charts'
import { FUEL_BANDS, fuelVar, type MixRow } from '../../../design/fuels'
import { clock, dayLabel } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import { CoverageNote, RangeControl, Segmented, rangeText } from '../../controls'
import { useCoverageNote, useMix, usePrices, useRange } from '../../data'
import { WIND_FIXTURE_DAY, WIND_FIXTURE_METRICS, WIND_FIXTURE_MODEL, WIND_FIXTURE_VARIANT } from '../../fixtures/windForecast'
import { FanChartJ, GenerationChartJ, PriceChartJ, negativeRuns, perMwh } from './charts'

type View = 'chart' | 'table'
const VIEWS = [
  { value: 'chart' as View, label: 'Chart' },
  { value: 'table' as View, label: 'Table' },
]

/** GW with a true minus; means that round to zero keep two decimals so they never print as −0.0. */
const gw = (v: number) => {
  const txt = Math.abs(v) < 0.05 && v !== 0 ? Math.abs(v).toFixed(2) : fmt1(Math.abs(v))
  return `${v < 0 ? '−' : ''}${txt}`
}

const Id = ({ children }: { children: ReactNode }) => <code className="j-id">{children}</code>

function Status({ loading, error, empty }: { loading: boolean; error: Error | null; empty: boolean }) {
  if (error) return <p className="j-state is-error">Couldn't load this range: {error.message}</p>
  if (loading) return <p className="j-state">Loading the range from the local catalogue…</p>
  if (empty) return <p className="j-state">No local data in this range. Pick a range ending on or before the latest local day.</p>
  return null
}

function Head({ title, sub, stamp, badge }: { title: string; sub: string; stamp: string; badge?: ReactNode }) {
  return (
    <header className="j-head">
      <div className="j-head-title">
        <h1>{title}</h1>
        {badge}
      </div>
      <p className="j-head-sub">{sub}</p>
      <p className="j-head-stamp">{stamp}</p>
    </header>
  )
}

const windowText = (range: DateRange | null) => (range ? `${rangeText(range.start, range.end)}, UK time` : 'Waiting for the latest local day')

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

// ---------------------------------------------------------------- generation mix

interface Share {
  key: string
  label: string
  mean: number
  share: number
}

/** The R3-2 share-of-window bar: mean GW per fuel over the window, largest first. */
function ShareBar({ rows }: { rows: MixRow[] }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const { shares, total, outside } = useMemo(() => {
    const means = FUEL_BANDS.map((b) => ({ key: b.key, label: b.label, mean: rows.reduce((s, r) => s + (r[b.key] ?? 0), 0) / rows.length }))
    const inBar = means.filter((m) => m.mean > 0.005)
    const sum = inBar.reduce((s, m) => s + m.mean, 0)
    return {
      shares: inBar.map((m) => ({ ...m, share: m.mean / sum })).sort((a, b) => b.mean - a.mean) as Share[],
      total: sum,
      outside: means.filter((m) => m.mean <= 0.005),
    }
  }, [rows])
  const scale = niceTicks(0, total, 5).ticks.filter((t) => t < total - total * 0.04)
  let acc = 0
  const placed = shares.map((s) => {
    const left = acc
    acc += s.share
    return { ...s, left }
  })
  return (
    <figure className="j-fig">
      <h2 className="j-fig-title">Share of the window</h2>
      <div className="j-share" ref={ref}>
        <div className="j-share-labels" aria-hidden="true">
          {placed
            .filter((s) => s.share * width >= 80)
            .map((s) => (
              <span key={s.key} style={{ left: `${s.left * 100}%`, width: `${s.share * 100}%` }}>
                <b>{s.label}</b>
                {fmt1(s.mean)} GW, {Math.round(s.share * 100)}%
              </span>
            ))}
        </div>
        <div className="j-share-bar" role="img" aria-label={shares.map((s) => `${s.label} ${fmt1(s.mean)} GW, ${Math.round(s.share * 100)}%`).join('; ')}>
          {placed.map((s) => (
            <span key={s.key} style={{ width: `${s.share * 100}%`, background: fuelVar(s.key) }} title={`${s.label}: ${fmt1(s.mean)} GW, ${Math.round(s.share * 100)}%`} />
          ))}
        </div>
        <div className="j-share-scale" aria-hidden="true">
          {scale.map((t) => (
            <span key={t} style={{ left: `${(t / total) * 100}%` }}>
              {fmt0(t)}
            </span>
          ))}
          <span className="is-end" style={{ left: '100%' }}>
            {fmt1(total)} GW
          </span>
        </div>
      </div>
      <figcaption className="j-cap">
        Elexon BMRS feeds <Id>elexon/fuelhh</Id>, and its mean over {rows.length} half-hours draws this bar. The fuels in it sum to {fmt1(total)} GW
        {outside.length > 0 && (
          <>
            ; {outside.map((m) => `${m.label.toLowerCase()} averaged ${gw(m.mean)} GW`).join(' and ')}, so{' '}
            {outside.length > 1 ? 'they sit' : 'it sits'} outside it
          </>
        )}
        .
      </figcaption>
    </figure>
  )
}

function FuelKeyRow({ rows, focus, onPick }: { rows: MixRow[]; focus?: string; onPick: (k: string | undefined) => void }) {
  const means = useMemo(
    () => Object.fromEntries(FUEL_BANDS.map((b) => [b.key, rows.reduce((s, r) => s + (r[b.key] ?? 0), 0) / Math.max(1, rows.length)])),
    [rows],
  )
  return (
    <div className="j-key">
      <p className="j-key-title">{focus ? 'Select the fuel again to return to the full stack.' : 'Fuel, bottom of the stack first, with its mean GW. Select one to see it on its own.'}</p>
      <ul className="j-fuel-key">
        {FUEL_BANDS.map((b) => (
          <li key={b.key}>
            <button
              type="button"
              aria-pressed={focus === b.key}
              className={focus && focus !== b.key ? 'is-muted' : undefined}
              onClick={() => onPick(focus === b.key ? undefined : b.key)}
            >
              <span className="j-swatch" style={{ background: fuelVar(b.key) }} />
              {b.label}
              <span className="j-key-value">{gw(means[b.key])}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function GenerationScreenJ() {
  const { range } = useRange()
  const { rows, loading, error } = useMix(range)
  const cov = useCoverageNote('generation-mix', range)
  const [focus, setFocus] = useState<string | undefined>()
  const [view, setView] = useState<View>('chart')
  const band = FUEL_BANDS.find((b) => b.key === focus)
  const columns = [{ key: 't', label: 'Half-hour from' }, ...FUEL_BANDS.map((b) => ({ key: b.key, label: b.label, align: 'end' as const }))]
  const tableRows = rows.map((r) => ({ t: `${dayLabel(r.t)}, ${clock(r.t)}`, ...Object.fromEntries(FUEL_BANDS.map((b) => [b.key, fmt1(r[b.key])])) }))

  return (
    <section className="j-screen">
      <Head
        title={band ? `Generation mix: ${band.label}` : 'Generation mix'}
        sub="Half-hourly GB transmission-connected generation by fuel type. Pumping and net exports sit below zero."
        stamp={windowText(range)}
      />
      <div className="j-controls">
        <RangeControl />
        <Segmented label="View" options={VIEWS} value={view} onChange={setView} />
      </div>
      {cov && <CoverageNote missing={cov.missing_day_count} requested={cov.requested_day_count} />}
      <Status loading={loading} error={error} empty={!loading && rows.length === 0} />
      {!loading && rows.length > 0 && (
        <>
          <ShareBar rows={rows} />
          <figure className="j-fig">
            <h2 className="j-fig-title">{band ? `${band.label}, per half-hour` : 'Generation by fuel, per half-hour'}</h2>
            <FuelKeyRow rows={rows} focus={focus} onPick={setFocus} />
            {view === 'chart' ? <GenerationChartJ rows={rows} focus={focus} /> : <DataTable caption="Generation by fuel, GW per half-hour" columns={columns} rows={tableRows} />}
            <figcaption className="j-cap">
              Elexon BMRS feeds <Id>elexon/fuelhh</Id>, which draws this chart: generation by fuel type in GW for each half-hour, {range ? rangeText(range.start, range.end) : ''}, on the UK clock. Dashed rules
              mark midnight.
            </figcaption>
          </figure>
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- system prices

export function PricesScreenJ() {
  const { range } = useRange()
  const { rows, loading, error } = usePrices(range)
  const cov = useCoverageNote('system-prices', range)
  const [view, setView] = useState<View>('chart')
  const stats = useMemo(() => {
    const p = rows.map((r) => r.price).filter((v): v is number => v !== null)
    if (!p.length) return null
    return { mean: p.reduce((a, b) => a + b, 0) / p.length, min: Math.min(...p), max: Math.max(...p), negative: p.filter((v) => v < 0).length, n: p.length }
  }, [rows])
  const runs = useMemo(() => negativeRuns(rows), [rows])
  const columns = [
    { key: 't', label: 'Half-hour from' },
    { key: 'price', label: 'System price, £/MWh', align: 'end' as const },
    { key: 'niv', label: 'NIV, MWh', align: 'end' as const },
  ]
  const tableRows = rows.map((r) => ({
    t: `${dayLabel(r.t)}, ${clock(r.t)}`,
    price: r.price === null ? '–' : fmt1(r.price).replace('-', '−'),
    niv: r.niv === null ? '–' : fmt0(r.niv),
  }))

  return (
    <section className="j-screen">
      <Head
        title="System prices"
        sub="The imbalance price per half-hour, with net imbalance volume on the same clock. GB has been single-priced since 2015, so sell and buy are one line."
        stamp={windowText(range)}
      />
      <div className="j-controls">
        <RangeControl />
        <Segmented label="View" options={VIEWS} value={view} onChange={setView} />
      </div>
      {cov && <CoverageNote missing={cov.missing_day_count} requested={cov.requested_day_count} />}
      <Status loading={loading} error={error} empty={!loading && rows.length === 0} />
      {!loading && rows.length > 0 && (
        <figure className="j-fig">
          <h2 className="j-fig-title">System price and net imbalance volume</h2>
          {stats && (
            <dl className="j-stats">
              <div>
                <dt>Mean</dt>
                <dd>{perMwh(stats.mean)}</dd>
              </div>
              <div>
                <dt>Range</dt>
                <dd>
                  {money(stats.min, 2)} to {money(stats.max, 2)}
                </dd>
              </div>
              <div>
                <dt>Below zero</dt>
                <dd>
                  {stats.negative} of {stats.n} half-hours
                </dd>
              </div>
            </dl>
          )}
          <ul className="j-line-key">
            <li>
              <svg width="22" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="22" y2="5" stroke="var(--chart-price)" strokeWidth="2" />
              </svg>
              System price, £/MWh
            </li>
            <li>
              <svg width="12" height="12" aria-hidden="true">
                <rect x="3" y="0" width="6" height="12" fill="var(--chart-niv-short)" />
              </svg>
              NIV above zero, system short
            </li>
            <li>
              <svg width="12" height="12" aria-hidden="true">
                <rect x="3" y="0" width="6" height="12" fill="var(--chart-niv-long)" />
              </svg>
              NIV below zero, system long
            </li>
            {runs.length > 0 && (
              <li>
                <svg width="16" height="12" aria-hidden="true">
                  <rect x="0" y="0" width="16" height="12" fill="var(--band)" />
                </svg>
                Price below zero
              </li>
            )}
          </ul>
          {view === 'chart' ? <PriceChartJ rows={rows} /> : <DataTable caption="System price and NIV per half-hour" columns={columns} rows={tableRows} />}
          <figcaption className="j-cap">
            Elexon BMRS feeds <Id>elexon/system_prices</Id>: its <Id>system_sell_price</Id> column draws the line and <Id>net_imbalance_volume</Id> the bars, one value per half-hour,{' '}
            {range ? rangeText(range.start, range.end) : ''}, UK time.{' '}
            {runs.length > 0
              ? `The shaded bands are the ${runs.length === 1 ? 'one run' : `${runs.length} runs`} of half-hours priced below zero.`
              : 'No half-hour in this window is priced below zero, so nothing is shaded.'}
          </figcaption>
        </figure>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- wind forecast (fixture)

const METRICS: Record<string, { label: string; value: (v: number) => string; rule: (t: number) => string }> = {
  coverage_nominal90: { label: '90% interval coverage', value: (v) => `${(v * 100).toFixed(1)}%`, rule: (t) => `at least ${(t * 100).toFixed(0)}%` },
  monotonicity: { label: 'Quantile crossings', value: (v) => fmt0(v), rule: (t) => `at most ${fmt0(t)}` },
  'pinball_q0.5': { label: 'Pinball loss, median', value: (v) => `${fmt0(v)} MW`, rule: (t) => `at most ${fmt0(t)} MW` },
}

type GateState = 'pass' | 'fail' | 'unknown'
const gateState = (m: ForecastMetric): GateState => (m.gate_passed === null ? 'unknown' : m.gate_passed ? 'pass' : 'fail')
const STATE_TEXT: Record<GateState, string> = { pass: 'Pass', fail: 'Fail', unknown: 'Not gated' }

const G_ROW = 66
const G_NODE_X = 150

/** The run gates as a model tree (R3-2): each gate a node; branches join a trunk that feeds the run result. */
function GateTree({ metrics }: { metrics: ForecastMetric[] }) {
  const n = metrics.length
  const y = (i: number) => i * G_ROW + 22
  const finalY = n * G_ROW + 22
  const joinY = finalY - 30
  const branches = metrics.map((_, i) => `M${G_NODE_X - 9} ${y(i)} H78 Q58 ${y(i)} 58 ${y(i) + 20} V${joinY}`).join(' ')
  const allPass = metrics.every((m) => m.gate_passed !== false)
  return (
    <div className="j-gates">
      <svg className="j-gate-rail" width={G_NODE_X + 12} height={finalY + 14} aria-hidden="true">
        <path className="j-tree-line" d={`${branches} M58 ${joinY} V${finalY - 20} Q58 ${finalY} 78 ${finalY} H${G_NODE_X - 12}`} />
        <path className="j-tree-line" d={`M${G_NODE_X - 21} ${finalY - 5} L${G_NODE_X - 11} ${finalY} L${G_NODE_X - 21} ${finalY + 5}`} />
        <circle className="j-tree-junction" cx={58} cy={joinY} r={4.5} />
        <text className="j-tree-label" x={48} y={joinY + 4} textAnchor="end">
          gates
        </text>
        {metrics.map((m, i) => (
          <circle key={m.metric_name} className={`j-gate-node is-${gateState(m)}`} cx={G_NODE_X} cy={y(i)} r={9} />
        ))}
        <circle className={`j-gate-node is-run${allPass ? ' is-pass' : ' is-fail'}`} cx={G_NODE_X} cy={finalY} r={9} strokeDasharray="3.2 2.6" />
      </svg>
      <ul className="j-gate-rows">
        {metrics.map((m) => {
          const meta = METRICS[m.metric_name]
          const st = gateState(m)
          return (
            <li key={m.metric_name} style={{ height: G_ROW }}>
              <h3>{meta?.label ?? m.metric_name}</h3>
              <p>
                <span className="j-gate-value">{meta ? meta.value(m.metric_value) : m.metric_value.toFixed(4)}</span>
                {m.gate_threshold === null ? ', no gate' : `, gate ${meta ? meta.rule(m.gate_threshold) : m.gate_threshold}`}
              </p>
              <span className={`j-gate-state is-${st}`}>{STATE_TEXT[st]}</span>
            </li>
          )
        })}
        <li className="is-run" style={{ height: G_ROW }}>
          <h3>Run result</h3>
          <p>
            Fixture run over {metrics[0]?.n_folds ?? '?'} folds, <Id>{WIND_FIXTURE_MODEL}</Id>
          </p>
          <span className={`j-gate-state is-${allPass ? 'pass' : 'fail'}`}>{allPass ? 'All gates pass' : 'A gate fails'}</span>
        </li>
      </ul>
    </div>
  )
}

function FixtureBadge() {
  return (
    <span className="j-fixture" title="Synthetic data generated in the frontend. No wind model exists in the forecast store yet.">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.6 2.2" />
      </svg>
      Fixture: synthetic data, no wind model yet
    </span>
  )
}

export function WindScreenJ() {
  const [view, setView] = useState<View>('chart')
  const rows = WIND_FIXTURE_DAY
  const columns = [
    { key: 'sp', label: 'SP', align: 'end' as const },
    { key: 't', label: 'From' },
    { key: 'actual', label: 'Actual, MW', align: 'end' as const },
    { key: 'q50', label: 'Median, MW', align: 'end' as const },
    { key: 'i80', label: '80% interval, MW', align: 'end' as const },
  ]
  const tableRows = rows.map((r) => ({
    sp: String(r.settlement_period),
    t: clock(Date.parse(r.delivery_time)),
    actual: r.actual === null ? 'pending' : fmt0(r.actual),
    q50: fmt0(r['q_0.5']),
    i80: `${fmt0(r['q_0.1'])}–${fmt0(r['q_0.9'])}`,
  }))
  const caveat = WIND_FIXTURE_VARIANT.perfect_prog_caveat

  return (
    <section className="j-screen">
      <Head
        title="Wind forecast"
        sub="Day-ahead quantile forecast of GB wind generation against the settled actual. The view runs on a synthetic fixture until a wind model writes to the forecast store."
        stamp="For Tue 15 Sep 2026, issued Mon 14 Sep at 12:00 BST, UK time"
        badge={<FixtureBadge />}
      />
      <div className="j-controls">
        <Segmented label="View" options={VIEWS} value={view} onChange={setView} />
      </div>
      <figure className="j-fig">
        <h2 className="j-fig-title">GB wind generation, forecast and actual</h2>
        <ul className="j-line-key">
          <li>
            <svg width="22" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="22" y2="5" stroke="var(--chart-actual)" strokeWidth="2" />
            </svg>
            Actual, settled
          </li>
          <li>
            <svg width="22" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="22" y2="5" stroke="var(--chart-fan)" strokeWidth="2" strokeDasharray="5 4" />
            </svg>
            Median forecast, dashed as fixture
          </li>
          <li>
            <svg width="22" height="12" aria-hidden="true">
              <rect x="0" y="0" width="22" height="12" fill="var(--chart-fan)" fillOpacity="0.12" />
              <rect x="0" y="2" width="22" height="8" fill="var(--chart-fan)" fillOpacity="0.14" />
              <rect x="0" y="4" width="22" height="4" fill="var(--chart-fan)" fillOpacity="0.2" />
            </svg>
            50, 80 and 90% intervals
          </li>
        </ul>
        {view === 'chart' ? <FanChartJ records={rows} /> : <DataTable caption="Wind forecast by settlement period (fixture)" columns={columns} rows={tableRows} />}
        <figcaption className="j-cap">
          No model feeds this chart yet. The frontend generates <Id>{WIND_FIXTURE_MODEL}</Id> in the shape of the forecast store's day rows; gridflow_models will take over the cable
          when its wind model ships. Settlement periods are in the tooltip.
        </figcaption>
      </figure>
      <section className="j-fig" aria-labelledby="j-gates-h">
        <h2 className="j-fig-title" id="j-gates-h">
          Run gates
        </h2>
        <GateTree metrics={WIND_FIXTURE_METRICS} />
        <p className="j-cap">
          {caveat === true
            ? 'Scored with realised weather (perfect prog), so it flatters the model by the unmeasured weather-forecast error.'
            : caveat === false
              ? 'Scored on genuine day-ahead inputs, so the perfect-prog caveat does not apply. Every value here is fixture data.'
              : 'No metrics recorded for this run yet, so the perfect-prog caveat is unknown.'}
        </p>
      </section>
    </section>
  )
}
