import { useMemo, useState } from 'react'
import { DataTable, FanChart, FuelKey, GenerationChart, PriceChart, fmt0, fmt1, money } from '../design/charts'
import { FUEL_BANDS } from '../design/fuels'
import { clock, dayLabel, londonMidnight } from '../design/time'
import { useProto } from './context'
import { CoverageNote, FixtureBadge, RangeControl, Segmented, ShellSlot } from './controls'
import { useCoverageNote, useMix, usePrices, useRange } from './data'
import { WIND_FIXTURE_DAY, WIND_FIXTURE_METRICS, WIND_FIXTURE_VARIANT } from './fixtures/windForecast'
import { FanKey, HeatStrip, LatestMixBars, MetricsPanel, ScreenHead, windShareCells } from './pieces'

type View = 'chart' | 'table'

function Status({ loading, error, empty }: { loading: boolean; error: Error | null; empty: boolean }) {
  if (error) return <p className="gf-state is-error">Couldn't load this range: {error.message}</p>
  if (loading) return <p className="gf-state">Loading the range from the local catalogue…</p>
  if (empty) return <p className="gf-state">No local data in this range. Pick a range ending on or before the latest local day.</p>
  return null
}

function useSelectedDay(ts: number[]) {
  const [picked, setPicked] = useState<number | undefined>()
  const lastDay = ts.length ? londonMidnight(ts[ts.length - 1]) : undefined
  const day = picked !== undefined && ts.some((t) => londonMidnight(t) === picked) ? picked : lastDay
  return [day, setPicked] as const
}

// ---------------------------------------------------------------- generation mix

export function GenerationScreen() {
  const { variant } = useProto()
  const { range } = useRange()
  const { rows, loading, error } = useMix(range)
  const cov = useCoverageNote('generation-mix', range)
  const [focus, setFocus] = useState<string | undefined>()
  const [view, setView] = useState<View>('chart')
  const [day, setDay] = useSelectedDay(rows.map((r) => r.t))
  const latest = rows.at(-1)
  const focusBand = FUEL_BANDS.find((b) => b.key === focus)

  const dayRows = rows.filter((r) => day !== undefined && londonMidnight(r.t) === day)
  const tableRows = (variant.ledger ? dayRows : rows).map((r) => ({
    t: `${variant.ledger ? '' : `${dayLabel(r.t)}, `}${clock(r.t)}`,
    ...Object.fromEntries(FUEL_BANDS.map((b) => [b.key, fmt1(r[b.key])])),
  }))
  const columns = [{ key: 't', label: 'Half-hour from' }, ...FUEL_BANDS.map((b) => ({ key: b.key, label: b.label, align: 'end' as const }))]

  const key = (
    <div className="gf-key-block">
      <p className="gf-key-title">{latest ? `Fuel, GW at ${clock(latest.t)} ${dayLabel(latest.t)}` : 'Fuel'}</p>
      <FuelKey latest={latest} onPick={setFocus} focus={focus} />
      <p className="gf-key-hint">{focus ? 'Select the fuel again to return to the full stack.' : 'Select a fuel to see it on its own.'}</p>
    </div>
  )

  return (
    <section className="gf-screen">
      <ScreenHead
        title={focusBand ? `Generation mix: ${focusBand.label}` : 'Generation mix'}
        sub="Half-hourly GB transmission-connected generation by fuel type, from Elexon FUELHH. Pumping and net exports sit below zero."
        range={range}
      />
      <div className="gf-controls">
        <RangeControl />
        {!variant.ledger && (
          <Segmented label="View" options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} value={view} onChange={setView} />
        )}
      </div>
      {cov && <CoverageNote missing={cov.missing_day_count} requested={cov.requested_day_count} />}
      <div className={`gf-body${variant.sidePanel ? ' has-side' : ''}${variant.keyPlacement === 'aside' ? ' has-aside' : ''}`}>
        <div className="gf-main">
          <Status loading={loading} error={error} empty={!loading && rows.length === 0} />
          {!loading && rows.length > 0 && (
            <>
              {view === 'chart' || variant.ledger ? (
                <GenerationChart rows={rows} focus={focus} />
              ) : (
                <DataTable caption="Generation by fuel, GW" columns={columns} rows={tableRows} />
              )}
              {variant.heatStrip && (
                <HeatStrip
                  cells={windShareCells(rows)}
                  unit="%"
                  format={(v) => `${Math.round(v)}`}
                  label="Wind share of generation by half-hour. Select a day to open its ledger."
                  selected={day}
                  onSelect={setDay}
                />
              )}
              {variant.ledger && day !== undefined && (
                <DataTable caption={`Ledger for ${dayLabel(day)}, GW per half-hour`} columns={columns} rows={tableRows} />
              )}
            </>
          )}
        </div>
        {variant.sidePanel && latest && (
          <aside className="gf-side">
            <h2>Latest half-hour</h2>
            <LatestMixBars row={latest} />
          </aside>
        )}
        {variant.keyPlacement === 'aside' && !variant.sidePanel && <aside className="gf-aside">{key}</aside>}
      </div>
      {variant.keyPlacement === 'shell' && <ShellSlot>{key}</ShellSlot>}
    </section>
  )
}

