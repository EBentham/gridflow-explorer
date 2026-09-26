/**
 * The dataset page registry: every `src/views/<source>/<family>/index.tsx`
 * is a page, found by `import.meta.glob`, so there is no central list to
 * edit. The folder names are the route: `/sources/<source>/<family>`, where
 * `<source>` is gridflow's source key and `<family>` the source list's
 * family slug (kebab case of its label). Folders starting with `_` belong to
 * the template.
 */
import { PINNED } from '../shell/pinned'
import type { ManifestFamily } from './contract'
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

/** The screens outside `src/views` a family can open in, by route: the pinned ones and the forecasts. */
const SCREENS = new Map<string, string>([...PINNED.map((p) => [p.to, p.label] as const), ['/forecasts', 'Forecasts']])

/**
 * Where the Explorer shows a family: the screen of its own a pinned or
 * external family opens in, else its page in `src/views/`. Undefined when
 * neither exists yet.
 */
export function familyLink(source: string, family: Pick<ManifestFamily, 'slug' | 'label' | 'page' | 'route'>): { to: string; label: string } | undefined {
  if ((family.page === 'pinned' || family.page === 'external') && family.route) return { to: family.route, label: SCREENS.get(family.route) ?? family.label }
  const page = viewFor(source, family.slug)
  return page ? { to: page.route, label: page.config.title } : undefined
}
