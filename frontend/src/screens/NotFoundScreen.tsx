import { Link, useLocation } from 'react-router-dom'
import { Head, Screen } from '../design/frame'

/** Any address the Explorer has no screen for: say so, and point back to the catalogue. */
export function NotFoundScreen() {
  const { pathname } = useLocation()
  return (
    <Screen state="empty">
      <Head
        title="No screen here"
        sub={
          <>
            The Explorer has nothing at <code>{pathname}</code>. Every dataset is reached from the catalogue.
          </>
        }
      />
      <p>
        <Link to="/sources" className="gf-crumb-link">
          All sources
        </Link>
      </p>
    </Screen>
  )
}
