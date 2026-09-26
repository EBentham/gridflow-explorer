import { useMemo, useState, type ReactNode } from 'react'
import { DataTable, fmt0, fmt1, money } from '../../../design/charts'
import { FUEL_BANDS, fuelVar, totalGeneration } from '../../../design/fuels'
import { HALF_HOUR, clock, dayLabel } from '../../../design/time'
import { CoverageNote, FixtureBadge, RangeControl, Segmented } from '../../controls'
import { useCoverageNote, useRange } from '../../data'
import { WIND_FIXTURE_DAY, WIND_FIXTURE_METRICS, WIND_FIXTURE_MODEL, WIND_FIXTURE_VARIANT } from '../../fixtures/windForecast'
import { MetricsPanel } from '../../pieces'
import { FFanChart, FGenerationChart, FPriceCharts, ShareBar, type Band, type Mark, type ShareItem } from './charts'
import { useFData, when, windShareSeries, windowText } from './series'

type View = 'chart' | 'table'
const VIEWS: { value: View; label: string }[] = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
]

function Head({ title, sub, badge, stamp }: { title: string; sub: string; badge?: ReactNode; stamp?: string }) {
  return (
    <header className="f-head">
      <div className="f-head-title">
        <h1>{title}</h1>
        {badge}
      </div>
      <div className="f-head-sub">
        <p>{sub}</p>
        {stamp && <p className="f-stamp">{stamp}</p>}
      </div>
    </header>
  )
}

function Status({ loading, error, empty }: { loading: boolean; error: Error | null; empty: boolean }) {
  if (error) return <p className="f-state is-error">This range didn't load: {error.message}. Pick another range or check the API on port 8000.</p>
  if (loading) return <p className="f-state">Loading the range from the local catalogue…</p>
  if (empty) return <p className="f-state">No local data in this range. Pick a range that ends on or before the latest local day.</p>
  return null
}

function Figure({ title, keyRow, caption, children }: { title: string; keyRow?: ReactNode; caption: ReactNode; children: ReactNode }) {
  return (
    <figure className="f-fig">
      <h2 className="f-fig-head">{title}</h2>
      {keyRow}
      {children}
      <figcaption className="f-figcap">{caption}</figcaption>
    </figure>
  )
}

function LineSwatch({ color, dash }: { color: string; dash?: string }) {
  return (
    <svg width="22" height="10" aria-hidden="true">
      <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2" strokeDasharray={dash} />
    </svg>
  )
}

function BlockSwatch({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <svg width="14" height="12" aria-hidden="true">
      <rect width="14" height="12" fill={color} fillOpacity={opacity} />
    </svg>
  )
}

const spanWords = (bin: number) => (bin <= 1 ? 'half-hour' : bin === 2 ? 'hour' : `${bin / 2} hours`)

// ---------------------------------------------------------------- generation mix

