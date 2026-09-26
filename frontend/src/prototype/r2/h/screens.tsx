import { useMemo, useState, type ReactNode } from 'react'
import { DataTable, toFanRows } from '../../../design/charts'
import { FUEL_BANDS } from '../../../design/fuels'
import { clock, dayLabel, zoneAbbrev } from '../../../design/time'
import { CoverageNote, FixtureBadge, RangeControl, Segmented } from '../../controls'
import { useCoverageNote, useMix, usePrices, useRange } from '../../data'
import { WIND_FIXTURE_DAY, WIND_FIXTURE_DATE, WIND_FIXTURE_METRICS, WIND_FIXTURE_MODEL, WIND_FIXTURE_VARIANT } from '../../fixtures/windForecast'
import { MetricsPanel } from '../../pieces'
import { bandLabel, count, dateLong, gw, mixStory, mw, pct, plain, priceStory, windStory, windowShares, windowShort, windowTitle } from './annotate'
import { FuelKeyRow, MixChart, PriceNivChart, ShareBar, WindFan, type FanRow } from './charts'

type View = 'chart' | 'table'
const VIEWS = [
  { value: 'chart' as const, label: 'Chart' },
  { value: 'table' as const, label: 'Table' },
]

/** Dataset, table and column identifiers: the only mono on the page. */
const Id = ({ children }: { children: ReactNode }) => <code className="h-id">{children}</code>

function Head({ title, summary, badge, stamp }: { title: string; summary: string[] | null; badge?: ReactNode; stamp?: string }) {
  return (
    <header className="h-head">
      <div className="h-head-title">
        <h1>{title}</h1>
        {(badge || stamp) && (
          <p className="h-stamp">
            {badge}
            {stamp && <span>{stamp}</span>}
          </p>
        )}
      </div>
      <div className="h-summary" aria-live="polite">
        {summary === null ? <p className="h-pending">Reading the window from the local catalogue.</p> : <p>{summary.join(' ')}</p>}
      </div>
    </header>
  )
}

function Controls({ view, setView, range = true }: { view: View; setView: (v: View) => void; range?: boolean }) {
  return (
    <div className="h-controls">
      {range ? <RangeControl /> : <span />}
      <Segmented label="View" options={VIEWS} value={view} onChange={setView} />
    </div>
  )
}

function Figure({ title, action, children, caption }: { title: string; action?: ReactNode; children: ReactNode; caption: ReactNode }) {
  return (
    <figure className="h-fig">
      <div className="h-fighead">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
      <figcaption className="h-cap">{caption}</figcaption>
    </figure>
  )
}

function Status({ loading, error, empty }: { loading: boolean; error: Error | null; empty: boolean }) {
  if (error) return <p className="h-state is-error">This range couldn't be read from the local catalogue: {error.message}</p>
  if (loading) return <p className="h-state">Reading the range from the local catalogue.</p>
  if (empty) return <p className="h-state">No local data in this range. Pick a range ending on or before the latest local day.</p>
  return null
}

const when = (t: number) => `${dayLabel(t)}, ${clock(t)}`

// ---------------------------------------------------------------- generation mix

