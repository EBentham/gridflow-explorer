/**
 * Slot i, one source's page: its datasets in groups, split into time series,
 * event feeds and reference tables, and which ones the Explorer draws. The
 * landing page that lists every source lives in home.tsx.
 */
import { useParams } from 'react-router-dom'
import { ProtoLink } from '../../controls'
import { datasetCount, kindCounts, sourceByKey, views, type Family, type Kind } from './catalogue'
import { Head, Panel } from './screens'
import { SourceSymbol } from './symbols'
import './sources.css'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

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
        emblem={<SourceSymbol source={s.key} domain={s.domain} size={64} />}
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
