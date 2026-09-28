/**
 * `/sources/:sourceKey/:familySlug`: the family's page when its folder
 * exists. Without one, a plain screen says what gridflow's source list knows
 * of the address: a group whose page is still to come, one the Explorer
 * doesn't draw, one that opens in a screen of its own, or nothing at all. A
 * page that throws while drawing shows the error in words instead of a
 * blank screen, and still settles `data-view-ready`, so a screenshot shows
 * what broke.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Head, Screen, type ViewState } from '../design/frame'
import { DatasetPage } from './_template/DatasetPage'
import { ErrorWords } from './_template/panels'
import { DEFAULT_ADAPTER } from './_data/adapters'
import { useManifest } from './_data/hooks'
import { familyLink, viewFor } from './registry'

class PageBoundary extends Component<{ children: ReactNode; title: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dataset page failed to draw', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Screen state="error">
        <Head title={this.props.title} sub="This page failed while drawing, so nothing on it can be trusted until it is fixed." />
        <p className="gf-state is-error" role="alert">
          {this.state.error.message}
        </p>
      </Screen>
    )
  }
}

/** An address with no page folder: what the source list says of it. */
function NoPage({ sourceKey, familySlug }: { sourceKey: string; familySlug: string }) {
  const manifest = useManifest(DEFAULT_ADAPTER)
  const source = manifest.value?.sources.find((s) => s.key === sourceKey)
  const family = source?.families.find((f) => f.slug === familySlug)
  const state: ViewState = manifest.state === 'data' ? 'empty' : manifest.state
  const back = source ? (
    <Link to={`/sources/${source.key}`} className="gf-crumb-link">
      {source.name}
    </Link>
  ) : null

  let body: ReactNode
  if (manifest.state === 'loading') body = <p className="gf-state">Reading gridflow's source list…</p>
  else if (manifest.state !== 'data') {
    body = (
      <p className={manifest.state === 'error' ? 'gf-state is-error' : 'gf-state'} role={manifest.state === 'error' ? 'alert' : 'status'}>
        Couldn't read gridflow's source list. <ErrorWords error={manifest.error} />
      </p>
    )
  } else if (!family) {
    body = <Head title="No page here" sub={`gridflow's source list has no group “${familySlug}” under “${sourceKey}”.`} />
  } else if ((family.page === 'pinned' || family.page === 'external') && family.route) {
    const link = familyLink(sourceKey, family)
    body = (
      <Head
        title={family.label}
        sub={
          <>
            This group opens in a screen of its own:{' '}
            <Link to={family.route} className="gf-view-link">
              {link?.label ?? family.label}
            </Link>
            .
          </>
        }
      />
    )
  } else if (family.page === 'not-built') {
    body = <Head title={family.label} sub={<>The Explorer doesn't draw this group. Its source page, {back}, lists its datasets and what is held of them.</>} />
  } else {
    body = <Head title={family.label} sub={<>This group's page is still to come. Its source page, {back}, lists its datasets and what is held of them.</>} />
  }

  return (
    <Screen state={state}>
      <nav className="gf-crumb" aria-label="Breadcrumb">
        <Link to="/sources" className="gf-crumb-link">
          All sources
        </Link>
        {back && (
          <>
            <span aria-hidden="true">/</span>
            {back}
          </>
        )}
      </nav>
      {body}
    </Screen>
  )
}

export function FamilyRoute() {
  const { sourceKey = '', familySlug = '' } = useParams()
  const entry = viewFor(sourceKey, familySlug)
  if (!entry) return <NoPage sourceKey={sourceKey} familySlug={familySlug} />
  return (
    <PageBoundary key={entry.route} title={entry.config.title}>
      <DatasetPage entry={entry} />
    </PageBoundary>
  )
}
