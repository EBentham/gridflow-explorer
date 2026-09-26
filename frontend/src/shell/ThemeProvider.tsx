import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DARK_QUERY, ThemeContext, applyTheme, readInitialTheme, storeTheme, type ThemePick, type ThemePref } from './theme'

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => window.matchMedia(DARK_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY)
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return dark
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPref] = useState<ThemePref>(readInitialTheme)
  const systemDark = useSystemDark()
  const [, setParams] = useSearchParams()

  useEffect(() => applyTheme(pref), [pref])

  const pick = useCallback(
    (t: ThemePick) => {
      setPref(t)
      storeTheme(t)
      // A stale ?theme= would undo the pick on reload.
      setParams(
        (prev) => {
          if (!prev.has('theme')) return prev
          const next = new URLSearchParams(prev)
          next.delete('theme')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const value = useMemo(() => ({ pref, dark: pref === 'dark' || (pref === 'system' && systemDark), pick }), [pref, systemDark, pick])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