export function GenerationScreen() {
  const { range } = useRange()
  const { rows, loading, error } = useMix(range)
  const cov = useCoverageNote('generation-mix', range)
  const [focus, setFocus] = useState<string | undefined>()
  const [view, setView] = useState<View>('chart')
  const oneDay = !!range && range.start === range.end
  const story = useMemo(() => (loading ? null : mixStory(rows, oneDay, focus)), [rows, loading, oneDay, focus])
  const total = useMemo(() => windowShares(rows).total, [rows])
  const win = range ? windowShort(range) : ''
  const ready = !loading && rows.length > 0 && story
  const focusLabel = focus ? bandLabel(focus) : undefined

  return (
    <section className="h-screen">
      <Head title={`Generation mix, ${range ? dateOrWindow(range) : ''}`} summary={ready ? story.sentences : loading ? null : []} />
      <Controls view={view} setView={setView} />
      {cov && <CoverageNote missing={cov.missing_day_count} requested={cov.requested_day_count} />}
      <div className="h-figs">
        <Status loading={loading} error={error} empty={!loading && rows.length === 0} />
        {ready && (
          <>
            <Figure
              title={focusLabel ? `${focusLabel}, half-hourly` : 'Generation by fuel, half-hourly'}
              action={
                focus && (
                  <button type="button" className="h-textbtn" onClick={() => setFocus(undefined)}>
                    Show all fuels
                  </button>
                )
              }
              caption={
                <>
                  Elexon <Id>fuelhh</Id>, one row per settlement period, {win}, in GW on the UK clock. Coal, oil and OCGT fold into peaking; pumped storage and net imports sit below zero when pumping or exporting.
                  {story.window && ` The shaded band is the three hours with the highest ${story.fuelLabel.toLowerCase()} share, ${when(story.window.start)} onwards.`}
                </>
              }
            >
              {view === 'chart' ? (
                <>
                  <FuelKeyRow focus={focus} onPick={setFocus} />
                  <MixChart rows={rows} focus={focus} story={story} oneDay={oneDay} />
                </>
              ) : (
                <DataTable
                  caption="Generation by fuel per half-hour, GW"
                  columns={[{ key: 't', label: 'Half-hour from' }, ...FUEL_BANDS.map((b) => ({ key: b.key, label: b.label, align: 'end' as const }))]}
                  rows={rows.map((r) => ({ t: when(r.t), ...Object.fromEntries(FUEL_BANDS.map((b) => [b.key, plain(r[b.key], 1)])) }))}
                />
              )}
            </Figure>
            <Figure
              title="Share of the window"
              caption={
                <>
                  Elexon <Id>fuelhh</Id>: mean generation by fuel type across {story.n.toLocaleString('en-GB')} settlement periods, {win}, in GW. The fuels above zero sum to {gw(total)}. Select a fuel to chart it on its own.
                </>
              }
            >
              <ShareBar rows={rows} focus={focus} onPick={setFocus} />
            </Figure>
          </>
        )}
      </div>
    </section>
  )
}

function dateOrWindow(r: { start: string; end: string }) {
  return r.start === r.end ? dateLong(r.end) : windowTitle(r)
}

// ---------------------------------------------------------------- system prices

