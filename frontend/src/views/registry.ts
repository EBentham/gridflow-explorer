/**
 * The dataset page registry: every `src/views/<source>/<family>/index.tsx`
 * is a page, found by `import.meta.glob`, so there is no central list to
 * edit. The folder names are the route: `/sources/<source>/<family>`, where
 * `<source>` is gridflow's source key and `<family>` the manifest family's
 * slug (kebab case of its label). Folders starting with `_` belong to the
 * template.
 */
import { sourceByKey } from '../fixtures/catalogue'
import type { ViewConfig } from './define'

export interface RegisteredView {
  source: string
  family: string
  route: string
  config: ViewConfig
}

const modules = import.meta.glob<{ default: ViewConfig }>(['./*/*/index.tsx', '!./_*/**'], { eager: true })

const VIEWS: RegisteredView[] = Object.entries(modules)
  .map(([path, mod]) => {
    const [, source, family] = path.split('/')
    return { source, family, route: `/sources/${source}/${family}`, config: mod.default }
  })
  .sort((a, b) => a.route.localeCompare(b.route))

export function allViews(): RegisteredView[] {
  return VIEWS
}

export function viewFor(source: string | undefined, family: string | undefined): RegisteredView | undefined {
  return VIEWS.find((v) => v.source === source && v.family === family)
}

/** The manifest's family slug for a label: kebab case (checked against every family on 26 Sep 2026). */
export function familySlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Whether `/sources/<key>` has a source page to go back to (the source list is still the fixture until P4-0). */
export function hasSourcePage(key: string): boolean {
  return sourceByKey(key) !== undefined
}