// ---------------------------------------------------------------- system prices

export function PricesScreen() {
  const { variant } = useProto()
  const { range } = useRange()
  const { rows, loading, error } = usePrices(range)
  const cov = useCoverageNote('system-prices', range)
  const [view, setView] = useState<View>('chart')
  const [day, setDay] = useSelectedDay(rows.map((r) => r.t))

  const stats = useMemo(() => {
    const p = rows.map((r) => r.price).filter((v): v is number => v !== null)
    if (!p.length) return null
    return {
      mean: p.reduce((a, b) => a + b, 0) / p.length,
      min: Math.min(...p),
      max: Math.max(...p),
      negative: p.filter((v) => v < 0).length,
      n: p.length,
    }
  }, [rows])

  const dayRows = rows.filter((r) => day !== undefined && londonMidnight(r.t) === day)
  const tableRows = (variant.ledger ? dayRows : rows).map((r) => ({
    t: `${variant.ledger ? '' : `${dayLabel(r.t)}, `}${clock(r.t)}`,
    price: r.price === null ? '–' : fmt1(r.price),
    niv: r.niv === null ? '–' : fmt0(r.niv),
  }))
  const columns = [
    { key: 't', label: 'Half-hour from' },
    { key: 'price', label: 'System price, £/MWh', align: 'end' as const },
    { key: 'niv', label: 'NIV, MWh', align: 'end' as const },
  ]

  const key = (
    <div className="gf-key-block">
      <p className="gf-key-title">Key</p>
      <ul className="gf-fan-key">
        <li>
          <svg width="22" height="10" aria-hidden="true">
            <line x1="0" y1="5" x2="22" y2="5" stroke="var(--chart-price)" strokeWidth="2.5" />
          </svg>
          System price, £/MWh (sell = buy)
        </li>
        <li>
          <svg width="22" height="10" aria-hidden="true">
            <rect x="6" y="0" width="5" height="10" fill="var(--chart-niv-short)" />
          </svg>
          System short: NIV above zero
        </li>
        <li>
          <svg width="22" height="10" aria-hidden="true">
            <rect x="6" y="0" width="5" height="10" fill="var(--chart-niv-long)" />
          </svg>
          System long: NIV below zero
        </li>
      </ul>
      {stats && (
        <dl className="gf-stats">
          <div>
            <dt>Mean</dt>
            <dd>{money(stats.mean, 2)}</dd>
          </div>
          <div>
            <dt>Range</dt>
            <dd>
              {money(stats.min)} to {money(stats.max)}
            </dd>
          </div>
          <div>
            <dt>Negative-price half-hours</dt>
            <dd>
              {stats.negative} of {stats.n}
            </dd>
          </div>
        </dl>
      )}
    </div>
  )

  return (
    <section className="gf-screen">
      <ScreenHead
        title="System prices"
        sub="Elexon imbalance price per half-hour, with net imbalance volume below it on the same clock. GB has been single-priced since 2015, so sell and buy are one line."
        range={range}
      />
      <div className="gf-controls">
        <RangeControl />
        {!variant.ledger && (
          <Segmented label="View" options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} value={view} onChange={setView} />
        )}
      </div>
      {cov && <CoverageNote missing={cov.missing_day_count} requested={cov.requested_day_count} />}
      <div className={`gf-body${variant.sidePanel ? ' has-side' : ''}${variant.keyPlacement === 'aside' ? ' has-aside' : ''}`}>
        <div className="gf-main">
          <Status loading={loading} error={error} empty={!loading && rows.length === 0} />
          {!loading && rows.length > 0 && (
            <>
              {view === 'chart' || variant.ledger ? (
                <PriceChart rows={rows} />
              ) : (
                <DataTable caption="System price and NIV per half-hour" columns={columns} rows={tableRows} />
              )}
              {variant.heatStrip && (
                <HeatStrip
                  cells={rows.map((r) => ({ t: r.t, value: r.price }))}
                  unit="£/MWh"
                  format={(v) => (v < 0 ? `−${fmt0(-v)}` : fmt0(v))}
                  label="System price by half-hour. Select a day to open its ledger."
                  selected={day}
                  onSelect={setDay}
                />
              )}
              {variant.ledger && day !== undefined && (
                <DataTable caption={`Ledger for ${dayLabel(day)}`} columns={columns} rows={tableRows} />
              )}
            </>
          )}
        </div>
        {variant.sidePanel && (
          <aside className="gf-side">
            <h2>Range summary</h2>
            {key}
          </aside>
        )}
        {variant.keyPlacement === 'aside' && !variant.sidePanel && <aside className="gf-aside">{key}</aside>}
      </div>
      {variant.keyPlacement === 'shell' && <ShellSlot>{key}</ShellSlot>}
    </section>
  )
}

