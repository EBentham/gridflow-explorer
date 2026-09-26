/**
 * One source's page (DESIGN §8): its datasets in groups, split into time
 * series, event feeds and reference tables, and which groups the Explorer
 * draws. Reads the source-list fixture until /api/sources lands.
 */
import { Link, useParams } from 'react-router-dom'
import { listText, plural } from '../../design/format'
import { Head, Panel, Screen } from '../../design/frame'
import { SourceSymbol } from '../../design/symbols'
import { datasetCount, kindCounts, sourceByKey, views, type Family, type Kind } from '../../fixtures/catalogue'

const schedules = (f: Family) => listText([...new Set(f.datasets.map((d) => d.schedule))])

function FamilyIds({ f }: { f: Family }) {
  return (
    <span className="gf-fam-ids">
      {f.datasets.map((d) => (
        <code key={d.id}>{d.id}</code>
      ))}
    </span>
  )
}

function FamilyTable({ families }: { families: Family[] }) {
  return (
    <table className="gf-fam">
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
              <span className="gf-fam-label">{f.label}</span>
              <FamilyIds f={f} />
            </th>
            <td>{schedules(f)}</td>
            <td>
              {f.view ? (
                <Link to={f.view.to} className="gf-view-link">
                  {f.view.label}
                </Link>
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
    <ul className="gf-famlist">
      {families.map((f) => (
        <li key={f.label}>
          <span className="gf-fam-label">{f.label}</span>
          <FamilyIds f={f} />
          <span className="gf-famlist-sched">Fetched {schedules(f)}</span>
        </li>
      ))}
    </ul>
  )
}

const KIND_ORDER: Kind[] = ['series', 'events', 'reference']

export function SourceScreen() {
  const { sourceKey } = useParams()
  const s = sourceByKey(sourceKey)
  if (!s) {
    return (
      <Screen state="empty">
        <Head title="Unknown source" sub={`gridflow's source list has no source called “${sourceKey ?? ''}”.`} />
        <p>
          <Link to="/sources" className="gf-crumb-link">
            All sources
          </Link>
        </p>
      </Screen>
    )
  }
  const by = Object.fromEntries(KIND_ORDER.map((k) => [k, s.families.filter((f) => f.kind === k)])) as Record<Kind, Family[]>
  const counts = kindCounts(s)
  const charted = views(s)
  const hasSide = by.events.length > 0 || by.reference.length > 0 || charted.length > 0

  return (
    <Screen>
      <nav className="gf-crumb" aria-label="Breadcrumb">
        <Link to="/sources" className="gf-crumb-link">
          All sources
        </Link>
        <span aria-hidden="true">/</span>
        <span>{s.domain}</span>
      </nav>
      <Head
        emblem={<SourceSymbol source={s.key} domain={s.domain} size={64} />}
        title={s.name}
        sub={s.blurb}
        stamp={
          <>
            {plural(datasetCount(s), 'dataset', 'datasets')} in gridflow's source list under the key <code>{s.key}</code>, fetched from {s.host}.
          </>
        }
      />
      <div className={`gf-src-grid${hasSide ? '' : ' is-single'}`}>
        <Panel
          title="Time series"
          src={`${plural(counts.series, 'dataset', 'datasets')} in ${plural(by.series.length, 'group', 'groups')}. Fetched is how often gridflow asks the source for new rows.`}
        >
          <FamilyTable families={by.series} />
        </Panel>
        {hasSide && (
          <div className="gf-src-side">
            {charted.length > 0 && (
              <Panel title="In the Explorer" src="Screens that read this source now.">
                <ul className="gf-src-views">
                  {charted.map((v) => (
                    <li key={v.to}>
                      <Link to={v.to} className="gf-view-link">
                        {v.label}
                      </Link>
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
    </Screen>
  )
}
