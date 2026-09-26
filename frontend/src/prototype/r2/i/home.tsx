/**
 * Slot i, landing page (the brand opens it). Three candidate layouts, picked
 * with `?home=a|b|c` while Bobbo chooses; all share the source symbols, the
 * domain colours and one source row.
 *   a  Landscape: a petrol band where every source stands on the land.
 *   b  Strata: an intro beside the bronze, silver and gold layers, then the list.
 *   c  Domains: one column per domain, each under its own coloured band.
 */
import { useSearchParams } from 'react-router-dom'
import { useProto } from '../../context'
import { ProtoLink } from '../../controls'
import { DOMAINS, GOLD, SOURCES, datasetCount, kindCounts, type Domain, type Kind, type Source } from './catalogue'
import { SourceSymbol } from './symbols'
import './home.css'

type Option = 'a' | 'b' | 'c'
const OPTIONS: { key: Option; label: string }[] = [
  { key: 'a', label: 'Landscape' },
  { key: 'b', label: 'Strata' },
  { key: 'c', label: 'Domains' },
]

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const TOTAL = SOURCES.reduce((n, s) => n + datasetCount(s), 0)
const KIND_TOTAL = SOURCES.reduce(
  (acc, s) => {
    const c = kindCounts(s)
    return { series: acc.series + c.series, events: acc.events + c.events, reference: acc.reference + c.reference }
  },
  { series: 0, events: 0, reference: 0 } as Record<Kind, number>,
)
const inDomain = (d: Domain) => SOURCES.filter((s) => s.domain === d)
const shortName = (s: Source) => s.name.replace(' Transparency', '')

const INTRO =
  'gridflow collects GB and European energy-market data from eight public sources into one local store. Pick a source to see its datasets; the charts you use most stay in the rail.'
const COPY_NOTE = "Source list copied from gridflow's settings on 26 Sep 2026; it doesn't update itself yet."

const KIND_LABEL: Record<Kind, [string, string]> = {
  series: ['time series', 'time series'],
  events: ['event feed', 'event feeds'],
  reference: ['reference table', 'reference tables'],
}
const KINDS: Kind[] = ['series', 'events', 'reference']

// ---------------------------------------------------------------- shared pieces

