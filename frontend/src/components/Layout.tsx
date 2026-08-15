import { NavLink, Outlet } from 'react-router-dom'
import { useDatasets } from '../hooks/useDatasets'

/** Header with a nav of dataset links (from the live catalogue) plus the routed screen. */
export function Layout() {
  const { data: datasets, loading, error } = useDatasets()

  return (
    <div className="layout">
      <header className="layout-header">
        <h1>Gridflow Explorer</h1>
        <nav>
          {loading && <span className="nav-status">Loading datasets…</span>}
          {error && <span className="nav-status">Failed to load datasets: {error.message}</span>}
          {datasets?.map((dataset) => (
            <NavLink key={dataset.id} to={`/datasets/${dataset.id}`}>
              {dataset.title}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}
