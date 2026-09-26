/**
 * Slot i, source catalogue. The brand opens it: every source gridflow ingests,
 * grouped by domain, with the Explorer's own screens on top. A source page
 * lists that source's datasets in groups, split into time series, event feeds
 * and reference tables, and says which ones the Explorer draws.
 */
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { fmt1, money } from '../../../design/charts'
import { totalGeneration } from '../../../design/fuels'
import { clock, dayLabel } from '../../../design/time'
import { ProtoLink, fmtDate } from '../../controls'
import { rangeEnding, useMix, usePrices, useRange } from '../../data'
import { WIND_FIXTURE_DAY, WIND_FIXTURE_MODEL } from '../../fixtures/windForecast'
import {
  CATALOGUE_SNAPSHOT,
  DOMAINS,
  GOLD,
  SOURCES,
  datasetCount,
  kindCounts,
  sourceByKey,
  views,
  type Family,
  type Kind,
  type Source,
} from './catalogue'
import { Glyph, type GlyphKind } from './glyphs'
import { FixtureTag, Head, Panel } from './screens'
import './sources.css'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

const TOTAL = SOURCES.reduce((n, s) => n + datasetCount(s), 0)
const CHARTED = SOURCES.reduce((n, s) => n + views(s).length, 0)

function kindText(s: Source): string {
  const c = kindCounts(s)
  const parts = [
    c.series ? plural(c.series, 'time series', 'time series') : '',
    c.events ? plural(c.events, 'event feed', 'event feeds') : '',
    c.reference ? plural(c.reference, 'reference table', 'reference tables') : '',
  ].filter(Boolean)
  return parts.join(', ')
}

// ---------------------------------------------------------------- sparkline

/** Axis-free trace for a view tile; the caption beside it carries unit and window. */
function Spark({ values, dashed, zero }: { values: (number | null)[]; dashed?: boolean; zero?: boolean }) {
  const finite = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (finite.length < 2) return <div className="i-spark is-empty" />
  let lo = Math.min(...finite)
  let hi = Math.max(...finite)
  if (zero) lo = Math.min(lo, 0)
  if (hi === lo) hi = lo + 1
  const y = (v: number) => 94 - ((v - lo) / (hi - lo)) * 88
  let d = ''
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return
    d += `${d && values[i - 1] != null ? 'L' : 'M'}${i} ${y(v).toFixed(2)}`
  })
  return (
    <svg className="i-spark" viewBox={`0 0 ${values.length - 1} 100`} preserveAspectRatio="none" aria-hidden="true">
      {zero && lo < 0 && <path className="i-spark-zero" vectorEffect="non-scaling-stroke" d={`M0 ${y(0)} H${values.length - 1}`} />}
      <path className={`i-spark-line${dashed ? ' is-dashed' : ''}`} vectorEffect="non-scaling-stroke" d={d} />
    </svg>
  )
}

interface TileProps {
  to: string
  glyph: GlyphKind
  title: string
  id: string
  values: (number | null)[]
  reading: string
  caption: string
  fixture?: boolean
  zero?: boolean
}

function ViewTile({ to, glyph, title, id, values, reading, caption, fixture, zero }: TileProps) {
  return (
    <li className="i-view">
      <div className="i-view-head">
        <Glyph kind={glyph} size={30} />
        <div>
          <h3>
            <ProtoLink to={to} className="i-view-link">
              {title}
            </ProtoLink>
          </h3>
          <code>{id}</code>
        </div>
        {fixture && <FixtureTag>Fixture</FixtureTag>}
      </div>
      <Spark values={values} dashed={fixture} zero={zero} />
      <p className="i-view-reading">{reading}</p>
      <p className="i-view-caption">{caption}</p>
    </li>
  )
}

// ---------------------------------------------------------------- catalogue

function SourceRow({ s }: { s: Source }) {
  const charted = views(s)
  return (
    <li className="i-srow">
      <div className="i-srow-name">
        <h4>
          <ProtoLink to={`/sources/${s.key}`} className="i-srow-link">
            {s.name}
          </ProtoLink>
        </h4>
        <code>{s.key}</code>
      </div>
      <p className="i-srow-blurb">{s.blurb}</p>
      <p className="i-srow-count">
        <strong>{plural(datasetCount(s), 'dataset', 'datasets')}</strong>
        <span>{kindText(s)}</span>
      </p>
      <p className="i-srow-status">
        {charted.length ? (
          <>
            <span className="i-srow-status-label">Charted</span>
            {charted.map((v) => (
              <ProtoLink key={v.to} to={v.to} className="i-srow-view">
                {v.label}
              </ProtoLink>
            ))}
          </>
        ) : (
          <span className="is-none">Not read by the Explorer yet</span>
        )}
      </p>
    </li>
  )
}

