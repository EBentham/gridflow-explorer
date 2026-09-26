import { useMemo, useState, type ReactNode } from 'react'
import { DataTable, fmt0, fmt1 } from '../../../design/charts'
import { FUEL_BANDS } from '../../../design/fuels'
import { clock, dayLabel } from '../../../design/time'
import { RangeControl, Segmented, rangeText } from '../../controls'
import { useMix, useRange } from '../../data'
import { MixChart } from './chart'
import { complement, dayIntervals, presentIntervals, useCoverageG, useWidth, windowOf, type CoverageState, type Interval } from './geo'
import { Id, Strata, type Layer, type Track } from './strata'

export type View = 'chart' | 'table'

export const CHART_H = 350

export function Head({ title, sub, badge, controls }: { title: string; sub: ReactNode; badge?: ReactNode; controls: ReactNode }) {
  return (
    <header className="g-head">
      <div className="g-head-text">
        <div className="g-title-row">
          <h1>{title}</h1>
          {badge}
        </div>
        <p className="g-sub">{sub}</p>
      </div>
      <div className="g-head-controls">{controls}</div>
    </header>
  )
}

export function ViewToggle({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <Segmented
      label="View"
      options={[
        { value: 'chart', label: 'Chart' },
        { value: 'table', label: 'Table' },
      ]}
      value={view}
      onChange={setView}
    />
  )
}

export function StateLine({ loading, error, empty, height }: { loading: boolean; error: Error | null; empty: boolean; height: number }) {
  let text: string | null = null
  if (error) text = `Couldn't load this range: ${error.message}`
  else if (loading) text = 'Loading the range from the local catalogue…'
  else if (empty) text = 'No rows in this range. Pick a range ending on or before the latest local day.'
  if (!text) return null
  return (
    <div className={`g-state${error ? ' is-error' : ''}`} style={{ height }}>
      <p>{text}</p>
    </div>
  )
}

/** Silver's time track: days the coverage endpoint says have no rows. */
export function silverTrack(cov: CoverageState): Track {
  if (cov.failed) return 'unknown'
  if (!cov.coverage) return 'checking'
  return { voids: dayIntervals(cov.coverage.missing_dates) }
}

/** Gold's time track: half-hours the API actually returned for the chart. */
export function servedTrack(ts: number[], domain: Interval, loading: boolean): Track {
  if (loading) return 'checking'
  return { voids: complement(domain, presentIntervals(ts)) }
}

export function CoverageLine({ cov }: { cov: CoverageState }) {
  if (cov.failed) return <>Coverage couldn't be checked.</>
  if (!cov.coverage) return <>Checking coverage…</>
  const { missing_day_count: miss, requested_day_count: req } = cov.coverage
  if (miss === 0) return <>All {req} days have rows.</>
  return (
    <>
      {req - miss} of {req} days have rows.{' '}
      <button type="button" className="g-fetch" disabled title="The prototype doesn't start fetch jobs. The real screen keeps this wired.">
        Fetch missing days
      </button>
    </>
  )
}

export function servedCount(n: number): string {
  return `${fmt0(n)} half-hour${n === 1 ? '' : 's'} returned.`
}

// ---------------------------------------------------------------- generation mix

export function GenerationG() {
  const { range } = useRange()
  const { rows, loading, error } = useMix(range)
  const cov = useCoverageG('generation-mix', range)
  const [ref, width] = useWidth<HTMLDivElement>()
  const [focus, setFocus] = useState<string | undefined>()
  const [view, setView] = useState<View>('chart')
  const [cursor, setCursor] = useState<number | null>(null)
  const domain = range ? windowOf(range) : null
  const ts = useMemo(() => rows.map((r) => r.t), [rows])
  const focusBand = FUEL_BANDS.find((b) => b.key === focus)

  const layers: Layer[] = domain
    ? [
        {
          kind: 'bronze',
          name: 'bronze',
          height: 82,
          terminal: {
            ids: ['elexon/fuelhh'],
            body: 'Raw FUELHH responses from Elexon BMRS, append-only. The Explorer never reads this layer, so its days aren’t checked here.',
          },
        },
        {
          kind: 'silver',
          name: 'silver',
          height: 88,
          track: silverTrack(cov),
          terminal: {
            ids: ['silver_elexon_fuelhh'],
            body: (
              <>
                One typed row per settlement period and fuel code. <CoverageLine cov={cov} />
              </>
            ),
          },
        },
        {
          kind: 'gold',
          name: 'gold',
          height: 94,
          track: servedTrack(ts, domain, loading),
          terminal: {
            ids: ['GridflowClient.get_fuel_generation()', '/api/datasets/generation-mix'],
            body: <>No gold view: the client reads silver and the API sums fuel codes into GW. {loading ? '' : servedCount(rows.length)}</>,
          },
        },
      ]
    : []

  const tableRows = rows.map((r) => ({
    t: `${dayLabel(r.t)}, ${clock(r.t)}`,
    ...Object.fromEntries(FUEL_BANDS.map((b) => [b.key, fmt1(r[b.key])])),
  }))
  const columns = [{ key: 't', label: 'Half-hour from, UK time' }, ...FUEL_BANDS.map((b) => ({ key: b.key, label: `${b.label}, GW`, align: 'end' as const }))]

  return (
    <section className="g-screen" aria-labelledby="g-h1">
      <Head
        title={focusBand ? `Generation mix: ${focusBand.label}` : 'Generation mix'}
        sub="Half-hourly GB transmission-connected generation by fuel type. Pumping and net exports sit below zero."
        controls={
          <>
            <RangeControl />
            <ViewToggle view={view} setView={setView} />
          </>
        }
      />
      <div className="g-section" ref={ref}>
        <p className="g-caption">
          Elexon <Id>fuelhh</Id>, column <Id>generation_mw</Id> summed by fuel, GW per half-hour
          {range ? `, ${rangeText(range.start, range.end)}, UK time` : ''}
        </p>
        <StateLine loading={loading} error={error} empty={!loading && rows.length === 0} height={CHART_H} />
        {!loading && !error && rows.length > 0 && domain && width > 0 && (
          view === 'chart' ? (
            <MixChart rows={rows} domain={domain} width={width} height={CHART_H} focus={focus} onFocus={setFocus} onCursor={setCursor} />
          ) : (
            <div className="g-table-slot" style={{ height: CHART_H }}>
              <DataTable caption="Generation by fuel, GW per half-hour" columns={columns} rows={tableRows} />
            </div>
          )
        )}
        {domain && <Strata width={width} domain={domain} layers={layers} cursor={view === 'chart' ? cursor : null} />}
      </div>
    </section>
  )
}
