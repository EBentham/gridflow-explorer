import { useMemo, useState } from 'react'
import { DataTable, TooltipBox, fmt0, fmt1, money, niceTicks, type PriceRow } from '../../../design/charts'
import { HALF_HOUR, clock, dayLabel, halfHourWindow } from '../../../design/time'
import { RangeControl, rangeText } from '../../controls'
import { usePrices, useRange } from '../../data'
import { DayRules, TOP, TipAt, VoidTip, YAxis, useHover, type TipRow } from './chart'
import { TRUNK, gutOf, plOf, prOf, runsOf, scaleX, scaleY, useCoverageG, useWidth, windowOf, type Interval } from './geo'
import { CHART_H, CoverageLine, Head, StateLine, ViewToggle, servedCount, servedTrack, silverTrack, type View } from './screens'
import { Id, Strata, type Layer } from './strata'

const HALF = HALF_HOUR / 2
const PRICE_BOTTOM = 214
const NIV_TOP = 252

/** Money for chart text: `−£39.42/MWh`. */
const perMWh = (v: number) => `${money(v, 2)}/MWh`

function PriceChart({
  rows,
  domain,
  width,
  height,
  onCursor,
}: {
  rows: PriceRow[]
  domain: Interval
  width: number
  height: number
  onCursor: (t: number | null) => void
}) {
  const pr = prOf(width)
  const hi = width - pr
  const PL = plOf(width)
  const tx = hi + TRUNK
  const { x } = scaleX(width, domain)
  const priced = useMemo(() => rows.filter((r) => r.price !== null), [rows])

  const yp = useMemo(() => {
    const v = priced.map((r) => r.price as number)
    return niceTicks(Math.min(0, ...v), Math.max(...v))
  }, [priced])
  const yn = useMemo(() => {
    const v = rows.map((r) => r.niv).filter((n): n is number => n !== null)
    return niceTicks(Math.min(0, ...v), Math.max(0, ...v), 3)
  }, [rows])
  const y = scaleY(yp.domain, TOP, PRICE_BOTTOM)
  const yN = scaleY(yn.domain, NIV_TOP, height - 3)

  const lines = useMemo(
    () =>
      runsOf(priced).map((run) => {
        const pts = [{ t: run[0].t, v: run[0].price as number }, ...run.map((r) => ({ t: r.t + HALF, v: r.price as number })), { t: run[run.length - 1].t + HALF_HOUR, v: run[run.length - 1].price as number }]
        return pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [priced, width, domain[0], domain[1], yp.domain[0], yp.domain[1]],
  )
  const negBands = useMemo(() => {
    const out: Interval[] = []
    for (const r of priced) {
      if ((r.price as number) >= 0) continue
      const last = out.at(-1)
      if (last && r.t <= last[1]) last[1] = r.t + HALF_HOUR
      else out.push([r.t, r.t + HALF_HOUR])
    }
    return out
  }, [priced])
  const extremes = useMemo(() => {
    if (!priced.length) return []
    let lo = priced[0]
    let top = priced[0]
    for (const r of priced) {
      if ((r.price as number) < (lo.price as number)) lo = r
      if ((r.price as number) > (top.price as number)) top = r
    }
    return [
      { row: top, text: `${perMWh(top.price as number)}, highest in the window`, below: false },
      { row: lo, text: `${perMWh(lo.price as number)}, lowest in the window`, below: true },
    ]
  }, [priced])
  const stats = useMemo(() => {
    const p = priced.map((r) => r.price as number)
    if (!p.length) return null
    return { mean: p.reduce((a, b) => a + b, 0) / p.length, negative: p.filter((v) => v < 0).length, n: p.length }
  }, [priced])

  const { hover, move, leave } = useHover(rows, width, domain, onCursor)
  const tip = hover?.row ? (
    (() => {
      const row = hover.row
      const tipRows: TipRow[] = [{ key: 'p', color: 'var(--chart-price)', label: 'System price', value: row.price === null ? 'no price' : perMWh(row.price) }]
      if (row.niv !== null)
        tipRows.push({
          key: 'n',
          color: row.niv >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)',
          label: row.niv >= 0 ? 'NIV, system short' : 'NIV, system long',
          value: `${fmt0(row.niv)} MWh`,
        })
      return <TooltipBox title={halfHourWindow(row.t)} rows={tipRows} note="Single imbalance price: sell = buy" />
    })()
  ) : hover ? (
    <VoidTip t={hover.t} />
  ) : null

  const colLeft = hi + 18
  const colW = pr - gutOf(width) - 26
  const slot = (t: number) => Math.max(0.8, x(t + HALF_HOUR) - x(t) - 0.4)

  return (
    <div className="g-plot" style={{ height }}>
      <svg width={width} height={height} className="g-plot-svg" aria-hidden="true">
        {negBands.map(([a, b]) => (
          <rect key={a} x={x(a)} y={TOP} width={Math.max(1.5, x(b) - x(a))} height={PRICE_BOTTOM - TOP} fill="var(--g-band-neg)" />
        ))}
        <YAxis ticks={yp.ticks} y={y} width={width} unit="£/MWh" />
        <DayRules domain={domain} width={width} top={TOP} bottom={PRICE_BOTTOM} />
        {yp.domain[0] < 0 && <line x1={PL} x2={hi} y1={y(0)} y2={y(0)} stroke="var(--g-ground)" strokeWidth="1" />}
        {lines.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--chart-price)" strokeWidth="1.75" strokeLinejoin="round" />
        ))}
        {extremes.map((e) => {
          const px = x(e.row.t + HALF)
          const py = y(e.row.price as number)
          const right = px > (PL + hi) / 2
          const ly = e.below ? Math.min(PRICE_BOTTOM - 4, py + 17) : Math.max(TOP + 10, py - 9)
          return (
            <g key={e.text}>
              <circle cx={px} cy={py} r="3.4" fill="var(--bg)" stroke="var(--ink)" strokeWidth="1.3" />
              <text x={right ? px - 8 : px + 8} y={ly} textAnchor={right ? 'end' : 'start'} className="g-note">
                {e.text}
              </text>
            </g>
          )
        })}

        {/* NIV panel, same clock, sitting on the ground line */}
        <YAxis ticks={yn.ticks} y={yN} width={width} unit="NIV, MWh" top={NIV_TOP} bottom={height - 3} />
        <DayRules domain={domain} width={width} top={NIV_TOP} bottom={height} />
        {rows.map((r) =>
          r.niv === null ? null : (
            <rect
              key={r.t}
              x={x(r.t) + 0.2}
              y={Math.min(yN(0), yN(r.niv))}
              width={slot(r.t)}
              height={Math.max(0.5, Math.abs(yN(r.niv) - yN(0)))}
              fill={r.niv >= 0 ? 'var(--chart-niv-short)' : 'var(--chart-niv-long)'}
            />
          ),
        )}
        <line x1={PL} x2={hi} y1={yN(0)} y2={yN(0)} stroke="var(--g-ground)" strokeWidth="1" />

        {/* the price panel's own cable, down the right column to the ground */}
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M${hi} ${PRICE_BOTTOM} H${tx - 12} Q${tx} ${PRICE_BOTTOM} ${tx} ${PRICE_BOTTOM + 12} V${height + 2}`} stroke="var(--g-cable)" strokeWidth="4.4" />
          <path d={`M${hi} ${PRICE_BOTTOM} H${tx - 12} Q${tx} ${PRICE_BOTTOM} ${tx} ${PRICE_BOTTOM + 12} V${height + 2}`} stroke="var(--g-core-soil)" strokeWidth="1.5" />
        </g>
        <circle cx={hi} cy={PRICE_BOTTOM} r="3.4" fill="var(--bg)" stroke="var(--g-cable)" strokeWidth="1.3" />

        {hover && <line x1={hover.px} x2={hover.px} y1={TOP} y2={height} stroke="var(--chart-cursor)" strokeWidth="1" />}
        <rect x={PL} y={TOP} width={Math.max(0, hi - PL)} height={height - TOP} fill="transparent" onPointerMove={move} onPointerLeave={leave} />
      </svg>

      <div className="g-col" style={{ left: colLeft, top: TOP - 24, width: colW }}>
        <ul className="g-key">
          <li>
            <svg width="22" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="22" y2="5" stroke="var(--chart-price)" strokeWidth="2" />
            </svg>
            System price, £/MWh (sell = buy)
          </li>
          <li>
            <svg width="22" height="12" aria-hidden="true">
              <rect x="4" y="0" width="14" height="12" fill="var(--g-band-neg)" />
            </svg>
            Half-hours below £0
          </li>
        </ul>
        {stats && (
          <dl className="g-stats">
            <div>
              <dt>Mean</dt>
              <dd>{perMWh(stats.mean)}</dd>
            </div>
            <div>
              <dt>Negative half-hours</dt>
              <dd>
                {stats.negative} of {fmt0(stats.n)}
              </dd>
            </div>
            <div>
              <dt>Latest</dt>
              <dd>
                {perMWh(priced[priced.length - 1].price as number)} at {clock(priced[priced.length - 1].t)}
              </dd>
            </div>
          </dl>
        )}
      </div>
      <ul className="g-key g-col" style={{ left: tx + 22, top: NIV_TOP + 4, width: colW - 26 }}>
        <li>
          <svg width="14" height="10" aria-hidden="true">
            <rect x="3" y="0" width="7" height="10" fill="var(--chart-niv-short)" />
          </svg>
          System short: NIV above zero
        </li>
        <li>
          <svg width="14" height="10" aria-hidden="true">
            <rect x="3" y="0" width="7" height="10" fill="var(--chart-niv-long)" />
          </svg>
          System long: NIV below zero
        </li>
      </ul>
      <TipAt hover={hover} width={width} top={TOP + 6}>
        {tip}
      </TipAt>
    </div>
  )
}

export function PricesG() {
  const { range } = useRange()
  const { rows, loading, error } = usePrices(range)
  const cov = useCoverageG('system-prices', range)
  const [ref, width] = useWidth<HTMLDivElement>()
  const [view, setView] = useState<View>('chart')
  const [cursor, setCursor] = useState<number | null>(null)
  const domain = range ? windowOf(range) : null
  const ts = useMemo(() => rows.map((r) => r.t), [rows])

  const layers: Layer[] = domain
    ? [
        {
          kind: 'bronze',
          name: 'bronze',
          height: 80,
          terminal: { ids: ['elexon/system_prices'], body: 'Raw Elexon responses. The Explorer doesn’t read this layer.' },
        },
        {
          kind: 'silver',
          name: 'silver',
          height: 104,
          track: silverTrack(cov),
          terminal: {
            ids: ['silver_elexon_system_prices_latest'],
            body: (
              <>
                Newest vintage per settlement period. <CoverageLine cov={cov} />
              </>
            ),
          },
        },
        {
          kind: 'gold',
          name: 'gold',
          height: 100,
          track: servedTrack(ts, domain, loading),
          terminal: {
            ids: ['/api/datasets/system-prices'],
            body: (
              <>
                No gold view: read from silver by <Id>get_system_prices()</Id>. {loading ? '' : servedCount(rows.length)}
              </>
            ),
          },
        },
      ]
    : []

  const tableRows = rows.map((r) => ({
    t: `${dayLabel(r.t)}, ${clock(r.t)}`,
    price: r.price === null ? '–' : fmt1(r.price),
    niv: r.niv === null ? '–' : fmt0(r.niv),
  }))
  const columns = [
    { key: 't', label: 'Half-hour from, UK time' },
    { key: 'price', label: 'System price, £/MWh', align: 'end' as const },
    { key: 'niv', label: 'NIV, MWh', align: 'end' as const },
  ]

  return (
    <section className="g-screen">
      <Head
        title="System prices"
        sub="The imbalance price per half-hour, with net imbalance volume below it on the same clock. GB is single-priced, so sell and buy are one line."
        controls={
          <>
            <RangeControl />
            <ViewToggle view={view} setView={setView} />
          </>
        }
      />
      <div className="g-section" ref={ref}>
        <p className="g-caption">
          Elexon <Id>system_prices</Id>, columns <Id>system_sell_price</Id> in £/MWh and <Id>net_imbalance_volume</Id> in MWh
          {range ? `, ${rangeText(range.start, range.end)}, UK time` : ''}
        </p>
        <StateLine loading={loading} error={error} empty={!loading && rows.length === 0} height={CHART_H} />
        {!loading && !error && rows.length > 0 && domain && width > 0 &&
          (view === 'chart' ? (
            <PriceChart rows={rows} domain={domain} width={width} height={CHART_H} onCursor={setCursor} />
          ) : (
            <div className="g-table-slot" style={{ height: CHART_H }}>
              <DataTable caption="System price and NIV per half-hour" columns={columns} rows={tableRows} />
            </div>
          ))}
        {domain && (
          <Strata
            width={width}
            domain={domain}
            layers={layers}
            cursor={view === 'chart' ? cursor : null}
            joinFromAbove={view === 'chart' && !loading && rows.length > 0}
          />
        )}
      </div>
    </section>
  )
}
