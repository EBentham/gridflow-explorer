import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { VARIANTS, VARIANT_ORDER } from './variants'

const SCREENS = [
  { path: '/datasets/generation-mix', label: 'Generation mix' },
  { path: '/datasets/system-prices', label: 'System prices' },
  { path: '/forecasts/wind', label: 'Wind forecast' },
]

const FRAME_W = 1440
const FRAME_H = 960

function Frame({ src, title }: { src: string; title: string }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)
  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / FRAME_W))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={box} style={{ width: '100%', height: FRAME_H * scale, overflow: 'hidden', borderRadius: 6, border: '1px solid #444' }}>
      <iframe
        src={src}
        title={title}
        style={{ width: FRAME_W, height: FRAME_H, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0' }}
      />
    </div>
  )
}

/** PROTOTYPE: all five variants live, side by side, on one screen. */
export function ComparePage() {
  const [params, setParams] = useSearchParams()
  const screen = params.get('screen') ?? SCREENS[0].path
  const theme = params.get('theme') ?? 'light'
  const cols = Number(params.get('cols') ?? 2)
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    setParams(next, { replace: true })
  }
  useEffect(() => {
    document.documentElement.style.background = '#1c1c1c'
    return () => {
      document.documentElement.style.background = ''
    }
  }, [])
  const btn = (on: boolean) => ({
    all: 'unset' as const,
    cursor: 'pointer',
    padding: '5px 10px',
    borderRadius: 999,
    background: on ? '#fff' : '#333',
    color: on ? '#111' : '#eee',
  })
  return (
    <div style={{ background: '#1c1c1c', color: '#eee', minHeight: '100svh', padding: 16, font: '13px/1.4 system-ui, sans-serif' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ marginRight: 8 }}>Round 1, five directions</strong>
        {SCREENS.map((s) => (
          <button key={s.path} type="button" style={btn(screen === s.path)} onClick={() => set('screen', s.path)}>
            {s.label}
          </button>
        ))}
        <span style={{ width: 16 }} />
        {['light', 'dark'].map((t) => (
          <button key={t} type="button" style={btn(theme === t)} onClick={() => set('theme', t)}>
            {t}
          </button>
        ))}
        <span style={{ width: 16 }} />
        {[1, 2, 3].map((c) => (
          <button key={c} type="button" style={btn(cols === c)} onClick={() => set('cols', String(c))}>
            {c} col
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: 16 }}>
        {VARIANT_ORDER.map((k) => (
          <figure key={k} style={{ margin: 0, display: 'grid', gap: 6 }}>
            <figcaption style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <span>
                <strong>
                  {k.toUpperCase()}, {VARIANTS[k].name}
                </strong>{' '}
                <span style={{ color: '#aaa' }}>{VARIANTS[k].line}</span>
              </span>
              <Link to={`${screen}?variant=${k}&theme=${theme}`} style={{ color: '#9cf', whiteSpace: 'nowrap' }}>
                open
              </Link>
            </figcaption>
            <Frame src={`${screen}?variant=${k}&theme=${theme}&embed=1`} title={VARIANTS[k].name} />
          </figure>
        ))}
      </div>
    </div>
  )
}
