/**
 * Light and dark are both first-class. The first visit follows the OS; a pick
 * in the rail sticks (local storage). A `?theme=light|dark` URL parameter
 * wins over both and is kept as the pick, which is how the screenshot
 * harness forces a theme. The choice lands on `<html data-theme>`, which
 * tokens.css reads; "system" leaves the attribute off so the OS media query
 * decides.
 */
import { createContext, useContext } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export type ThemePick = Exclude<ThemePref, 'system'>

const STORAGE_KEY = 'gridflow-explorer-theme'
export const DARK_QUERY = '(prefers-color-scheme: dark)'

const isPick = (v: unknown): v is ThemePick => v === 'light' || v === 'dark'

export function storeTheme(pick: ThemePick) {
  try {
    localStorage.setItem(STORAGE_KEY, pick)
  } catch {
    // Storage can be off (private windows); the pick then lasts for this page only.
  }
}

/** The URL parameter, else the stored pick, else the OS. */
export function readInitialTheme(): ThemePref {
  const fromUrl = new URLSearchParams(window.location.search).get('theme')
  if (isPick(fromUrl)) {
    storeTheme(fromUrl)
    return fromUrl
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (isPick(stored)) return stored
  } catch {
    // Unreadable storage means no stored pick.
  }
  return 'system'
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement
  if (pref === 'system') delete root.dataset.theme
  else root.dataset.theme = pref
}

export interface ThemeState {
  pref: ThemePref
  /** Whether dark is showing, from the pick or the OS. */
  dark: boolean
  pick: (t: ThemePick) => void
}

export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme outside ThemeProvider')
  return ctx
}
