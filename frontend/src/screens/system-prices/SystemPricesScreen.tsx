/**
 * System prices (pinned): Elexon system prices, the imbalance price per
 * half-hour with net imbalance volume on the same clock, from the live
 * backend. Beside the chart: the key and the window's figures; below it,
 * each day in the window and the runs below zero.
 */
import { useMemo, useState } from 'react'
import { FetchBanner } from '../../components/FetchBanner'
import { DataTable, KeyList, type KeyItem } from '../../design/charts'
import { daysInWindow } from '../../design/days'
import { fmt0, money, pct } from '../../design/format'
import { Head, Panel, PendingNote, RangeControl, Screen, StatusNote, Toolbar, ViewSwitch, type ChartOrTable } from '../../design/frame'
import { emptyRangeText } from '../../design/range'
import { HALF_HOUR, clock, dayLabel, halfHourWindow, rangeText, windowDomain } from '../../design/time'
import { useLiveDataset } from '../../hooks/useLiveDataset'
import { PriceChart } from './PriceChart'
import { isDualPriced, negativeRuns, toPriceRows, type PriceRow } from './prices'

const DATASET = (
  <>
    Elexon <code>system_prices</code>
  </>
)

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length
const prices = (rows: PriceRow[]) => rows.map((r) => r.price).filter((v): v is number => v !== null)
const nivs = (rows: PriceRow[]) => rows.map((r) => r.niv).filter((v): v is number => v !== null)

