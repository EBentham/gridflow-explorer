import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { useProto } from './context'
import { useRange, type Preset } from './data'

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="gf-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'is-on' : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const PRESETS: { value: Preset | 'custom'; label: string }[] = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 'custom', label: 'Custom' },
]

export function RangeControl() {
  const { preset, range, latest, setPreset, setCustom } = useRange()
  const [draft, setDraft] = useState(range)
  useEffect(() => setDraft(range), [range])
  return (
    <div className="gf-range">
      <Segmented
        label="Date range"
        options={PRESETS}
        value={preset}
        onChange={(v) => (v === 'custom' ? range && setCustom(range) : setPreset(v))}
      />
      {preset === 'custom' && draft && (
        <span className="gf-range-custom">
          <input
            type="date"
            aria-label="From"
            value={draft.start}
            max={draft.end}
            onChange={(e) => {
              const next = { ...draft, start: e.target.value }
              setDraft(next)
              if (next.start && next.end) setCustom(next)
            }}
          />
          <span>to</span>
          <input
            type="date"
            aria-label="To"
            value={draft.end}
            min={draft.start}
            onChange={(e) => {
              const next = { ...draft, end: e.target.value }
              setDraft(next)
              if (next.start && next.end) setCustom(next)
            }}
          />
        </span>
      )}
      {latest && preset !== 'custom' && <span className="gf-range-note">to the latest local day, {fmtDate(latest)}</span>}
    </div>
  )
}

export function fmtDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`)
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function rangeText(start: string, end: string): string {
  const a = new Date(`${start}T12:00:00Z`)
  const b = new Date(`${end}T12:00:00Z`)
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' }
  if (start === end) return b.toLocaleDateString('en-GB', { ...o, year: 'numeric' })
  return `${a.toLocaleDateString('en-GB', o)} – ${b.toLocaleDateString('en-GB', { ...o, year: 'numeric' })}`
}

export function FixtureBadge({ children }: { children?: ReactNode }) {
  return (
    <span className="gf-fixture" title="Synthetic data generated in the frontend. No wind model exists in the forecast store yet.">
      {children ?? 'Fixture data: no wind model yet'}
    </span>
  )
}

export function CoverageNote({ missing, requested }: { missing: number; requested: number }) {
  if (missing === 0) return null
  return (
    <div className="gf-coverage" role="status">
      <span>
        {missing} of {requested} days aren't in the local catalogue.
      </span>
      <button type="button" disabled title="The prototype doesn't start fetch jobs. The real screen keeps this wired.">
        Fetch missing days
      </button>
    </div>
  )
}

/** Carries `?variant=&theme=` on every in-app link. */
export function ProtoLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const { search } = useProto()
  return (
    <NavLink to={`${to}${search}`} className={({ isActive }) => [className, isActive ? 'is-active' : ''].filter(Boolean).join(' ')}>
      {children}
    </NavLink>
  )
}

/**
 * A screen's key/legend. Variants that keep the key in the shell (A's map
 * key panel) expose a `#gf-shell-slot` node; the key portals there.
 * Otherwise it renders in place.
 */
export function ShellSlot({ children }: { children: ReactNode }) {
  const { variant } = useProto()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setTarget(document.getElementById('gf-shell-slot'))
  }, [])
  if (variant.keyPlacement === 'shell') return target ? createPortal(children, target) : null
  return <>{children}</>
}
