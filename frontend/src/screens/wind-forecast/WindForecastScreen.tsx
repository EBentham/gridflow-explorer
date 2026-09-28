/**
 * Wind forecast (pinned, FIXTURE): a day-ahead quantile forecast of GB wind
 * generation against the settled actual. No wind model writes to the
 * forecast store yet, so every number here is synthetic
 * (`src/fixtures/windForecast.ts`) and every panel drawing it carries the
 * dashed-ochre Fixture tag (DESIGN §9, EFFORT-PLAN OQ-6).
 */
import { useMemo } from 'react'
import { DataTable, FanKey } from '../../design/charts'
import { fmt1, pct } from '../../design/format'
import { FixtureTag, Head, Panel, Screen, Toolbar, ViewSwitch } from '../../design/frame'
import { useViewParam } from '../../design/range'
import { clock, dayLabel, halfHourWindow, zoneAbbrev } from '../../design/time'
import { WIND_FIXTURE_DATE, WIND_FIXTURE_DAY, WIND_FIXTURE_METRICS, WIND_FIXTURE_MODEL, WIND_FIXTURE_POLICY, WIND_FIXTURE_VARIANT } from '../../fixtures/windForecast'
import { FanChart } from './FanChart'
import { MetricsPanel } from './MetricsPanel'
import { toFanRows } from './fan'

const FIXTURE_NOTE = 'Synthetic data made in the browser. No wind model writes to the forecast store yet.'
const MW_TO_GW = 1 / 1000

export function WindForecastScreen() {
  const [view, setView] = useViewParam()
  const rows = useMemo(() => toFanRows(WIND_FIXTURE_DAY, MW_TO_GW), [])
  const written = Date.parse(WIND_FIXTURE_VARIANT.written_at)
  const deliveryDay = rows[0].t
  const settled = rows.filter((r) => r.actual !== null)
  const hits = (lo: 'q05' | 'q10' | 'q25', hi: 'q95' | 'q90' | 'q75') => settled.filter((r) => (r.actual ?? NaN) >= r[lo] && (r.actual ?? NaN) <= r[hi]).length
  const checks = [
    { label: '50% interval', nominal: 0.5, n: hits('q25', 'q75') },
    { label: '80% interval', nominal: 0.8, n: hits('q10', 'q90') },
    { label: '90% interval', nominal: 0.9, n: hits('q05', 'q95') },
  ]
  const model = <code>{WIND_FIXTURE_MODEL}</code>

  const columns = [
    { key: 'sp', label: 'SP', align: 'end' as const },
    { key: 't', label: 'Half-hour' },
    { key: 'actual', label: 'Actual, GW', align: 'end' as const },
    { key: 'q50', label: 'Median, GW', align: 'end' as const },
    { key: 'i80', label: '80% interval, GW', align: 'end' as const },
  ]
  const tableRows = rows.map((r) => ({
    sp: String(r.sp),
    t: halfHourWindow(r.t),
    actual: r.actual === null ? 'not settled' : fmt1(r.actual),
    q50: fmt1(r.q50),
    i80: `${fmt1(r.q10)}–${fmt1(r.q90)}`,
  }))

  return (
    <Screen>
      <Head
        glyph="turbine"
        title="Wind forecast"
        sub="Day-ahead quantile forecast of GB wind generation against the settled actual. This view runs on a synthetic fixture until the wind model writes to the forecast store."
        stamp={`For ${dayLabel(deliveryDay)} ${WIND_FIXTURE_DATE.slice(0, 4)}, issued ${dayLabel(written)} at ${clock(written)} ${zoneAbbrev(written)}, UK time`}
        badge={<FixtureTag title={FIXTURE_NOTE}>Fixture data: no wind model yet</FixtureTag>}
      />
      <Toolbar>
        <ViewSwitch value={view} onChange={setView} />
        <span className="gf-toolbar-note">One delivery day. The range control doesn't apply to the fixture.</span>
      </Toolbar>
      <div className="gf-grid">
        <Panel
          area="main"
          title="Wind generation, forecast and actual"
          tag={<FixtureTag title={FIXTURE_NOTE} />}
          src={
            <>
              Synthetic rows shaped like <code>/api/forecasts/day</code>, model {model}, GW (the fixture is generated in MW), {rows.length} settlement periods of {dayLabel(deliveryDay)}
            </>
          }
        >
          {view === 'chart' ? (
            <FanChart rows={rows} unit="GW" fixture />
          ) : (
            <DataTable caption={`Wind forecast by settlement period, GW, ${dayLabel(deliveryDay)} (fixture)`} columns={columns} rows={tableRows} />
          )}
        </Panel>

        <Panel
          area="key"
          title="Key"
          tag={<FixtureTag title={FIXTURE_NOTE} />}
          src={
            <>
              Synthetic, model {model}, GW, {dayLabel(deliveryDay)}
            </>
          }
        >
          <FanKey fixture />
          <dl className="gf-facts">
            <div>
              <dt>Model</dt>
              <dd>{model}</dd>
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

        <Panel
          area="wide"
          title="Run gates"
          tag={<FixtureTag title={FIXTURE_NOTE} />}
          src={
            <>
              Synthetic gate metrics shaped like <code>/api/forecasts/metrics</code>, model {model}, one run
            </>
          }
        >
          <MetricsPanel metrics={WIND_FIXTURE_METRICS} caveat={WIND_FIXTURE_VARIANT.perfect_prog_caveat} fixture />
        </Panel>

        <Panel
          area="side"
          title="Interval check"
          tag={<FixtureTag title={FIXTURE_NOTE} />}
          src={`Settled actuals inside each interval, ${settled.length} periods of ${dayLabel(deliveryDay)}, computed on the fixture.`}
        >
          <ul className="gf-checks">
            {checks.map((c) => (
              <li key={c.label}>
                <span className="gf-checks-label">{c.label}</span>
                <span className="gf-checks-meter" aria-hidden="true">
                  <span style={{ width: `${(c.n / settled.length) * 100}%` }} />
                  <i style={{ left: `${c.nominal * 100}%` }} />
                </span>
                <span className="gf-checks-value">
                  {c.n} of {settled.length}, {pct(c.n / settled.length)}
                </span>
              </li>
            ))}
          </ul>
          <p className="gf-hint">The tick marks each interval's nominal coverage. A bar well past its tick means the interval is wider than it needs to be.</p>
        </Panel>
      </div>
    </Screen>
  )
}
