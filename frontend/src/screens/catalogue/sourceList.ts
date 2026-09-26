/**
 * The catalogue's reading of gridflow's source list (`GET /api/sources`):
 * the domains in their order, the sources in scene order, each source's
 * datasets counted by kind, and how often a group is fetched.
 */
import { listText } from '../../design/format'
import type { Domain, Kind, ManifestDataset, ManifestFamily, ManifestSource } from '../../views/contract'

export const DOMAINS: Domain[] = ['Electricity', 'Gas', 'Weather']
export const KINDS: Kind[] = ['series', 'events', 'reference']

/**
 * The sources in scene order: the publishers by domain (in the list's order
 * within one), then gridflow's own tables, built from them.
 */
export function inSceneOrder(sources: ManifestSource[]): ManifestSource[] {
  const rank = (s: ManifestSource) => (s.layer === 'gold' ? DOMAINS.length : DOMAINS.indexOf(s.domain))
  return sources.map((s, i) => ({ s, i })).sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i).map(({ s }) => s)
}

export const datasetsOf = (families: ManifestFamily[]): ManifestDataset[] => families.flatMap((f) => f.datasets)

/**
 * Datasets counted by their group's kind, as the source page splits them
 * (time series, event feeds, reference tables), so the two pages agree.
 */
export function kindCounts(families: ManifestFamily[]): Record<Kind, number> {
  const out: Record<Kind, number> = { series: 0, events: 0, reference: 0 }
  for (const f of families) out[f.kind] += f.datasets.length
  return out
}

/** `ENTSO-E`, `GIE AGSI+`: a source's name as it stands on the land. */
export const shortName = (s: Pick<ManifestSource, 'name'>) => s.name.replace(' Transparency', '')

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

/** `eight`: a count in words up to twelve, in figures past it. */
export const countWord = (n: number) => WORDS[n] ?? n.toLocaleString('en-GB')

/** How often gridflow fetches a family's datasets: `hourly and daily`; gridflow's own tables are built, not fetched. */
export function schedulesOf(f: ManifestFamily): string {
  const known = [...new Set(f.datasets.map((d) => d.schedule).filter((s): s is string => Boolean(s)))]
  if (!known.length) return 'built by gridflow'
  const words = listText(known)
  return f.datasets.some((d) => !d.schedule) ? `${words}; some built by gridflow` : words
}
