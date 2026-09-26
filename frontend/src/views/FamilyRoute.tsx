/**
 * `/sources/:sourceKey/:familySlug`: the family's page when its folder
 * exists, a plain "no page yet" screen when it doesn't. A page that throws
 * while drawing shows the error in words instead of a blank screen, and still
 * settles `data-view-ready`, so a screenshot shows what broke.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Head, Screen } from '../design/frame'
import { DatasetPage } from './_template/DatasetPage'
import { hasSourcePage, viewFor } from './registry'

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

export function FamilyRoute() {
  const { sourceKey, familySlug } = useParams()
  const entry = viewFor(sourceKey, familySlug)
  if (!entry) {
    return (
      <Screen state="empty">
        <nav className="gf-crumb" aria-label="Breadcrumb">
          <Link to="/sources" className="gf-crumb-link">
            All sources
          </Link>
          {sourceKey && hasSourcePage(sourceKey) && (
            <>
              <span aria-hidden="true">/</span>
              <Link to={`/sources/${sourceKey}`} className="gf-crumb-link">
                {sourceKey}
              </Link>
            </>
          )}
        </nav>
        <Head
          title="No page yet"
          sub={`The Explorer has no page for “${familySlug ?? ''}” under “${sourceKey ?? ''}”. ${sourceKey && hasSourcePage(sourceKey) ? 'Its source page' : 'All sources'} lists what gridflow holds.`}
        />
      </Screen>
    )
  }
  return (
    <PageBoundary key={entry.route} title={entry.config.title}>
      <DatasetPage entry={entry} />
    </PageBoundary>
  )
}
