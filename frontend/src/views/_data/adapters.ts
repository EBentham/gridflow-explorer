/**
 * Which `DataSource` a page reads. Every page reads the live store through
 * the HTTP adapter (`http.ts`). The dev fixture (`fixture.ts`) is kept for
 * the template demo alone (`demo/dataset-page`, `adapter: 'fixture'`), which
 * shows every state a page meets on synthetic data; anything it draws
 * carries the dashed-ochre Fixture tag.
 */
import type { DataSource } from '../contract'
import type { ViewConfig } from '../define'
import { fixtureAdapter } from './fixture'
import { httpAdapter } from './http'

export const DEFAULT_ADAPTER: DataSource = httpAdapter

export function adapterFor(config: Pick<ViewConfig, 'adapter'>): DataSource {
  return config.adapter === 'fixture' ? fixtureAdapter : DEFAULT_ADAPTER
}
