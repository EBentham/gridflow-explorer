import type { ComponentType } from 'react'
import type { DatasetSummary } from '../api/types'
import { GenerationMixScreen } from './GenerationMixScreen'
import { SystemPricesScreen } from './SystemPricesScreen'

export interface ScreenProps {
  dataset: DatasetSummary
}

/**
 * Dataset id -> dedicated screen component. This is the "dataset N+1 = one
 * config entry + one screen file" seam on the frontend, matching the
 * backend's `DATASETS` catalogue (P1-PLAN.md). Ids absent here fall back to
 * a generic chart screen (see `App.tsx`).
 */
export const SCREENS: Record<string, ComponentType<ScreenProps>> = {
  'generation-mix': GenerationMixScreen,
  'system-prices': SystemPricesScreen,
}
