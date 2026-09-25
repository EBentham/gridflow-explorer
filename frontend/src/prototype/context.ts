/**
 * PROTOTYPE -- design loop round 1 (2026-09-25). Throwaway: the winning
 * system folds into src/design + the real screens at lock; this folder is
 * then deleted. See frontend/design-rounds.md.
 */
import { createContext, useContext, type ComponentType, type ReactNode } from 'react'
import type { ChartLanguage } from '../design/charts'

export type VariantKey = 'a' | 'b' | 'c' | 'd' | 'e'
export type ThemePref = 'system' | 'light' | 'dark'

export interface NavItem {
  to: string
  label: string
  fixture?: boolean
}

export interface ShellProps {
  nav: NavItem[]
  children: ReactNode
}

export interface VariantDef {
  key: VariantKey
  name: string
  line: string
  language: ChartLanguage
  Shell: ComponentType<ShellProps>
  /** Where a screen's key/legend goes: into the shell's slot, or beside the chart. */
  keyPlacement: 'shell' | 'aside'
  heatStrip?: boolean
  ledger?: boolean
  sidePanel?: boolean
  penHead?: boolean
  lineForm?: boolean
}

export interface ProtoState {
  variant: VariantDef
  theme: ThemePref
  /** Current search string to carry on every in-app link. */
  search: string
}

export const ProtoContext = createContext<ProtoState | null>(null)

export function useProto(): ProtoState {
  const ctx = useContext(ProtoContext)
  if (!ctx) throw new Error('useProto outside PrototypeRoot')
  return ctx
}
