/**
 * The screen frame (DESIGN §5), shared by every chart screen and by the
 * dataset page template:
 *
 * 1. `Head`: the emblem (the screen's glyph, or a source symbol), H1, a
 *    one-sentence sub and a stamp naming the window and "UK time".
 * 2. `Toolbar` holding `RangeControl` (1 / 7 / 30 days / custom, ending on
 *    the latest local day) and a `Segmented` Chart | Table switch.
 * 3. A `.gf-grid` of `Panel`s: `main` with the 272px `key` beside it, then
 *    `wide` with `side`. Every panel has an H2 and a source line naming the
 *    dataset (mono id), columns, unit and window.
 *
 * `Screen` wraps it all and sets `data-view-ready` once the screen has
 * settled on data, an empty state or an error (the screenshot harness waits
 * for it).
 */
import { useState, type ReactNode } from 'react'
import { Emblem, type GlyphKind } from './glyphs'
import { PRESETS, type ChartOrTable, type Preset, type RangeState } from './range'
import { fmtDay } from './time'
import { useDocumentTitle } from './title'
import type { DateRange } from '../lib/range'

/** What a screen is showing: `data-view-ready` carries it once it isn't `loading`. */
export type ViewState = 'loading' | 'data' | 'empty' | 'error' | 'refreshing'

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ')

export function Screen({ state = 'data', className, children }: { state?: ViewState; className?: string; children: ReactNode }) {
  return (
    <section className={cx('gf-screen', className)} data-view-ready={state === 'loading' ? undefined : state}>
      {children}
    </section>
  )
}

export function Head({
  glyph = 'datacentre',
  emblem,
  title,
  sub,
  stamp,
  badge,
}: {
  glyph?: GlyphKind
  /** Replaces the glyph emblem, e.g. with a source symbol. */
  emblem?: ReactNode
  title: string
  sub: ReactNode
  stamp?: ReactNode
  badge?: ReactNode
}) {
  useDocumentTitle(title)
  return (
    <header className="gf-head">
      {emblem ?? <Emblem kind={glyph} />}
      <div className="gf-head-text">
        <div className="gf-head-title">
          <h1>{title}</h1>
          {badge}
        </div>
        <p className="gf-head-sub">{sub}</p>
        {stamp && <p className="gf-head-stamp">{stamp}</p>}
      </div>
    </header>
  )
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="gf-toolbar">{children}</div>
}

export type PanelArea = 'main' | 'key' | 'wide' | 'side'

export function Panel({
  title,
  src,
  tag,
  area,
  className,
  children,
}: {
  title: string
  /** The source line: dataset id (in `<code>`), columns, unit, window. */
  src?: ReactNode
  /** Beside the H2, e.g. a Fixture tag. */
  tag?: ReactNode
  area?: PanelArea
  className?: string
  children?: ReactNode
}) {
  return (
    <section className={cx('gf-panel', area && `gf-p-${area}`, className)}>
      <header className="gf-panel-head">
        <h2>{title}</h2>
        {tag}
      </header>
      {src && <p className="gf-src">{src}</p>}
      {children}
    </section>
  )
}

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

export type { ChartOrTable }

const VIEW_OPTIONS: { value: ChartOrTable; label: string }[] = [
  { value: 'chart', label: 'Chart' },
  { value: 'table', label: 'Table' },
]

export function ViewSwitch({ value, onChange }: { value: ChartOrTable; onChange: (v: ChartOrTable) => void }) {
  return <Segmented label="View" options={VIEW_OPTIONS} value={value} onChange={onChange} />
}

const RANGE_OPTIONS: { value: Preset | 'custom'; label: string }[] = [
  ...PRESETS.map((p) => ({ value: p, label: p === 1 ? '1 day' : `${p} days` })),
  { value: 'custom' as const, label: 'Custom' },
]

/** Two date inputs; only a complete, ordered pair reaches the screen. */
function CustomRange({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const [draft, setDraft] = useState(range)
  const edit = (next: DateRange) => {
    setDraft(next)
    if (next.start && next.end && next.start <= next.end) onChange(next)
  }
  return (
    <span className="gf-range-custom">
      <input type="date" aria-label="From" value={draft.start} max={draft.end || undefined} onChange={(e) => edit({ ...draft, start: e.target.value })} />
      <span>to</span>
      <input type="date" aria-label="To" value={draft.end} min={draft.start || undefined} onChange={(e) => edit({ ...draft, end: e.target.value })} />
    </span>
  )
}

export function RangeControl({ state }: { state: RangeState }) {
  const { preset, range, latest, setPreset, setCustom } = state
  return (
    <div className="gf-range">
      <Segmented
        label="Date range"
        options={RANGE_OPTIONS}
        value={preset}
        onChange={(v) => {
          if (v !== 'custom') setPreset(v)
          else if (range) setCustom(range)
        }}
      />
      {preset === 'custom' && range && <CustomRange key={`${range.start}_${range.end}`} range={range} onChange={setCustom} />}
      {preset !== 'custom' && latest && <span className="gf-range-note">to the latest local day, {fmtDay(latest)}</span>}
      {preset !== 'custom' && latest === null && <span className="gf-range-note">ending today, as no local data was found</span>}
    </div>
  )
}

export function FixtureTag({ children, title = 'Synthetic data made in the browser, not read from gridflow.' }: { children?: ReactNode; title?: string }) {
  return (
    <span className="gf-fixture" title={title}>
      {children ?? 'Fixture'}
    </span>
  )
}

/**
 * What a panel says when it has no chart to show. Silent once there is data.
 * `error` messages come from the backend's error envelope.
 */
export function StatusNote({ state, error, empty }: { state: ViewState; error?: { message: string } | null; empty?: ReactNode }) {
  if (state === 'loading') return <p className="gf-state">Reading the range from the local store…</p>
  if (state === 'refreshing')
    return (
      <p className="gf-state" role="status">
        gridflow is refreshing the local store, so it can't be read for a moment. This panel tries again every 15 seconds.
      </p>
    )
  if (state === 'error')
    return (
      <p className="gf-state is-error" role="alert">
        Couldn't load this range: {error?.message ?? 'unknown error'}
      </p>
    )
  if (state === 'empty') return <p className="gf-state">{empty ?? 'Nothing is held locally for this range.'}</p>
  return null
}

/**
 * A secondary panel's line while the range hasn't been read: quieter than
 * `StatusNote`, which the main panel carries, so the error isn't repeated in
 * every panel. Silent once the range has been read (data or empty).
 */
export function PendingNote({ state }: { state: ViewState }) {
  if (state === 'loading') return <p className="gf-hint">Reading the range…</p>
  if (state === 'refreshing') return <p className="gf-hint">Waiting for the local store.</p>
  if (state === 'error') return <p className="gf-hint">Nothing to show: this range didn't load.</p>
  return null
}