export function CatalogueScreen() {
  const { latest } = useRange()
  const week = useMemo(() => (latest ? rangeEnding(latest, 7) : null), [latest])
  const mix = useMix(week)
  const prices = usePrices(week)
  const lastMix = mix.rows.at(-1)
  const lastPrice = prices.rows.findLast((r) => r.price != null)
  const windowText = week ? `${fmtDate(week.start)} to ${fmtDate(week.end)}` : 'the last 7 local days'
  const peak = WIND_FIXTURE_DAY.reduce((m, r) => Math.max(m, r['q_0.5']), 0)

  return (
    <section className="gf-screen i-screen i-cat">
      <Head
        kind="datacentre"
        title="gridflow data"
        sub="Every source gridflow ingests, and which of its datasets the Explorer draws. Select a source to see what it holds."
        stamp={`${SOURCES.length} sources and ${TOTAL} datasets configured in gridflow, ${CHARTED} of them charted here. Source list copied from gridflow's sources.yaml on ${CATALOGUE_SNAPSHOT}.`}
        badge={<FixtureTag>Source list is a fixture copy</FixtureTag>}
      />

      <Panel title="In the Explorer" src={`The screens that read gridflow now, each drawn over ${windowText}, UK time.`}>
        <ul className="i-views">
          <ViewTile
            to="/datasets/generation-mix"
            glyph="pylon"
            title="Generation mix"
            id="elexon/fuelhh"
            values={mix.rows.map((r) => totalGeneration(r))}
            reading={lastMix ? `${fmt1(totalGeneration(lastMix))} GW` : '–'}
            caption={lastMix ? `Total generation, half-hour from ${clock(lastMix.t)} ${dayLabel(lastMix.t)}` : 'Total generation, GW'}
          />
          <ViewTile
            to="/datasets/system-prices"
            glyph="meter"
            title="System prices"
            id="elexon/system_prices"
            values={prices.rows.map((r) => r.price)}
            reading={lastPrice?.price != null ? `${money(lastPrice.price, 2)}/MWh` : '–'}
            caption={lastPrice ? `Imbalance price, half-hour from ${clock(lastPrice.t)} ${dayLabel(lastPrice.t)}` : 'Imbalance price, £/MWh'}
            zero
          />
          <ViewTile
            to="/forecasts/wind"
            glyph="turbine"
            title="Wind forecast"
            id={WIND_FIXTURE_MODEL}
            values={WIND_FIXTURE_DAY.map((r) => r['q_0.5'])}
            reading={`${Math.round(peak).toLocaleString('en-GB')} MW`}
            caption="Median day-ahead forecast, peak of one synthetic day. No wind model writes to the forecast store yet."
            fixture
          />
        </ul>
      </Panel>

      <div className="i-cat-grid">
        <Panel className="i-cat-sources" title="Sources" src="Grouped by what they measure. Counts are datasets configured in gridflow, not rows held locally.">
          {DOMAINS.map((d) => (
            <section key={d} className="i-domain" aria-labelledby={`i-domain-${d}`}>
              <h3 id={`i-domain-${d}`}>{d}</h3>
              <ul>
                {SOURCES.filter((s) => s.domain === d).map((s) => (
                  <SourceRow key={s.key} s={s} />
                ))}
              </ul>
            </section>
          ))}
        </Panel>

        <div className="i-cat-side">
          <Panel title="Reading the list">
            <dl className="i-legend">
              <div>
                <dt>
                  <span className="i-srow-view is-sample">Charted</span>
                </dt>
                <dd>An Explorer screen reads it through GridflowClient.</dd>
              </div>
              <div>
                <dt>
                  <FixtureTag>Fixture</FixtureTag>
                </dt>
                <dd>Synthetic data made in the browser, labelled wherever it appears.</dd>
              </div>
              <div>
                <dt>
                  <span className="is-none">Not read yet</span>
                </dt>
                <dd>Configured in gridflow; the Explorer has no screen for it.</dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Built in gridflow" src="Gold views and builders over the silver tables. Not read by the Explorer yet.">
            <ul className="i-gold">
              {GOLD.map((g) => (
                <li key={g.id}>
                  <code>{g.id}</code>
                  <span>{g.label}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- one source

const schedules = (f: Family) => [...new Set(f.datasets.map((d) => d.schedule))].join(' and ')

function FamilyTable({ families }: { families: Family[] }) {
  return (
    <table className="i-fam">
      <thead>
        <tr>
          <th scope="col">Group and datasets</th>
          <th scope="col">Fetched</th>
          <th scope="col">In the Explorer</th>
        </tr>
      </thead>
      <tbody>
        {families.map((f) => (
          <tr key={f.label} className={f.view ? 'is-charted' : undefined}>
            <th scope="row">
              <span className="i-fam-label">{f.label}</span>
              <span className="i-fam-ids">
                {f.datasets.map((d) => (
                  <code key={d.id}>{d.id}</code>
                ))}
              </span>
            </th>
            <td>{schedules(f)}</td>
            <td>
              {f.view ? (
                <ProtoLink to={f.view.to} className="i-srow-view">
                  {f.view.label}
                </ProtoLink>
              ) : (
                <span className="is-none">Not yet</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FamilyList({ families }: { families: Family[] }) {
  return (
    <ul className="i-famlist">
      {families.map((f) => (
        <li key={f.label}>
          <span className="i-fam-label">{f.label}</span>
          <span className="i-fam-ids">
            {f.datasets.map((d) => (
              <code key={d.id}>{d.id}</code>
            ))}
          </span>
          <span className="i-famlist-sched">Fetched {schedules(f)}</span>
        </li>
      ))}
    </ul>
  )
}

const KIND_ORDER: Kind[] = ['series', 'events', 'reference']

export function SourceScreen() {
  const { source } = useParams()
  const s = sourceByKey(source)
  if (!s) {
    return (
      <section className="gf-screen i-screen">
        <Head kind="datacentre" title="Unknown source" sub={`gridflow has no source called “${source ?? ''}”.`} />
        <p>
          <ProtoLink to="/sources" className="i-crumb-link">
            All sources
          </ProtoLink>
        </p>
      </section>
    )
  }
  const by = Object.fromEntries(KIND_ORDER.map((k) => [k, s.families.filter((f) => f.kind === k)])) as Record<Kind, Family[]>
  const counts = kindCounts(s)
  const charted = views(s)
  const hasSide = by.events.length > 0 || by.reference.length > 0 || charted.length > 0

  return (
    <section className="gf-screen i-screen">
      <nav className="i-crumb" aria-label="Breadcrumb">
        <ProtoLink to="/sources" className="i-crumb-link">
          All sources
        </ProtoLink>
        <span aria-hidden="true">/</span>
        <span>{s.domain}</span>
      </nav>
      <Head
        kind="datacentre"
        title={s.name}
        sub={s.blurb}
        stamp={`${plural(datasetCount(s), 'dataset', 'datasets')} configured in gridflow as ${s.key}, fetched from ${s.host}.`}
      />
      <div className={`i-src-grid${hasSide ? '' : ' is-single'}`}>
        <Panel
          className="i-src-main"
          title="Time series"
          src={`${plural(counts.series, 'dataset', 'datasets')} in ${plural(by.series.length, 'group', 'groups')}. Fetched is how often gridflow asks the source for new rows.`}
        >
          <FamilyTable families={by.series} />
        </Panel>
        {hasSide && (
          <div className="i-src-side">
            {charted.length > 0 && (
              <Panel title="In the Explorer" src="Screens that read this source now.">
                <ul className="i-src-views">
                  {charted.map((v) => (
                    <li key={v.to}>
                      <ProtoLink to={v.to} className="i-srow-view">
                        {v.label}
                      </ProtoLink>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
            {by.events.length > 0 && (
              <Panel title="Event feeds" src="Messages and actions rather than regular series; they would chart as timelines or counts.">
                <FamilyList families={by.events} />
              </Panel>
            )}
            {by.reference.length > 0 && (
              <Panel title="Reference tables" src="Registers and lookups that other datasets join to.">
                <FamilyList families={by.reference} />
              </Panel>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