export function FGenerationScreen() {
  const { range } = useRange()
  const { mix } = useFData()
  const { rows, loading, error } = mix
  const cov = useCoverageNote('generation-mix', range)
  const [focus, setFocus] = useState<string | undefined>()
  const [view, setView] = useState<View>('chart')
  const latest = rows.at(-1)
  const focusBand = FUEL_BANDS.find((b) => b.key === focus)
  const horizon = useMemo(() => windShareSeries(rows), [rows])
  const domain: [number, number] = [rows[0]?.t ?? 0, rows.at(-1)?.t ?? 0]
  const win = range ? windowText(range) : ''

  const mark = useMemo((): Mark | null => {
    if (!rows.length) return null
    const span: [number, number] = [rows[0].t, rows[rows.length - 1].t]
    const top = (r: (typeof rows)[number]) => (focus ? Math.max(r[focus], 0) : totalGeneration(r))
    const best = rows.reduce((a, b) => (top(b) > top(a) ? b : a))
    const name = FUEL_BANDS.find((b) => b.key === focus)?.label.toLowerCase() ?? 'total'
    return { t: best.t, v: top(best), value: `${fmt1(top(best))} GW`, desc: `highest ${name}, ${when(best.t, span)}`, place: 'above' }
  }, [rows, focus])
  const band: Band | null = horizon ? { t0: horizon.max.t0, t1: horizon.max.t1 } : null

  const share = useMemo(() => {
    if (!rows.length) return null
    const means = FUEL_BANDS.map((b) => ({ key: b.key, label: b.label, gw: rows.reduce((s, r) => s + r[b.key], 0) / rows.length }))
    const drawn: ShareItem[] = means.filter((m) => m.gw > 0.005).sort((a, b) => b.gw - a.gw)
    const total = drawn.reduce((s, m) => s + m.gw, 0)
    return { drawn, total, negative: means.filter((m) => m.gw < -0.005), narrow: drawn.filter((m) => m.gw / total < 0.075) }
  }, [rows])

  const tableRows = rows.map((r) => ({
    t: `${dayLabel(r.t)}, ${clock(r.t)}`,
    ...Object.fromEntries(FUEL_BANDS.map((b) => [b.key, fmt1(r[b.key])])),
  }))
  const columns = [{ key: 't', label: 'Half-hour from' }, ...FUEL_BANDS.map((b) => ({ key: b.key, label: b.label, align: 'end' as const }))]

  const keyRow = (
    <div className="f-key">
      <p className="f-key-note">
        {latest ? `GW in the last half-hour, ${clock(latest.t)} ${dayLabel(latest.t)}. ` : ''}
        {focus ? 'Select the fuel again to return to the full stack.' : 'Select a fuel to see it on its own.'}
      </p>
      <ul className="f-key-row">
        {FUEL_BANDS.map((b) => (
          <li key={b.key} className={focus === b.key ? 'is-focus' : focus ? 'is-muted' : undefined}>
            <button type="button" aria-pressed={focus === b.key} onClick={() => setFocus(focus === b.key ? undefined : b.key)}>
              <span className="f-swatch" style={{ background: fuelVar(b.key) }} />
              <span>{b.label}</span>
              {latest && <span className="f-key-v">{fmt1(latest[b.key])}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <section className="f-screen">
      <Head
        title={focusBand ? `Generation mix: ${focusBand.label}` : 'Generation mix'}
        sub="Half-hourly GB transmission-connected generation by fuel type, from Elexon FUELHH. Pumping and net exports sit below zero."
      />
      <div className="f-toolbar">
        <RangeControl />
        <Segmented label="View" options={VIEWS} value={view} onChange={setView} />
      </div>
      {cov && <CoverageNote missing={cov.missing_day_count} requested={cov.requested_day_count} />}
      <Status loading={loading} error={error} empty={!loading && rows.length === 0} />
      {!loading && rows.length > 0 && (
        <>
          <Figure
            title={focusBand ? `${focusBand.label} generation` : 'Generation by fuel type'}
            keyRow={view === 'chart' ? keyRow : undefined}
            caption={
              <>
                Elexon <code>fuelhh</code>, eleven fuel columns folded into nine bands, {win}, in GW; the stack's top edge is total generation.
                {mark && ' The ring marks its highest half-hour.'}
                {horizon &&
                  ` The band marks the ${spanWords(horizon.bin)} from ${when(horizon.max.t0, domain)} with the highest wind share, ${Math.round(horizon.max.v)}%: the peak of the horizon above.`}
              </>
            }
          >
            {view === 'chart' ? (
              <FGenerationChart rows={rows} focus={focus} band={band} marks={mark ? [mark] : []} />
            ) : (
              <DataTable caption="Generation by fuel, GW per half-hour" columns={columns} rows={tableRows} />
            )}
          </Figure>
          {share && share.total > 0 && (
            <Figure
              title="Share of the window"
              caption={
                <>
                  Elexon <code>fuelhh</code>: mean generation by fuel across {rows.length} settlement periods, {win}, in GW; the fuels drawn sum to{' '}
                  {fmt1(share.total)} GW.
                  {share.narrow.length > 0 &&
                    ` Too narrow to name on the bar: ${share.narrow.map((n) => `${n.label.toLowerCase()} ${fmt1(n.gw)} GW`).join(', ')}.`}
                  {share.negative.length > 0 &&
                    ` Left off the bar because they average below zero: ${share.negative.map((n) => `${n.label.toLowerCase()} ${fmt1(n.gw).replace('-', '−')} GW`).join(', ')}.`}
                </>
              }
            >
              <ShareBar items={share.drawn} total={share.total} />
            </Figure>
          )}
        </>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- system prices

export function FPricesScreen() {
  const { range } = useRange()
  const { prices } = useFData()
  const { rows, loading, error } = prices
  const cov = useCoverageNote('system-prices', range)
  const [view, setView] = useState<View>('chart')
  const win = range ? windowText(range) : ''
  const domain: [number, number] = [rows[0]?.t ?? 0, rows.at(-1)?.t ?? 0]

  const facts = useMemo(() => {
    const valid = rows.filter((r): r is typeof r & { price: number } => r.price !== null)
    if (!valid.length) return null
    const hi = valid.reduce((a, b) => (b.price > a.price ? b : a))
    const lo = valid.reduce((a, b) => (b.price < a.price ? b : a))
    const mean = valid.reduce((s, r) => s + r.price, 0) / valid.length
    // Longest run of consecutive negative half-hours.
    let best: { start: number; n: number } | null = null
    let run: { start: number; n: number } | null = null
    for (const r of rows) {
      if (r.price !== null && r.price < 0) {
        run = run ? { start: run.start, n: run.n + 1 } : { start: r.t, n: 1 }
        if (!best || run.n > best.n) best = run
      } else run = null
    }
    const nivRows = rows.filter((r): r is typeof r & { niv: number } => r.niv !== null)
    const widest = nivRows.length ? nivRows.reduce((a, b) => (Math.abs(b.niv) > Math.abs(a.niv) ? b : a)) : null
    return { hi, lo, mean, negative: valid.filter((r) => r.price < 0).length, n: valid.length, run: best, widest }
  }, [rows])

  const band: Band | null = facts?.run
    ? { t0: facts.run.start, t1: facts.run.start + facts.run.n * HALF_HOUR * 0.999 }
    : facts?.widest
      ? { t0: facts.widest.t, t1: facts.widest.t + HALF_HOUR * 0.999 }
      : null
  const marks: Mark[] = facts
    ? [
        { t: facts.hi.t, v: facts.hi.price, value: `${money(facts.hi.price, 2)}/MWh`, desc: `highest, ${when(facts.hi.t, domain)}`, place: 'above' },
        { t: facts.lo.t, v: facts.lo.price, value: `${money(facts.lo.price, 2)}/MWh`, desc: `lowest, ${when(facts.lo.t, domain)}`, place: 'below' },
      ]
    : []

  const tableRows = rows.map((r) => ({
    t: `${dayLabel(r.t)}, ${clock(r.t)}`,
    price: r.price === null ? '–' : fmt1(r.price).replace('-', '−'),
    niv: r.niv === null ? '–' : fmt0(r.niv),
  }))
  const columns = [
    { key: 't', label: 'Half-hour from' },
    { key: 'price', label: 'System price, £/MWh', align: 'end' as const },
    { key: 'niv', label: 'NIV, MWh', align: 'end' as const },
  ]

  const keyRow = (
    <ul className="f-key-row is-static">
      <li>
        <LineSwatch color="var(--chart-price)" />
        System price, £/MWh (sell = buy)
      </li>
      <li>
        <BlockSwatch color="var(--chart-niv-short)" />
        NIV above zero: system short
      </li>
      <li>
        <BlockSwatch color="var(--chart-niv-long)" />
        NIV below zero: system long
      </li>
      <li>
        <BlockSwatch color="var(--f-band-key)" />
        {facts?.run ? 'Longest run below £0' : 'Largest imbalance'}
      </li>
    </ul>
  )

  return (
    <section className="f-screen">
      <Head
        title="System prices"
        sub="The Elexon imbalance price per half-hour, with net imbalance volume below it on the same clock. GB has been single-priced since 2015, so sell and buy are one line."
      />
      <div className="f-toolbar">
        <RangeControl />
        <Segmented label="View" options={VIEWS} value={view} onChange={setView} />
      </div>
      {cov && <CoverageNote missing={cov.missing_day_count} requested={cov.requested_day_count} />}
      <Status loading={loading} error={error} empty={!loading && rows.length === 0} />
      {!loading && rows.length > 0 && (
        <Figure
          title="System price and net imbalance volume"
          keyRow={view === 'chart' ? keyRow : undefined}
          caption={
            <>
              Elexon <code>system_prices</code>, columns <code>system_sell_price</code> (equal to <code>system_buy_price</code>) and{' '}
              <code>net_imbalance_volume</code>, {win}, in £/MWh and MWh.
              {facts && ` Mean ${money(facts.mean, 2)}/MWh; ${facts.negative} of ${facts.n} half-hours below zero.`}
              {facts?.run &&
                ` The band marks the longest run below zero: ${facts.run.n} ${facts.run.n === 1 ? 'half-hour' : 'half-hours'} from ${when(facts.run.start, domain)}.`}
              {!facts?.run && facts?.widest && ` The band marks the largest imbalance, ${fmt0(facts.widest.niv)} MWh at ${when(facts.widest.t, domain)}.`}
            </>
          }
        >
          {view === 'chart' ? (
            <FPriceCharts rows={rows} band={band} marks={marks} />
          ) : (
            <DataTable caption="System price and NIV per half-hour" columns={columns} rows={tableRows} />
          )}
        </Figure>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- wind forecast (fixture)

export function FWindScreen() {
  const [view, setView] = useState<View>('chart')
  const rows = WIND_FIXTURE_DAY

  const facts = useMemo(() => {
    const widest = rows.reduce((a, b) => (b['q_0.95'] - b['q_0.05'] > a['q_0.95'] - a['q_0.05'] ? b : a))
    const settled = rows.filter((r): r is typeof r & { actual: number } => r.actual !== null)
    const miss = settled.reduce((a, b) => (Math.abs(b.actual - b['q_0.5']) > Math.abs(a.actual - a['q_0.5']) ? b : a))
    return { widest, miss, settled: settled.length }
  }, [rows])

  const wt = Date.parse(facts.widest.delivery_time)
  const mt = Date.parse(facts.miss.delivery_time)
  const gap = facts.miss.actual - facts.miss['q_0.5']
  const band: Band = { t0: wt, t1: wt + HALF_HOUR * 0.999 }
  const marks: Mark[] = [
    {
      t: mt,
      v: facts.miss.actual,
      value: `${fmt0(Math.abs(gap))} MW ${gap > 0 ? 'above' : 'below'} the median`,
      desc: `largest miss, ${clock(mt)}`,
      place: gap > 0 ? 'above' : 'below',
    },
  ]

  const tableRows = rows.map((r) => ({
    sp: String(r.settlement_period),
    t: clock(Date.parse(r.delivery_time)),
    actual: r.actual === null ? 'pending' : fmt0(r.actual),
    q50: fmt0(r['q_0.5']),
    i80: `${fmt0(r['q_0.1'])}–${fmt0(r['q_0.9'])}`,
  }))
  const columns = [
    { key: 'sp', label: 'SP', align: 'end' as const },
    { key: 't', label: 'From' },
    { key: 'actual', label: 'Actual, MW', align: 'end' as const },
    { key: 'q50', label: 'Median, MW', align: 'end' as const },
    { key: 'i80', label: '80% interval, MW', align: 'end' as const },
  ]

  const keyRow = (
    <ul className="f-key-row is-static">
      <li>
        <LineSwatch color="var(--chart-actual)" />
        Actual, settled
      </li>
      <li>
        <LineSwatch color="var(--chart-fan)" dash="5 4" />
        Median forecast, dashed as fixture
      </li>
      <li>
        <BlockSwatch color="var(--chart-fan)" opacity={0.44} />
        50% interval
      </li>
      <li>
        <BlockSwatch color="var(--chart-fan)" opacity={0.24} />
        80% interval
      </li>
      <li>
        <BlockSwatch color="var(--chart-fan)" opacity={0.1} />
        90% interval
      </li>
      <li>
        <BlockSwatch color="var(--f-band-key)" />
        Widest 90% interval
      </li>
    </ul>
  )

  return (
    <section className="f-screen">
      <Head
        title="Wind forecast"
        sub="Day-ahead quantile forecast of GB wind generation against the settled actual. This view runs on a synthetic fixture until the wind model writes to the forecast store."
        stamp="For Tue 15 Sep 2026, issued Mon 14 Sep at 12:00 BST, UK time"
        badge={<FixtureBadge />}
      />
      <div className="f-toolbar">
        <p className="f-toolbar-note">One fixed forecast day; the range control returns with the real model.</p>
        <Segmented label="View" options={VIEWS} value={view} onChange={setView} />
      </div>
      <Figure
        title="Wind generation, forecast and actual"
        keyRow={view === 'chart' ? keyRow : undefined}
        caption={
          <>
            Fixture <code>{WIND_FIXTURE_MODEL}</code>, shaped like gridflow's forecast-day rows: quantiles <code>q_0.05</code> to <code>q_0.95</code> and the
            settled <code>actual</code>, Tue 15 Sep 2026, in MW. Every value is synthetic. {facts.settled} of 48 half-hours have settled. The band marks{' '}
            {clock(wt)}, where the 90% interval is widest ({fmt0(facts.widest['q_0.05'])}–{fmt0(facts.widest['q_0.95'])} MW); the ring marks the largest gap
            between actual and median.
          </>
        }
      >
        {view === 'chart' ? (
          <FFanChart records={rows} band={band} marks={marks} />
        ) : (
          <DataTable caption="Wind forecast by settlement period (fixture)" columns={columns} rows={tableRows} />
        )}
      </Figure>
      <section className="f-gates" aria-labelledby="f-gates-h">
        <h2 id="f-gates-h" className="f-fig-head">
          Run gates
        </h2>
        <MetricsPanel metrics={WIND_FIXTURE_METRICS} caveat={WIND_FIXTURE_VARIANT.perfect_prog_caveat} />
      </section>
    </section>
  )
}