/** Dataset count with its split into kinds, drawn as a short proportional bar. */
function Composition({ s }: { s: Source }) {
  const c = kindCounts(s)
  const n = datasetCount(s)
  return (
    <div className="i-comp">
      <strong>{plural(n, 'dataset', 'datasets')}</strong>
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

function SourceRow({ s }: { s: Source }) {
  return (
    <li className={`i-hrow is-${s.domain.toLowerCase()}`}>
      <div className="i-hrow-name">
        <h4>
          <ProtoLink to={`/sources/${s.key}`} className="i-hrow-link">
            {s.name}
          </ProtoLink>
        </h4>
        <code>{s.key}</code>
      </div>
      <p className="i-hrow-blurb">{s.blurb}</p>
      <Composition s={s} />
      <SourceSymbol source={s.key} domain={s.domain} size={48} />
    </li>
  )
}

function SourceList() {
  return (
    <div className="i-hlist">
      {DOMAINS.map((d) => (
        <section key={d} className={`i-hdomain is-${d.toLowerCase()}`} aria-labelledby={`i-hd-${d}`}>
          <header className="i-hdomain-head">
            <h2 id={`i-hd-${d}`}>{d}</h2>
            <span>
              {plural(inDomain(d).length, 'source', 'sources')}, {plural(inDomain(d).reduce((n, s) => n + datasetCount(s), 0), 'dataset', 'datasets')}
            </span>
          </header>
          <ul>
            {inDomain(d).map((s) => (
              <SourceRow key={s.key} s={s} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Facts() {
  return (
    <dl className="i-hfacts">
      <div>
        <dt>Sources</dt>
        <dd>{SOURCES.length}</dd>
      </div>
      <div>
        <dt>Datasets</dt>
        <dd>{TOTAL}</dd>
      </div>
      <div>
        <dt>Time series</dt>
        <dd>{KIND_TOTAL.series}</dd>
      </div>
      <div>
        <dt>Event feeds</dt>
        <dd>{KIND_TOTAL.events}</dd>
      </div>
    </dl>
  )
}

// ---------------------------------------------------------------- a: landscape

function Hills() {
  return (
    <svg className="i-scene-hills" viewBox="0 0 1000 120" preserveAspectRatio="none" aria-hidden="true">
      <path className="i-scene-far" d="M0 62 C120 30 240 26 380 50 C520 74 640 34 780 38 C880 41 950 56 1000 50 V120 H0 Z" />
      <path className="i-scene-near" d="M0 86 C160 64 300 70 460 82 C600 92 760 66 1000 74 V120 H0 Z" />
    </svg>
  )
}

function HomeLandscape() {
  return (
    <>
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
      <SourceList />
      <p className="i-copynote">{COPY_NOTE}</p>
    </>
  )
}

// ---------------------------------------------------------------- b: strata

function StrataDiagram() {
  return (
    <figure className="i-strata" aria-label="How gridflow stores what it fetches">
      <svg viewBox="0 0 400 210" preserveAspectRatio="none" aria-hidden="true">
        <path className="i-strata-gold" d="M0 18 C80 10 160 26 240 16 C310 8 360 20 400 14 V74 C330 80 260 66 180 74 C110 82 50 70 0 76 Z" />
        <path className="i-strata-silver" d="M0 76 C50 70 110 82 180 74 C260 66 330 80 400 74 V142 C320 150 250 134 170 142 C100 150 40 138 0 144 Z" />
        <path className="i-strata-bronze" d="M0 144 C40 138 100 150 170 142 C250 134 320 150 400 142 V210 H0 Z" />
      </svg>
      <ol>
        <li className="is-gold">
          <strong>Gold</strong>
          <span>{GOLD.length} derived views and tables built from silver</span>
        </li>
        <li className="is-silver">
          <strong>Silver</strong>
          <span>{TOTAL} typed tables, one per dataset. The Explorer reads here.</span>
        </li>
        <li className="is-bronze">
          <strong>Bronze</strong>
          <span>Raw responses, exactly as each source sent them</span>
        </li>
      </ol>
    </figure>
  )
}

function HomeStrata() {
  return (
    <>
      <header className="i-hintro">
        <div className="i-hintro-text">
          <h1>gridflow data</h1>
          <p>{INTRO}</p>
          <Facts />
        </div>
        <StrataDiagram />
      </header>
      <SourceList />
      <p className="i-copynote">{COPY_NOTE}</p>
    </>
  )
}

// ---------------------------------------------------------------- c: domains

const DOMAIN_LINE: Record<Domain, string> = {
  Electricity: 'Prices, generation, demand, balancing and carbon, for GB and its neighbours.',
  Gas: 'Flows, capacity, storage and LNG across the European gas network.',
  Weather: 'The weather behind demand, wind and solar output.',
}
const DOMAIN_SYMBOL: Record<Domain, string> = { Electricity: 'entsoe', Gas: 'entsog', Weather: 'open_meteo' }

function HomeDomains() {
  return (
    <>
      <header className="i-hintro is-compact">
        <div className="i-hintro-text">
          <h1>gridflow data</h1>
          <p>{INTRO}</p>
        </div>
        <Facts />
      </header>
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
                      <ProtoLink to={`/sources/${s.key}`} className="i-hrow-link">
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
      <p className="i-copynote">{COPY_NOTE}</p>
    </>
  )
}

// ---------------------------------------------------------------- screen

/** PROTOTYPE: picks between the three layouts while they're being compared. */
function OptionSwitch({ current }: { current: Option }) {
  const [params, setParams] = useSearchParams()
  const { search } = useProto()
  if (search.includes('embed=1')) return null
  return (
    <div className="proto-opts" role="group" aria-label="Landing page option">
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={current === o.key}
          onClick={() => {
            const next = new URLSearchParams(params)
            next.set('home', o.key)
            setParams(next, { replace: true })
          }}
        >
          {o.key.toUpperCase()}, {o.label}
        </button>
      ))}
    </div>
  )
}

export function CatalogueScreen() {
  const [params] = useSearchParams()
  const raw = params.get('home')
  const option: Option = raw === 'b' || raw === 'c' ? raw : 'a'
  return (
    <section className={`gf-screen i-screen i-home is-${option}`}>
      {option === 'a' && <HomeLandscape />}
      {option === 'b' && <HomeStrata />}
      {option === 'c' && <HomeDomains />}
      <OptionSwitch current={option} />
    </section>
  )
}
