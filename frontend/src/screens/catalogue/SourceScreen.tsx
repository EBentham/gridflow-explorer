/**
 * One source's page (DESIGN §8): its datasets in groups, split into time
 * series, event feeds and reference tables, which of them are held locally
 * (a dataset that isn't is named, with why), and where the Explorer draws a
 * group: a screen of its own, or a dataset page from `src/views/`. Reads
 * gridflow's source list (`GET /api/sources`).
 */
import { Link, useParams } from 'react-router-dom'
import { plural } from '../../design/format'
import { Head, Panel, Screen, type ViewState } from '../../design/frame'
import { SourceSymbol } from '../../design/symbols'
import { DEFAULT_ADAPTER } from '../../views/_data/adapters'
import { useManifest } from '../../views/_data/hooks'
import { notHeldText } from '../../views/_template/text'
import type { Kind, ManifestDataset, ManifestFamily, ManifestSource } from '../../views/contract'
import { allViews, familyLink } from '../../views/registry'
import { SourceListStatus } from './SourceListStatus'
import { datasetsOf, schedulesOf } from './sourceList'

function Ids({ ds }: { ds: ManifestDataset[] }) {
  return ds.map((d, i) => (
    <span key={d.id}>
      {i > 0 && (i === ds.length - 1 ? ' and ' : ', ')}
      <code>{d.id}</code>
    </span>
  ))
}

/** The family's held ids, then those it lists that aren't held, grouped by why. */
function FamilyIds({ f, layer }: { f: ManifestFamily; layer: ManifestSource['layer'] }) {
  const held = f.datasets.filter((d) => d.held)
  const byCause = new Map<string, ManifestDataset[]>()
  for (const d of f.datasets.filter((x) => !x.held)) {
    const why = notHeldText(d.not_held_cause, { layer })
    byCause.set(why, [...(byCause.get(why) ?? []), d])
  }
  return (
    <>
      {held.length > 0 && (
        <span className="gf-fam-ids">
          {held.map((d) => (
            <code key={d.id}>{d.id}</code>
          ))}
        </span>
      )}
      {byCause.size > 0 && (
        <span className="gf-fam-gone">
          Not held locally:{' '}
          {[...byCause.values()].map((ds, i) => (
            <span key={ds[0].id}>
              {i > 0 && '; '}
              <Ids ds={ds} /> ({notHeldText(ds[0].not_held_cause, { many: ds.length > 1, layer })})
            </span>
          ))}
          .
        </span>
      )}
    </>
  )
}

/** What the Explorer column says of a group without a screen: a page still to come, or none. */
const noLink = (f: ManifestFamily) => (f.page === 'not-built' ? 'Not drawn' : 'Not yet')

