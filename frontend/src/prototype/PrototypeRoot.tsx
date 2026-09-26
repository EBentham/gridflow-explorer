import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ChartLanguageProvider } from '../design/charts'
import { ProtoContext, type NavItem, type ThemePref, type VariantKey } from './context'
import { RangeContext, useRangeState } from './data'
import { GenerationScreen, PricesScreen, WindScreen } from './screens'
import { ROUND_ORDER, VARIANTS, roundOf } from './variants'
import './proto.css'
import './variants.css'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@400;500;600;700' +
  '&family=Overpass:wght@400;500;600;700;800&family=Overpass+Mono:wght@400;600' +
  '&family=Archivo:wdth,wght@62..125,400..800&family=Source+Serif+4:opsz,wght@8..60,400..700' +
  '&family=Host+Grotesk:wght@400;500;700' +
  '&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Hanken+Grotesk:ital,wght@0,400..700;1,400..700' +
  '&family=Red+Hat+Mono:wght@400;500&display=swap'

function useFonts() {
  useEffect(() => {
    if (document.getElementById('proto-fonts')) return
    const link = document.createElement('link')
    link.id = 'proto-fonts'
    link.rel = 'stylesheet'
    link.href = FONTS
    document.head.appendChild(link)
  }, [])
}

const NAV: NavItem[] = [
  { to: '/datasets/generation-mix', label: 'Generation mix' },
  { to: '/datasets/system-prices', label: 'System prices' },
  { to: '/forecasts/wind', label: 'Wind forecast', fixture: true },
]

function Switcher({ current, theme }: { current: VariantKey; theme: ThemePref }) {
  const navigate = useNavigate()
  const location = useLocation()
  const go = (v: VariantKey, t: ThemePref) =>
    navigate(`${location.pathname}?variant=${v}${t === 'system' ? '' : `&theme=${t}`}`, { replace: true })
  const order = ROUND_ORDER[roundOf(current)]
  const idx = order.indexOf(current)
  const step = (d: number) => go(order[(idx + d + order.length) % order.length], theme)
  const stepRef = useRef(step)
  stepRef.current = step
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowLeft') stepRef.current(-1)
      if (e.key === 'ArrowRight') stepRef.current(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const v = VARIANTS[current]
  return (
    <div className="proto-bar" role="toolbar" aria-label="Prototype variants">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ‹
      </button>
      <span className="proto-label">
        {current.toUpperCase()}, {v.name}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        ›
      </button>
      {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
        <button key={t} type="button" className={theme === t ? 'is-on' : undefined} onClick={() => go(current, t)}>
          {t}
        </button>
      ))}
      <Link to={`/prototype?round=${roundOf(current)}&screen=${encodeURIComponent(location.pathname)}`}>compare</Link>
    </div>
  )
}

/**
 * PROTOTYPE host. Mounted by App when `?variant=` is present (dev only).
 * Existing data hooks stay; only rendering swaps per variant.
 */
export function PrototypeRoot() {
  const [params] = useSearchParams()
  const raw = (params.get('variant') ?? 'a').toLowerCase()
  const key: VariantKey = raw in VARIANTS ? (raw as VariantKey) : 'a'
  const theme = (params.get('theme') ?? 'system') as ThemePref
  const embed = params.get('embed') === '1'
  const variant = VARIANTS[key]
  const rangeState = useRangeState()
  const [ready, setReady] = useState(false)
  useFonts()

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.variant = key
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
    setReady(true)
    return () => {
      delete root.dataset.variant
      delete root.dataset.theme
    }
  }, [key, theme])

  const search = `?variant=${key}${theme === 'system' ? '' : `&theme=${theme}`}${embed ? '&embed=1' : ''}`
  const Shell = variant.Shell
  const Gen = variant.screens?.generation ?? GenerationScreen
  const Prices = variant.screens?.prices ?? PricesScreen
  const Wind = variant.screens?.wind ?? WindScreen
  if (!ready) return null
  return (
    <ProtoContext.Provider value={{ variant, theme, search }}>
      <RangeContext.Provider value={rangeState}>
        <ChartLanguageProvider value={variant.language}>
          <Shell key={key} nav={NAV}>
            <Routes>
              <Route path="/datasets/generation-mix" element={<Gen />} />
              <Route path="/datasets/system-prices" element={<Prices />} />
              <Route path="/forecasts/wind" element={<Wind />} />
              <Route path="*" element={<Navigate to={`/datasets/generation-mix${search}`} replace />} />
            </Routes>
          </Shell>
          {!embed && <Switcher current={key} theme={theme} />}
        </ChartLanguageProvider>
      </RangeContext.Provider>
    </ProtoContext.Provider>
  )
}
