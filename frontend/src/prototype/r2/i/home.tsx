/**
 * Slot i, landing page (the brand opens it). A petrol band with the intro and
 * every source standing on the land, then one column per domain under its own
 * coloured band, and a quiet key for the three kinds of dataset.
 */
import { ProtoLink } from '../../controls'
import { DOMAINS, SOURCES, datasetCount, kindCounts, type Domain, type Kind, type Source } from './catalogue'
import { SourceSymbol } from './symbols'
import './home.css'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const inDomain = (d: Domain) => SOURCES.filter((s) => s.domain === d)
const shortName = (s: Source) => s.name.replace(' Transparency', '')

const INTRO =
  'gridflow collects GB and European energy-market data from eight public sources into one local store. Pick a source to see its datasets; the charts you use most stay in the rail.'
const COPY_NOTE = "Source list copied from gridflow's settings on 26 Sep 2026; it doesn't update itself yet."

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
    <div className="i-comp">
      <strong>{plural(datasetCount(s), 'dataset', 'datasets')}</strong>
      <span className="i-comp-bar" aria-hidden="true">
        {KINDS.map((k) => (c[k] ? <span key={k} className={`is-${k}`} style={{ flexGrow: c[k] }} /> : null))}
      </span>
      <span className="i-comp-text">
        {KINDS.filter((k) => c[k]).map((k) => (
          <span key={k} className={`i-comp-kind is-${k}`}>
            {plural(c[k], ...KIND_LABEL[k])}
          </span>
        ))}
      </span>
    </div>
  )
}

function Hills() {
  return (
    <svg className="i-scene-hills" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
      <path className="i-scene-far" d="M0 62 C120 30 240 26 380 50 C520 74 640 34 780 38 C880 41 950 56 1000 50 V120 H0 Z" />
      <path className="i-scene-near" d="M0 86 C160 64 300 70 460 82 C600 92 760 66 1000 74 V120 H0 Z" />
    </svg>
  )
}

function Scene() {
  return (
    <header className="i-scene">
      <div className="i-scene-text">
        <h1>gridflow data</h1>
        <p>{INTRO}</p>
      </div>
      <div className="i-scene-land">
        <Hills />
        <ul className="i-scene-row">
          {SOURCES.map((s) => (
            <li key={s.key}>
              <ProtoLink to={`/sources/${s.key}`} className="i-scene-site">
                <SourceSymbol source={s.key} domain={s.domain} size={54} />
                <span>{shortName(s)}</span>
              </ProtoLink>
            </li>
          ))}
        </ul>
      </div>
    </header>
  )
}

function DomainColumns() {
  return (
    <div className="i-dcols">
      {DOMAINS.map((d) => (
        <section key={d} className={`i-dcol is-${d.toLowerCase()}`} aria-labelledby={`i-dc-${d}`}>
          <header className="i-dcol-head">
            <div>
              <h2 id={`i-dc-${d}`}>{d}</h2>
              <p>{DOMAIN_LINE[d]}</p>
              <p className="i-dcol-count">
                {plural(inDomain(d).length, 'source', 'sources')}, {plural(inDomain(d).reduce((n, s) => n + datasetCount(s), 0), 'dataset', 'datasets')}
              </p>
            </div>
            <SourceSymbol source={DOMAIN_SYMBOL[d]} domain={d} size={64} />
          </header>
          <ul>
            {inDomain(d).map((s) => (
              <li key={s.key} className="i-dsrc">
                <SourceSymbol source={s.key} domain={s.domain} size={44} />
                <div>
                  <h3>
                    <ProtoLink to={`/sources/${s.key}`} className="i-dsrc-link">
                      {s.name}
                    </ProtoLink>
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
    <dl className="i-kindkey" aria-label="Kinds of dataset">
      {KINDS.map((k) => (
        <div key={k}>
          <dt className={`i-comp-kind is-${k}`}>{KIND_KEY[k][0]}</dt>
          <dd>{KIND_KEY[k][1]}</dd>
        </div>
      ))}
    </dl>
  )
}

export function CatalogueScreen() {
  return (
    <section className="gf-screen i-screen i-home">
      <Scene />
      <DomainColumns />
      <footer className="i-home-foot">
        <KindKey />
        <p className="i-copynote">{COPY_NOTE}</p>
      </footer>
    </section>
  )
}