function FamilyTable({ source, families }: { source: ManifestSource; families: ManifestFamily[] }) {
  const gold = source.layer === 'gold'
  return (
    <table className="gf-fam">
      <thead>
        <tr>
          <th scope="col">Group and datasets</th>
          <th scope="col">{gold ? 'Made' : 'Fetched'}</th>
          <th scope="col">In the Explorer</th>
        </tr>
      </thead>
      <tbody>
        {families.map((f) => {
          const link = familyLink(source.key, f)
          return (
            <tr key={f.slug} className={link ? 'is-charted' : undefined}>
              <th scope="row">
                <span className="gf-fam-label">{f.label}</span>
                <FamilyIds f={f} layer={source.layer} />
              </th>
              <td>{schedulesOf(f)}</td>
              <td>
                {link ? (
                  <Link to={link.to} className="gf-view-link">
                    {link.label}
                  </Link>
                ) : (
                  <span className="is-none">{noLink(f)}</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function FamilyList({ source, families }: { source: ManifestSource; families: ManifestFamily[] }) {
  return (
    <ul className="gf-famlist">
      {families.map((f) => {
        const link = familyLink(source.key, f)
        return (
          <li key={f.slug}>
            <span className="gf-fam-label">{f.label}</span>
            <FamilyIds f={f} layer={source.layer} />
            <span className="gf-famlist-sched">{source.layer === 'gold' ? `Made ${schedulesOf(f)}` : `Fetched ${schedulesOf(f)}`}</span>
            {link && (
              <Link to={link.to} className="gf-view-link">
                {link.label}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}

const KIND_ORDER: Kind[] = ['series', 'events', 'reference']

/** `31 of them held locally`: how much of the list the local store holds. */
function heldText(datasets: ManifestDataset[]): string {
  const held = datasets.filter((d) => d.held).length
  if (held === datasets.length) return datasets.length === 1 ? 'It is held locally.' : 'All are held locally.'
  if (held === 0) return 'None is held locally yet.'
  return `${held} of them ${held === 1 ? 'is' : 'are'} held locally.`
}

function SourceBody({ s }: { s: ManifestSource }) {
  const by = Object.fromEntries(KIND_ORDER.map((k) => [k, s.families.filter((f) => f.kind === k)])) as Record<Kind, ManifestFamily[]>
  const datasets = datasetsOf(s.families)
  const gold = s.layer === 'gold'
  // Screens of their own first, then the source's dataset pages, each once.
  const charted = [...s.families.flatMap((f) => (f.page === 'pinned' || f.page === 'external' ? [familyLink(s.key, f)] : [])), ...allViews()
    .filter((v) => v.source === s.key)
    .map((v) => ({ to: v.route, label: v.config.title }))]
    .filter((v): v is { to: string; label: string } => Boolean(v))
    .filter((v, i, all) => all.findIndex((w) => w.to === v.to) === i)
  const hasSide = by.events.length > 0 || by.reference.length > 0 || charted.length > 0
  const seriesCount = datasetsOf(by.series).length

  return (
    <>
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
          gold ? (
            <>
              {plural(datasets.length, 'dataset', 'datasets')} gridflow builds from the other sources, under the key <code>{s.key}</code>. {heldText(datasets)}
            </>
          ) : (
            <>
              {plural(datasets.length, 'dataset', 'datasets')} in gridflow's source list under the key <code>{s.key}</code>, fetched from {s.host}. {heldText(datasets)}
            </>
          )
        }
      />
      <div className={`gf-src-grid${hasSide ? '' : ' is-single'}`}>
        <Panel
          title="Time series"
          src={
            gold
              ? `${plural(seriesCount, 'dataset', 'datasets')} in ${plural(by.series.length, 'group', 'groups')}, each built by gridflow from other datasets.`
              : `${plural(seriesCount, 'dataset', 'datasets')} in ${plural(by.series.length, 'group', 'groups')}. Fetched is how often gridflow asks the source for new rows.`
          }
        >
          {by.series.length ? <FamilyTable source={s} families={by.series} /> : <p className="is-none">This source has no time series in gridflow's list.</p>}
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
              <Panel title="Event feeds" src="Messages and actions rather than regular series; they read as tables of events.">
                <FamilyList source={s} families={by.events} />
              </Panel>
            )}
            {by.reference.length > 0 && (
              <Panel title="Reference tables" src="Registers and lookups that other datasets join to.">
                <FamilyList source={s} families={by.reference} />
              </Panel>
            )}
          </div>
        )}
      </div>
    </>
  )
}

export function SourceScreen() {
  const { sourceKey } = useParams()
  const manifest = useManifest(DEFAULT_ADAPTER)
  const s = manifest.value?.sources.find((x) => x.key === sourceKey)

  if (manifest.state !== 'data') {
    return (
      <Screen state={manifest.state as ViewState}>
        <nav className="gf-crumb" aria-label="Breadcrumb">
          <Link to="/sources" className="gf-crumb-link">
            All sources
          </Link>
        </nav>
        <SourceListStatus state={manifest.state} error={manifest.error} />
      </Screen>
    )
  }
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
  return (
    <Screen>
      <SourceBody s={s} />
    </Screen>
  )
}
