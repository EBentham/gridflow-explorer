/**
 * The catalogue, the landing page the brand opens (DESIGN §7): a petrol band
 * with the intro and every source standing on the land, one column per
 * domain under its own coloured band, then a quiet key for the three kinds
 * of dataset and a plain note on where the list comes from. Reads gridflow's
 * source list (`GET /api/sources`), gridflow's own tables included.
 */
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { plural } from '../../design/format'
import { Screen, type ViewState } from '../../design/frame'
import { SourceSymbol } from '../../design/symbols'
import { instantLabel } from '../../design/time'
import { useDocumentTitle } from '../../design/title'
import { DEFAULT_ADAPTER } from '../../views/_data/adapters'
import { useManifest } from '../../views/_data/hooks'
import type { Domain, Kind, ManifestSource } from '../../views/contract'
import { SourceListStatus } from './SourceListStatus'
import { countWord, datasetsOf, DOMAINS, inSceneOrder, KINDS, kindCounts, shortName } from './sourceList'

const KIND_LABEL: Record<Kind, [string, string]> = {
  series: ['time series', 'time series'],
  events: ['event feed', 'event feeds'],
  reference: ['reference table', 'reference tables'],
}
const KIND_KEY: Record<Kind, [string, string]> = {
  series: ['Time series', 'values on a regular clock, such as every half-hour'],
  events: ['Event feeds', 'records of things as they happen, such as accepted bids or outage notices'],
  reference: ['Reference tables', 'lookups with no clock, such as the register of BM units'],
}

const DOMAIN_LINE: Record<Domain, string> = {
  Electricity: 'Prices, generation, demand, balancing and carbon, for GB and its neighbours.',
  Gas: 'Flows, capacity, storage and LNG across the European gas network.',
  Weather: 'The weather behind demand, wind and solar output.',
}
const DOMAIN_SYMBOL: Record<Domain, string> = { Electricity: 'entsoe', Gas: 'entsog', Weather: 'open_meteo' }

function intro(sources: ManifestSource[] | null): string {
  const published = sources?.filter((s) => s.layer !== 'gold').length
  const from = published ? `from ${countWord(published)} public sources` : 'from public sources'
  const own = sources?.some((s) => s.layer === 'gold') ? ', and builds tables of its own from them' : ''
  return `gridflow collects GB and European energy-market data ${from} into one local store${own}. Pick a source to see its datasets; the charts you use most stay in the rail.`
}

/** Dataset count with its split into kinds, drawn as a short proportional bar. */
function Composition({ s }: { s: ManifestSource }) {
  const datasets = datasetsOf(s.families)
  const c = kindCounts(s.families)
  return (
    <div className="gf-comp">
      <strong>{plural(datasets.length, 'dataset', 'datasets')}</strong>
      <span className="gf-comp-bar" aria-hidden="true">
        {KINDS.map((k) => (c[k] ? <span key={k} className={`is-${k}`} style={{ flexGrow: c[k] }} /> : null))}
      </span>
      <span className="gf-comp-text">
        {KINDS.filter((k) => c[k]).map((k) => (
          <span key={k} className={`gf-comp-kind is-${k}`}>
            {plural(c[k], ...KIND_LABEL[k])}
          </span>
        ))}
      </span>
    </div>
  )
}

function Hills() {
  return (
    <svg className="gf-scene-hills" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
      <path className="gf-scene-far" d="M0 62 C120 30 240 26 380 50 C520 74 640 34 780 38 C880 41 950 56 1000 50 V120 H0 Z" />
      <path className="gf-scene-near" d="M0 86 C160 64 300 70 460 82 C600 92 760 66 1000 74 V120 H0 Z" />
    </svg>
  )
}

function Scene({ sources }: { sources: ManifestSource[] | null }) {
  return (
    <header className="gf-scene">
      <div className="gf-scene-text">
        <h1>gridflow data</h1>
        <p>{intro(sources)}</p>
      </div>
      <div className="gf-scene-land">
        <Hills />
        {sources && (
          <ul className="gf-scene-row" style={{ '--scene-sites': sources.length } as CSSProperties}>
            {sources.map((s) => (
              <li key={s.key}>
                <Link to={`/sources/${s.key}`} className="gf-scene-site">
                  <SourceSymbol source={s.key} domain={s.domain} size={54} />
                  <span>{shortName(s)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </header>
  )
}

function DomainColumns({ sources }: { sources: ManifestSource[] }) {
  return (
    <div className="gf-dcols">
      {DOMAINS.map((d) => {
        const here = sources.filter((s) => s.domain === d)
        return (
          <section key={d} className={`gf-dcol is-${d.toLowerCase()}`} aria-labelledby={`gf-dc-${d}`}>
            <header className="gf-dcol-head">
              <div>
                <h2 id={`gf-dc-${d}`}>{d}</h2>
                <p>{DOMAIN_LINE[d]}</p>
                <p className="gf-dcol-count">
                  {plural(here.length, 'source', 'sources')}, {plural(here.reduce((n, s) => n + datasetsOf(s.families).length, 0), 'dataset', 'datasets')}
                </p>
              </div>
              <SourceSymbol source={DOMAIN_SYMBOL[d]} domain={d} size={64} />
            </header>
            <ul>
              {here.map((s) => (
                <li key={s.key} className="gf-dsrc">
                  <SourceSymbol source={s.key} domain={s.domain} size={44} />
                  <div>
                    <h3>
                      <Link to={`/sources/${s.key}`} className="gf-dsrc-link">
                        {s.name}
                      </Link>
                    </h3>
                    <p>{s.blurb}</p>
                    <Composition s={s} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function KindKey() {
  return (
    <dl className="gf-kindkey" aria-label="Kinds of dataset">
      {KINDS.map((k) => (
        <div key={k}>
          <dt className={`gf-comp-kind is-${k}`}>{KIND_KEY[k][0]}</dt>
          <dd>{KIND_KEY[k][1]}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CatalogueScreen() {
  useDocumentTitle(null)
  const manifest = useManifest(DEFAULT_ADAPTER)
  const sources = manifest.value ? inSceneOrder(manifest.value.sources) : null
  const read = manifest.value ? Date.parse(manifest.value.generated_at) : NaN
  const state: ViewState = manifest.state === 'data' ? (sources?.length ? 'data' : 'empty') : manifest.state
  return (
    <Screen className="gf-home" state={state}>
      <Scene sources={sources} />
      {sources ? (
        sources.length ? (
          <DomainColumns sources={sources} />
        ) : (
          <p className="gf-state">gridflow's source list is empty.</p>
        )
      ) : (
        <SourceListStatus state={manifest.state} error={manifest.error} />
      )}
      <footer className="gf-home-foot">
        <KindKey />
        {Number.isFinite(read) && <p className="gf-footnote">Source list as gridflow's settings stood at {instantLabel(read)}. Each source's page says which of its datasets are held locally.</p>}
      </footer>
    </Screen>
  )
}
