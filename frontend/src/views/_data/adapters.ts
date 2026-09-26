/**
 * Which `DataSource` a page reads. Until P4-0 writes the HTTP adapter
 * against `/api/sources` and the rows endpoint, the default is the dev
 * fixture, so only the demo family has data. P4-0 changes `DEFAULT_ADAPTER`
 * and nothing else; a view can still ask for the fixture by name.
 */
import type { DataSource } from '../contract'
import type { ViewConfig } from '../define'
import { fixtureAdapter } from './fixture'

export const DEFAULT_ADAPTER: DataSource = fixtureAdapter

export function adapterFor(config: Pick<ViewConfig, 'adapter'>): DataSource {
  return config.adapter === 'fixture' ? fixtureAdapter : DEFAULT_ADAPTER
}
