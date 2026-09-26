/**
 * Slot i screens: a panel-dense workspace. Every screen is the same frame
 * (emblem head, one toolbar row, a main chart panel with its key beside it,
 * and two working panels below), so the eye learns one layout and scans.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { DataTable, FuelKey, fmt0, fmt1, money } from '../../../design/charts'
import { FUEL_BANDS, totalGeneration, type MixRow } from '../../../design/fuels'
import { clock, dayLabel, londonMidnight, zoneAbbrev } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import { CoverageNote, RangeControl, Segmented, rangeText } from '../../controls'
import { useCoverageNote, useMix, usePrices, useRange } from '../../data'
import { WIND_FIXTURE_DATE, WIND_FIXTURE_DAY, WIND_FIXTURE_METRICS, WIND_FIXTURE_MODEL, WIND_FIXTURE_POLICY, WIND_FIXTURE_VARIANT } from '../../fixtures/windForecast'
import { MetricsPanel } from '../../pieces'
import { MixBar, NightFanChart, NightGenerationChart, NightPriceChart, meanMix, negativeRuns } from './charts'
import { Emblem, type GlyphKind } from './glyphs'

type View = 'chart' | 'table'

// ---------------------------------------------------------------- frame pieces

export function Head({ kind, title, sub, stamp, badge }: { kind: GlyphKind; title: string; sub: string; stamp?: string; badge?: ReactNode }) {
  return (
    <header className="i-head">
      <Emblem kind={kind} />
      <div className="i-head-text">
        <div className="i-head-title">
          <h1>{title}</h1>
          {badge}
        </div>
        <p className="i-head-sub">{sub}</p>
        {stamp && <p className="i-head-stamp">{stamp}</p>}
      </div>
    </header>
  )
}

export function Panel({ title, src, tag, className, children }: { title: string; src?: ReactNode; tag?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`i-panel${className ? ` ${className}` : ''}`}>
      <header className="i-panel-head">
        <h2>{title}</h2>
        {tag}
      </header>
      {src && <p className="i-src">{src}</p>}
      {children}
    </section>
  )
}

function Status({ loading, error, empty }: { loading: boolean; error: Error | null; empty: boolean }) {
  if (error) return <p className="gf-state is-error">Couldn't load this range: {error.message}</p>
  if (loading) return <p className="gf-state">Loading the range from the local catalogue…</p>
  if (empty) return <p className="gf-state">No local data in this range. Pick a range ending on or before the latest local day.</p>
  return null
}

export function FixtureTag({ children }: { children?: ReactNode }) {
  return (
    <span className="i-fixture" title="Synthetic data generated in the frontend. No wind model writes to the forecast store yet.">
      {children ?? 'Fixture data: no wind model yet'}
    </span>
  )
}

const windowText = (range: DateRange | null) => (range ? rangeText(range.start, range.end) : '')

function groupDays<T extends { t: number }>(rows: T[]): { d: number; rows: T[] }[] {
  const map = new Map<number, T[]>()
  for (const r of rows) {
    const d = londonMidnight(r.t)
    const list = map.get(d)
    if (list) list.push(r)
    else map.set(d, [r])
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([d, list]) => ({ d, rows: list }))
}

const pctText = (v: number) => `${Math.round(v * 100)}%`

// ---------------------------------------------------------------- generation mix

function share(rows: MixRow[], key: string): number {
  const tot = rows.reduce((s, r) => s + totalGeneration(r), 0)
  return tot > 0 ? rows.reduce((s, r) => s + Math.max(r[key] ?? 0, 0), 0) / tot : 0
}

export function GenerationScreen() {
  const { range } = useRange()
  const { rows, loading, error } = useMix(range)
  const cov = useCoverageNote('generation-mix', range)
  const [focus, setFocus] = useState<string | undefined>()
  const [view, setView] = useState<View>('chart')
  const [picked, setPicked] = useState<number | undefined>()
  const days = useMemo(() => groupDays(rows), [rows])
  const day = days.find((d) => d.d === picked) ?? days.at(-1)
  const latest = rows.at(-1)
  const focusBand = FUEL_BANDS.find((b) => b.key === focus)
  const means = useMemo(() => meanMix(day?.rows ?? []), [day])
  const ready = !loading && rows.length > 0

  const columns = [{ key: 't', label: 'Half-hour from' }, ...FUEL_BANDS.map((b) => ({ key: b.key, label: b.label, align: 'end' as const }))]
  const tableRows = rows.map((r) => ({ t: `${dayLabel(r.t)}, ${clock(r.t)}`, ...Object.fromEntries(FUEL_BANDS.map((b) => [b.key, fmt1(r[b.key])])) }))

  return (
    <section className="gf-screen i-screen">
      <Head
        kind="pylon"
        title={focusBand ? `Generation mix: ${focusBand.label}` : 'Generation mix'}
        sub="Half-hourly GB transmission-connected generation by fuel type. Pumping and net exports sit below zero."
        stamp={range ? `${windowText(range)}, UK time` : undefined}
      />
      <div className="i-toolbar">
        <RangeControl />
        <Segmented label="View" options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} value={view} onChange={setView} />
      </div>
      {cov && <CoverageNote missing={cov.missing_day_count} requested={cov.requested_day_count} />}
      <div className="i-grid">
        <Panel
          className="i-p-main"
          title={focusBand ? `${focusBand.label} generation` : 'Generation by fuel'}
          src={
            <>
              Elexon <code>fuelhh</code>, generation per half-hour, GW, {windowText(range)}
            </>
          }
        >
          <Status loading={loading} error={error} empty={!loading && rows.length === 0} />
          {ready &&
            (view === 'chart' ? (
              <NightGenerationChart rows={rows} focus={focus} day={day?.d} onPickDay={setPicked} />
            ) : (
              <DataTable caption="Generation by fuel, GW" columns={columns} rows={tableRows} />
            ))}
        </Panel>

        <Panel className="i-p-key" title="Fuel" src={latest ? `GW in the half-hour from ${clock(latest.t)}, ${dayLabel(latest.t)}` : undefined}>
          <FuelKey latest={latest} onPick={setFocus} focus={focus} />
          <p className="i-hint">{focus ? 'Select the fuel again to return to the full stack.' : 'Select a fuel to draw it on its own.'}</p>
        </Panel>

        <Panel
          className="i-p-wide"
          title={day ? `Mean mix, ${dayLabel(day.d)}` : 'Mean mix'}
          src={
            day ? (
              <>
                Elexon <code>fuelhh</code>: mean generation by fuel across {day.rows.length} settlement periods, in GW
              </>
            ) : undefined
          }
        >
          {ready && day ? <MixBar means={means} /> : <p className="i-hint">Waiting for the range.</p>}
        </Panel>

        <Panel className="i-p-side" title="Days in range" src="Select a day to mark it on the chart and read its mean mix.">
          {ready && (
            <div className="i-days">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col" className="is-num">
                      Mean, GW
                    </th>
                    <th scope="col" className="is-num">
                      Wind
                    </th>
                    <th scope="col" className="is-num">
                      CCGT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const on = d.d === day?.d
                    const mean = d.rows.reduce((s, r) => s + totalGeneration(r), 0) / d.rows.length
                    return (
                      <tr key={d.d} className={on ? 'is-on' : undefined}>
                        <th scope="row">
                          <button type="button" aria-pressed={on} onClick={() => setPicked(d.d)}>
                            {dayLabel(d.d)}
                          </button>
                        </th>
                        <td className="is-num">{fmt1(mean)}</td>
                        <td className="is-num">{pctText(share(d.rows, 'wind'))}</td>
                        <td className="is-num">{pctText(share(d.rows, 'gas'))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- system prices

export function PricesScreen() {
  const { range } = useRange()
  const { rows, loading, error } = usePrices(range)
  const cov = useCoverageNote('system-prices', range)
  const [view, setView] = useState<View>('chart')
  const ready = !loading && rows.length > 0
  const runs = useMemo(() => negativeRuns(rows), [rows])
  const days = useMemo(() => groupDays(rows), [rows])

  const stats = useMemo(() => {
    const p = rows.map((r) => r.price).filter((v): v is number => v !== null)
    const n = rows.map((r) => r.niv).filter((v): v is number => v !== null)
    if (!p.length) return null
    return {
      mean: p.reduce((a, b) => a + b, 0) / p.length,
      negative: p.filter((v) => v < 0).length,
      count: p.length,
      short: n.length ? n.filter((v) => v > 0).length / n.length : null,
    }
  }, [rows])

  const columns = [
    { key: 't', label: 'Half-hour from' },
    { key: 'price', label: 'System price, £/MWh', align: 'end' as const },
    { key: 'niv', label: 'NIV, MWh', align: 'end' as const },
  ]
  const tableRows = rows.map((r) => ({
    t: `${dayLabel(r.t)}, ${clock(r.t)}`,
    price: r.price === null ? '–' : money(r.price, 2),
    niv: r.niv === null ? '–' : fmt0(r.niv),
  }))

  return (
    <section className="gf-screen i-screen">
      <Head
        kind="meter"
        title="System prices"
        sub="The imbalance price per half-hour, with net imbalance volume on the same clock. GB has been single-priced since 2015, so sell and buy are one line."
        stamp={range ? `${windowText(range)}, UK time` : undefined}
      />
      <div className="i-toolbar">
        <RangeControl />
        <Segmented label="View" options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} value={view} onChange={setView} />
      </div>
      {cov && <CoverageNote missing={cov.missing_day_count} requested={cov.requested_day_count} />}
      <div className="i-grid">
        <Panel
          className="i-p-main"
          title="System price and net imbalance volume"
          src={
            <>
              Elexon <code>system_prices</code>, columns <code>system_sell_price</code> and <code>net_imbalance_volume</code>, {windowText(range)}
            </>
          }
        >
          <Status loading={loading} error={error} empty={!loading && rows.length === 0} />
          {ready &&
            (view === 'chart' ? <NightPriceChart rows={rows} /> : <DataTable caption="System price and NIV per half-hour" columns={columns} rows={tableRows} />)}
        </Panel>

        <Panel className="i-p-key" title="Key">
          <ul className="i-key">
            <li>
              <svg width="22" height="10" aria-hidden="true">
                <line x1="0" y1="5" x2="22" y2="5" stroke="var(--chart-price)" strokeWidth="2" />
              </svg>
              System price, £/MWh
            </li>
            <li>
              <span className="i-key-band" aria-hidden="true" />
              Price below zero
            </li>
            <li>
              <svg width="22" height="10" aria-hidden="true">
                <rect x="4" y="0" width="5" height="10" fill="var(--chart-niv-short)" />
                <rect x="12" y="3" width="5" height="7" fill="var(--chart-niv-short)" />
              </svg>
              NIV above zero: system short
            </li>
            <li>
              <svg width="22" height="10" aria-hidden="true">
                <rect x="4" y="0" width="5" height="10" fill="var(--chart-niv-long)" />
                <rect x="12" y="0" width="5" height="6" fill="var(--chart-niv-long)" />
              </svg>
              NIV below zero: system long
            </li>
          </ul>
          {stats && (
            <dl className="i-stats">
              <div>
                <dt>Mean price</dt>
                <dd>{money(stats.mean, 2)}</dd>
              </div>
              <div>
                <dt>Half-hours below zero</dt>
                <dd>
                  {stats.negative} of {stats.count}
                </dd>
              </div>
              {stats.short !== null && (
                <div>
                  <dt>System short</dt>
                  <dd>{pctText(stats.short)} of half-hours</dd>
                </div>
              )}
            </dl>
          )}
        </Panel>

        <Panel className="i-p-wide" title="Days in range" src="Price in £/MWh; NIV sign read per half-hour.">
          {ready && (
            <div className="i-days">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col" className="is-num">
                      Mean
                    </th>
                    <th scope="col" className="is-num">
                      Lowest
                    </th>
                    <th scope="col" className="is-num">
                      Highest
                    </th>
                    <th scope="col" className="is-num">
                      Below zero
                    </th>
                    <th scope="col" className="is-num">
                      System short
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    const p = d.rows.map((r) => r.price).filter((v): v is number => v !== null)
                    const n = d.rows.map((r) => r.niv).filter((v): v is number => v !== null)
                    const neg = p.filter((v) => v < 0).length
                    return (
                      <tr key={d.d}>
                        <th scope="row">{dayLabel(d.d)}</th>
                        <td className="is-num">{p.length ? money(p.reduce((a, b) => a + b, 0) / p.length, 2) : '–'}</td>
                        <td className="is-num">{p.length ? money(Math.min(...p), 2) : '–'}</td>
                        <td className="is-num">{p.length ? money(Math.max(...p), 2) : '–'}</td>
                        <td className={`is-num${neg ? ' is-flag' : ''}`}>{neg}</td>
                        <td className="is-num">{n.length ? pctText(n.filter((v) => v > 0).length / n.length) : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel className="i-p-side" title="Below zero" src="Runs of consecutive half-hours with a negative system price.">
          {ready &&
            (runs.length === 0 ? (
              <p className="i-hint">No half-hour in this range settled below zero.</p>
            ) : (
              <ol className="i-runs">
                {runs.map((r) => (
                  <li key={r.start}>
                    <span className="i-runs-when">
                      {dayLabel(r.start)}, {clock(r.start)}–{clock(r.last + 30 * 60e3)}
                    </span>
                    <span className="i-runs-what">
                      {r.n} half-hour{r.n === 1 ? '' : 's'}, low {money(r.min, 2)}
                    </span>
                  </li>
                ))}
              </ol>
            ))}
        </Panel>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- wind forecast (fixture)

export function WindScreen() {
  const [view, setView] = useState<View>('chart')
  const rows = WIND_FIXTURE_DAY
  const written = Date.parse(WIND_FIXTURE_VARIANT.written_at)
  const settled = rows.filter((r) => r.actual !== null)
  const hits = (lo: 'q_0.05' | 'q_0.1' | 'q_0.25', hi: 'q_0.95' | 'q_0.9' | 'q_0.75') =>
    settled.filter((r) => (r.actual ?? NaN) >= r[lo] && (r.actual ?? NaN) <= r[hi]).length
  const checks = [
    { label: '50% interval', nominal: 0.5, n: hits('q_0.25', 'q_0.75') },
    { label: '80% interval', nominal: 0.8, n: hits('q_0.1', 'q_0.9') },
    { label: '90% interval', nominal: 0.9, n: hits('q_0.05', 'q_0.95') },
  ]
  const deliveryDay = Date.parse(rows[0].delivery_time)

  const tableRows = rows.map((r) => ({
    sp: String(r.settlement_period),
    t: clock(Date.parse(r.delivery_time)),
    actual: r.actual === null ? 'not settled' : fmt0(r.actual),
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

  return (
    <section className="gf-screen i-screen">
      <Head
        kind="turbine"
        title="Wind forecast"
        sub="Day-ahead quantile forecast of GB wind generation against the settled actual. This view runs on a synthetic fixture until the wind model writes to the forecast store."
        stamp={`For ${dayLabel(deliveryDay)} ${WIND_FIXTURE_DATE.slice(0, 4)}, issued ${dayLabel(written)} at ${clock(written)} ${zoneAbbrev(written)}, UK time`}
        badge={<FixtureTag />}
      />
      <div className="i-toolbar">
        <Segmented label="View" options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} value={view} onChange={setView} />
        <span className="i-toolbar-note">One delivery day. The range control doesn't apply to the fixture.</span>
      </div>
      <div className="i-grid">
        <Panel
          className="i-p-main"
          title="Wind generation, forecast and actual"
          tag={<FixtureTag>Fixture</FixtureTag>}
          src={
            <>
              Synthetic rows shaped like <code>/api/forecasts/day</code>, model <code>{WIND_FIXTURE_MODEL}</code>, MW, 48 settlement periods
            </>
          }
        >
          {view === 'chart' ? (
            <NightFanChart records={rows} unit="MW" />
          ) : (
            <DataTable caption="Wind forecast by settlement period (fixture)" columns={columns} rows={tableRows} />
          )}
        </Panel>

        <Panel className="i-p-key" title="Key">
          <ul className="i-key">
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
                <rect x="0" y="0" width="22" height="12" fill="var(--chart-fan)" fillOpacity="0.13" />
                <rect x="0" y="2" width="22" height="8" fill="var(--chart-fan)" fillOpacity="0.14" />
                <rect x="0" y="4" width="22" height="4" fill="var(--chart-fan)" fillOpacity="0.2" />
              </svg>
              50, 80 and 90% intervals
            </li>
          </ul>
          <dl className="i-facts">
            <div>
              <dt>Model</dt>
              <dd>
                <code>{WIND_FIXTURE_MODEL}</code>
              </dd>
            </div>
            <div>
              <dt>Vintage policy</dt>
              <dd>
                <code>{WIND_FIXTURE_POLICY}</code>
              </dd>
            </div>
            <div>
              <dt>Settled</dt>
              <dd>
                {settled.length} of {rows.length} periods
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel className="i-p-wide" title="Run gates" tag={<FixtureTag>Fixture</FixtureTag>}>
          <MetricsPanel metrics={WIND_FIXTURE_METRICS} caveat={WIND_FIXTURE_VARIANT.perfect_prog_caveat} />
        </Panel>

        <Panel className="i-p-side" title="Interval check" src={`Settled actuals inside each interval, ${settled.length} periods, computed on the fixture.`}>
          <ul className="i-checks">
            {checks.map((c) => (
              <li key={c.label}>
                <span className="i-checks-label">{c.label}</span>
                <span className="i-checks-meter" aria-hidden="true">
                  <span style={{ width: `${(c.n / settled.length) * 100}%` }} />
                  <i style={{ left: `${c.nominal * 100}%` }} />
                </span>
                <span className="i-checks-value">
                  {c.n} of {settled.length}, {pctText(c.n / settled.length)}
                </span>
              </li>
            ))}
          </ul>
          <p className="i-hint">The tick marks each interval's nominal coverage. A bar well past its tick means the interval is wider than it needs to be.</p>
        </Panel>
      </div>
    </section>
  )
}