export function PricesScreen() {
  const { range } = useRange()
  const { rows, loading, error } = usePrices(range)
  const cov = useCoverageNote('system-prices', range)
  const [view, setView] = useState<View>('chart')
  const oneDay = !!range && range.start === range.end
  const story = useMemo(() => priceStory(rows, oneDay), [rows, oneDay])
  const win = range ? windowShort(range) : ''
  const ready = !loading && rows.length > 0

  return (
    <section className="h-screen">
      <Head title={`System prices, ${range ? dateOrWindow(range) : ''}`} summary={ready ? story.sentences : loading ? null : []} />
      <Controls view={view} setView={setView} />
      {cov && <CoverageNote missing={cov.missing_day_count} requested={cov.requested_day_count} />}
      <div className="h-figs">
        <Status loading={loading} error={error} empty={!loading && rows.length === 0} />
        {ready && (
          <Figure
            title="System price, with net imbalance volume"
            caption={
              <>
                Elexon <Id>system_prices</Id>, columns <Id>system_sell_price</Id> and <Id>net_imbalance_volume</Id>, {win}, in £/MWh and MWh per settlement period on the UK clock. GB has been single-priced since 2015, so sell and buy are one line.
                {story.negative.length > 0 &&
                  ` The shaded ${story.negative.length === 1 ? 'band marks the run' : `bands mark the ${count(story.negative.length)} runs`} of half-hours where the price was below zero.`}
              </>
            }
          >
            {view === 'chart' ? (
              <PriceNivChart rows={rows} story={story} oneDay={oneDay} />
            ) : (
              <DataTable
                caption="System price and net imbalance volume per half-hour"
                columns={[
                  { key: 't', label: 'Half-hour from' },
                  { key: 'price', label: 'System price, £/MWh', align: 'end' },
                  { key: 'niv', label: 'NIV, MWh', align: 'end' },
                ]}
                rows={rows.map((r) => ({ t: when(r.t), price: r.price === null ? '–' : plain(r.price, 2), niv: r.niv === null ? '–' : plain(r.niv) }))}
              />
            )}
          </Figure>
        )}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- wind forecast (fixture)

export function WindScreen() {
  const [view, setView] = useState<View>('chart')
  const rows: FanRow[] = useMemo(() => toFanRows(WIND_FIXTURE_DAY), [])
  const story = useMemo(() => windStory(rows), [rows])
  const issued = Date.parse(WIND_FIXTURE_VARIANT.written_at)
  const outside = story.excursions.length

  return (
    <section className="h-screen">
      <Head
        title={`Wind forecast for ${dateLong(WIND_FIXTURE_DATE)}`}
        badge={<FixtureBadge>Fixture: synthetic data, no wind model yet</FixtureBadge>}
        stamp={`Day-ahead, issued ${dayLabel(issued)} at ${clock(issued)} ${zoneAbbrev(issued)}`}
        summary={story.sentences}
      />
      <Controls view={view} setView={setView} range={false} />
      <div className="h-figs">
        <Figure
          title="Wind generation forecast against the settled actual"
          caption={
            <>
              Fixture <Id>{WIND_FIXTURE_MODEL}</Id>, columns <Id>q_0.05</Id> to <Id>q_0.95</Id> and <Id>actual</Id>, 48 settlement periods, in MW on the UK clock. Generated in the frontend in the shape of the forecast store's rows; no wind model writes there yet.
              {outside > 0 && ` The shaded ${outside === 1 ? 'band marks the run' : 'bands mark the runs'} where the actual left the 80% band.`}
            </>
          }
        >
          {view === 'chart' ? (
            <>
              <ul className="h-fankey" aria-label="Key">
                <li>
                  <svg width="24" height="10" aria-hidden="true">
                    <line x1="0" y1="5" x2="24" y2="5" stroke="var(--chart-actual)" strokeWidth="2" />
                  </svg>
                  Settled actual
                </li>
                <li>
                  <svg width="24" height="10" aria-hidden="true">
                    <line x1="0" y1="5" x2="24" y2="5" stroke="var(--chart-fan)" strokeWidth="2" strokeDasharray="5 4" />
                  </svg>
                  Median forecast, dashed as fixture
                </li>
                <li>
                  <svg width="24" height="12" aria-hidden="true">
                    <rect width="24" height="12" fill="var(--chart-fan)" fillOpacity="0.1" />
                    <rect y="2" width="24" height="8" fill="var(--chart-fan)" fillOpacity="0.23" />
                    <rect y="4" width="24" height="4" fill="var(--chart-fan)" fillOpacity="0.39" />
                  </svg>
                  50, 80 and 90% bands
                </li>
                {outside > 0 && (
                  <li>
                    <svg width="14" height="12" aria-hidden="true">
                      <rect width="14" height="12" fill="var(--band-solid)" />
                    </svg>
                    Actual outside the 80% band
                  </li>
                )}
              </ul>
              <WindFan rows={rows} story={story} />
            </>
          ) : (
            <DataTable
              caption="Wind forecast by settlement period, fixture, MW"
              columns={[
                { key: 'sp', label: 'SP', align: 'end' },
                { key: 't', label: 'From' },
                { key: 'actual', label: 'Actual, MW', align: 'end' },
                { key: 'q50', label: 'Median, MW', align: 'end' },
                { key: 'i80', label: '80% band, MW', align: 'end' },
                { key: 'out', label: 'Outside 80%' },
              ]}
              rows={rows.map((r) => ({
                sp: String(r.sp),
                t: clock(r.t),
                actual: r.actual === null ? 'pending' : plain(r.actual),
                q50: plain(r.q50),
                i80: `${plain(r.q10)} to ${plain(r.q90)}`,
                out: r.actual === null ? '' : r.actual > r.q90 ? `above, ${mw(r.actual - r.q90)}` : r.actual < r.q10 ? `below, ${mw(r.q10 - r.actual)}` : '',
              }))}
            />
          )}
        </Figure>
        <Figure
          title="Run gates"
          caption={
            <>
              Fixture gate metrics in the shape of <Id>/api/forecasts/metrics</Id> rows for run <Id>fixture</Id>; interval coverage {pct(WIND_FIXTURE_METRICS[0].metric_value)} against a floor of {pct(WIND_FIXTURE_METRICS[0].gate_threshold ?? 0)}.
            </>
          }
        >
          <MetricsPanel metrics={WIND_FIXTURE_METRICS} caveat={WIND_FIXTURE_VARIANT.perfect_prog_caveat} />
        </Figure>
      </div>
    </section>
  )
}