export function SystemPricesScreen() {
  const live = useLiveDataset('system-prices')
  const { range } = live.range
  const rows = useMemo(() => toPriceRows(live.records, 'timestamp'), [live.records])
  const days = useMemo(() => (range ? daysInWindow(rows, range) : []), [rows, range])
  const domain = useMemo(() => (range ? windowDomain(range.start, range.end) : null), [range])
  const runs = useMemo(() => negativeRuns(rows), [rows])
  const [view, setView] = useState<ChartOrTable>('chart')
  const windowText = range ? rangeText(range.start, range.end) : ''
  const ready = live.state === 'data' && domain !== null
  // The range has been read, rows or none: the days list can say which days are missing.
  const read = range !== null && (live.state === 'data' || live.state === 'empty')
  const dual = isDualPriced(rows)

  const stats = useMemo(() => {
    const p = prices(rows)
    const n = nivs(rows)
    if (!p.length) return null
    return { mean: mean(p), negative: p.filter((v) => v < 0).length, count: p.length, short: n.length ? n.filter((v) => v > 0).length / n.length : null }
  }, [rows])

  const key: KeyItem[] = [
    ...(dual
      ? [
          { key: 'sell', mark: { kind: 'line' as const, color: 'var(--chart-price)' }, label: 'Sell price, £/MWh' },
          { key: 'buy', mark: { kind: 'line' as const, color: 'var(--chart-price-2)' }, label: 'Buy price, £/MWh' },
        ]
      : [{ key: 'price', mark: { kind: 'line' as const, color: 'var(--chart-price)' }, label: 'System price, £/MWh' }]),
    { key: 'band', mark: { kind: 'band' }, label: 'Price below zero' },
    { key: 'short', mark: { kind: 'bars', color: 'var(--chart-niv-short)', shape: 'rise' }, label: 'NIV above zero: system short' },
    { key: 'long', mark: { kind: 'bars', color: 'var(--chart-niv-long)', shape: 'fall' }, label: 'NIV below zero: system long' },
  ]

  const columns = [
    { key: 't', label: 'Half-hour' },
    ...(dual
      ? [
          { key: 'sell', label: 'Sell price, £/MWh', align: 'end' as const },
          { key: 'buy', label: 'Buy price, £/MWh', align: 'end' as const },
        ]
      : [{ key: 'price', label: 'System price, £/MWh', align: 'end' as const }]),
    { key: 'niv', label: 'NIV, MWh', align: 'end' as const },
  ]
  const cell = (v: number | null, f: (x: number) => string) => (v === null ? '–' : f(v))
  const tableRows = rows.map((r) => ({
    t: halfHourWindow(r.t),
    price: cell(r.price, (x) => money(x, 2)),
    sell: cell(r.sell, (x) => money(x, 2)),
    buy: cell(r.buy, (x) => money(x, 2)),
    niv: cell(r.niv, fmt0),
  }))

  return (
    <Screen state={live.state}>
      <Head
        glyph="meter"
        title="System prices"
        sub={
          dual
            ? 'The imbalance prices per half-hour, with net imbalance volume on the same clock. Sell and buy differ in part of this window, so both are drawn.'
            : 'The imbalance price per half-hour, with net imbalance volume on the same clock. GB has been single-priced since 2015, so sell and buy are one line.'
        }
        stamp={range ? `${windowText}, UK time` : undefined}
      />
      <Toolbar>
        <RangeControl state={live.range} />
        <ViewSwitch value={view} onChange={setView} />
      </Toolbar>
      {range && <FetchBanner key={`${range.start}_${range.end}`} datasetId="system-prices" source="Elexon" range={range} onComplete={live.reload} />}
      <div className="gf-grid">
        <Panel
          area="main"
          title="System price and net imbalance volume"
          src={
            <>
              {DATASET}, columns <code>system_sell_price</code> and <code>net_imbalance_volume</code>, £/MWh and MWh{windowText && `, ${windowText}`}
            </>
          }
        >
          <StatusNote
            state={live.state}
            error={live.error}
            empty={emptyRangeText(live.range)}
          />
          {ready &&
            (view === 'chart' ? (
              <PriceChart rows={rows} domain={domain} />
            ) : (
              <DataTable caption={`System price and NIV per half-hour, ${windowText}`} columns={columns} rows={tableRows} />
            ))}
        </Panel>

        <Panel
          area="key"
          title="Key"
          src={
            <>
              {DATASET}, £/MWh and MWh over the half-hours held{windowText && `, ${windowText}`}
            </>
          }
        >
          <KeyList items={key} />
          {ready && stats && (
            <dl className="gf-stats">
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
                  <dd>{pct(stats.short)} of half-hours</dd>
                </div>
              )}
            </dl>
          )}
        </Panel>

        <Panel
          area="wide"
          title="Days in range"
          src={
            <>
              {DATASET}, price in £/MWh per UK day, NIV sign read per half-hour{windowText && `, ${windowText}`}
            </>
          }
        >
          <PendingNote state={live.state} />
          {read && (
            <div className="gf-days">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col" className="is-num">
                      Half-hours
                    </th>
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
                    if (d.rows.length === 0) {
                      return (
                        <tr key={d.day} className="is-missing">
                          <th scope="row">{dayLabel(d.start)}</th>
                          <td className="is-num">0 of {d.expected}</td>
                          <td colSpan={5}>not held locally</td>
                        </tr>
                      )
                    }
                    const p = prices(d.rows)
                    const n = nivs(d.rows)
                    const neg = p.filter((v) => v < 0).length
                    return (
                      <tr key={d.day}>
                        <th scope="row">{dayLabel(d.start)}</th>
                        <td className="is-num">{d.rows.length === d.expected ? d.expected : `${d.rows.length} of ${d.expected}`}</td>
                        <td className="is-num">{p.length ? money(mean(p), 2) : '–'}</td>
                        <td className="is-num">{p.length ? money(Math.min(...p), 2) : '–'}</td>
                        <td className="is-num">{p.length ? money(Math.max(...p), 2) : '–'}</td>
                        <td className={`is-num${neg ? ' is-flag' : ''}`}>{neg}</td>
                        <td className="is-num">{n.length ? pct(n.filter((v) => v > 0).length / n.length) : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          area="side"
          title="Below zero"
          src={
            <>
              {DATASET}: runs of consecutive half-hours with a negative system price, £/MWh{windowText && `, ${windowText}`}
            </>
          }
        >
          <PendingNote state={live.state} />
          {read && !ready && <p className="gf-hint">No half-hour is held locally for this window.</p>}
          {ready &&
            (runs.length === 0 ? (
              <p className="gf-hint">No half-hour held for this window settled below zero.</p>
            ) : (
              <ol className="gf-runs">
                {runs.map((r) => (
                  <li key={r.start}>
                    <span className="gf-runs-when">
                      {dayLabel(r.start)}, {clock(r.start)}–{clock(r.last + HALF_HOUR)}
                    </span>
                    <span className="gf-runs-what">
                      {r.n} half-hour{r.n === 1 ? '' : 's'}, low {money(r.min, 2)}
                    </span>
                  </li>
                ))}
              </ol>
            ))}
        </Panel>
      </div>
    </Screen>
  )
}