// ---------------------------------------------------------------- wind forecast (fixture)

export function WindScreen() {
  const { variant } = useProto()
  const [view, setView] = useState<View>('chart')
  const rows = WIND_FIXTURE_DAY
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
  const key = (
    <div className="gf-key-block">
      <p className="gf-key-title">Key</p>
      <FanKey fixture={variant.lineForm} />
    </div>
  )
  const metrics = (
    <div className="gf-metrics-block">
      <h2>Run gates</h2>
      <MetricsPanel metrics={WIND_FIXTURE_METRICS} caveat={WIND_FIXTURE_VARIANT.perfect_prog_caveat} />
    </div>
  )
  return (
    <section className="gf-screen">
      <ScreenHead
        title="Wind forecast"
        sub="Day-ahead quantile forecast of GB wind generation against the settled actual. This view runs on a synthetic fixture until the wind model writes to the forecast store."
        stamp="For Tue 15 Sep 2026, issued Mon 14 Sep at 12:00 BST, UK time"
        badge={<FixtureBadge />}
      />
      <div className="gf-controls">
        <Segmented label="View" options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} value={view} onChange={setView} />
      </div>
      <div className={`gf-body${variant.sidePanel ? ' has-side' : ''}${variant.keyPlacement === 'aside' ? ' has-aside' : ''}`}>
        <div className="gf-main">
          {view === 'chart' ? (
            <FanChart records={rows} unit="MW" fixture={variant.lineForm} />
          ) : (
            <DataTable caption="Wind forecast by settlement period (fixture)" columns={columns} rows={tableRows} />
          )}
          {!variant.sidePanel && metrics}
        </div>
        {variant.sidePanel && <aside className="gf-side">{metrics}{key}</aside>}
        {variant.keyPlacement === 'aside' && !variant.sidePanel && <aside className="gf-aside">{key}</aside>}
      </div>
      {variant.keyPlacement === 'shell' && <ShellSlot>{key}</ShellSlot>}
    </section>
  )
}
