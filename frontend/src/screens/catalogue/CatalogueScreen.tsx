/**
 * The catalogue, the landing page the brand opens (DESIGN §7): a petrol band
 * with the intro and every source standing on the land, one column per
 * domain under its own coloured band, then a quiet key for the three kinds
 * of dataset and plain notes on where the list comes from and what gridflow
 * builds itself. Reads the source-list fixture until /api/sources lands.
 */
import { Link } from 'react-router-dom'
import { plural } from '../../design/format'
import { Screen } from '../../design/frame'
import { SourceSymbol } from '../../design/symbols'
import { useDocumentTitle } from '../../design/title'
import { CATALOGUE_SNAPSHOT, DOMAINS, GOLD, SOURCES, datasetCount, kindCounts, type Domain, type Kind, type Source } from '../../fixtures/catalogue'

const inDomain = (d: Domain) => SOURCES.filter((s) => s.domain === d)
const shortName = (s: Source) => s.name.replace(' Transparency', '')

const INTRO =
  'gridflow collects GB and European energy-market data from eight public sources into one local store. Pick a source to see its datasets; the charts you use most stay in the rail.'

const KINDS: Kind[] = ['series', 'events', 'reference']
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

/** Dataset count with its split into kinds, drawn as a short proportional bar. */
function Composition({ s }: { s: Source }) {
  const c = kindCounts(s)
  return (
    <div className="gf-comp">
      <strong>{plural(datasetCount(s), 'dataset', 'datasets')}</strong>
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

function Scene() {
  return (
    <header className="gf-scene">
      <div className="gf-scene-text">
        <h1>gridflow data</h1>
        <p>{INTRO}</p>
      </div>
      <div className="gf-scene-land">
        <Hills />
        <ul className="gf-scene-row">
          {SOURCES.map((s) => (
            <li key={s.key}>
              <Link to={`/sources/${s.key}`} className="gf-scene-site">
                <SourceSymbol source={s.key} domain={s.domain} size={54} />
                <span>{shortName(s)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  )
}

function DomainColumns() {
  return (
    <div className="gf-dcols">
      {DOMAINS.map((d) => (
        <section key={d} className={`gf-dcol is-${d.toLowerCase()}`} aria-labelledby={`gf-dc-${d}`}>
          <header className="gf-dcol-head">
            <div>
              <h2 id={`gf-dc-${d}`}>{d}</h2>
              <p>{DOMAIN_LINE[d]}</p>
              <p className="gf-dcol-count">
                {plural(inDomain(d).length, 'source', 'sources')}, {plural(inDomain(d).reduce((n, s) => n + datasetCount(s), 0), 'dataset', 'datasets')}
              </p>
            </div>
            <SourceSymbol source={DOMAIN_SYMBOL[d]} domain={d} size={64} />
          </header>
          <ul>
            {inDomain(d).map((s) => (
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
      ))}
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

/** gridflow's own tables in one sentence; the group an Explorer screen reads links to it. */
function GoldNote() {
  const parts = GOLD.map((g, i) => {
    const sep = i === 0 ? '' : i === GOLD.length - 1 ? ', and ' : ', '
    return (
      <span key={g.label}>
        {sep}
        {g.label}
        {g.view && (
          <>
            , which open in{' '}
            <Link to={g.view.to} title={g.relations.join(', ')}>
              {g.view.label}
            </Link>
          </>
        )}
      </span>
    )
  })
  return <p className="gf-footnote">gridflow also keeps tables of its own, built from these sources: {parts}.</p>
}

export function CatalogueScreen() {
  useDocumentTitle(null)
  return (
    <Screen className="gf-home">
      <Scene />
      <DomainColumns />
      <footer className="gf-home-foot">
        <KindKey />
        <GoldNote />
        <p className="gf-footnote">Source list copied from gridflow's settings on {CATALOGUE_SNAPSHOT}; it doesn't update itself yet.</p>
      </footer>
    </Screen>
  )
}
