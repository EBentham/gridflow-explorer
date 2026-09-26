/**
 * The shared Recharts theme module (DESIGN §6): the chart frame with its
 * clock caption, day rules, the zero line, the chartreuse highlight band and
 * selection edges, labelled extremes, the compact tooltip, the key panel's
 * marks (including the fan key and the fuel key) and the plain data table.
 * Constants and axis/series prop factories live in `chartTheme.ts`.
 *
 * Compose charts from these pieces. Every colour is a CSS custom property,
 * so both themes come from the tokens with no re-render.
 */
import type { ReactElement, ReactNode } from 'react'
import { ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer } from 'recharts'
import { CHART } from './chartTheme'
import { fmt1 } from './format'
import { FUEL_BANDS, fuelVar, type MixRow } from './fuels'

// ---------------------------------------------------------------- frame

/**
 * A fixed-height chart box (ResponsiveContainer needs a sized parent) with the
 * clock caption, e.g. `UK time (BST)`, under its lower right corner.
 */
export function ChartFrame({
  height = CHART.height,
  caption,
  pickable,
  children,
}: {
  height?: number
  caption?: string
  /** The chart takes clicks (to pick a day): shows a pointer. */
  pickable?: boolean
  children: ReactElement
}) {
  const cls = ['gf-chart', caption ? 'has-caption' : '', pickable ? 'is-pickable' : ''].filter(Boolean).join(' ')
  return (
    <div className={cls} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
      {caption && <div className="gf-axis-caption">{caption}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- annotations

/** A rule at each London midnight: the day boundaries of a multi-day window. */
export function DayRules({ midnights }: { midnights: number[] }) {
  return (
    <>
      {midnights.map((m) => (
        <ReferenceLine key={m} x={m} stroke="var(--chart-grid-strong)" strokeWidth={1} ifOverflow="hidden" />
      ))}
    </>
  )
}

export function ZeroLine() {
  return <ReferenceLine y={0} stroke="var(--chart-axis)" strokeWidth={1} />
}

/** The chartreuse highlight band (hatched in dark): a selected day, or a run worth seeing. */
export function HighlightBand({ x1, x2 }: { x1: number; x2: number }) {
  return <ReferenceArea x1={x1} x2={x2} fill="var(--band)" fillOpacity={1} stroke="none" ifOverflow="hidden" />
}

/** Chartreuse edges around a selected stretch. */
export function SelectionEdges({ x1, x2 }: { x1: number; x2: number }) {
  return (
    <>
      {[x1, x2].map((x) => (
        <ReferenceLine key={x} x={x} stroke="var(--accent)" strokeWidth={1.5} ifOverflow="hidden" />
      ))}
    </>
  )
}

function ExtremeLabel({ cx, cy, text, anchor, below, color }: { cx: number; cy: number; text: string; anchor: 'start' | 'end'; below: boolean; color: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={3.5} fill="var(--chart-surface)" stroke={color} strokeWidth={1.5} />
      <text
        x={cx + (anchor === 'start' ? 7 : -7)}
        y={cy + (below ? 15 : -9)}
        textAnchor={anchor}
        className="gf-extreme"
        paintOrder="stroke"
        stroke="var(--chart-surface)"
        strokeWidth={4}
        strokeLinejoin="round"
      >
        {text}
      </text>
    </g>
  )
}

/**
 * A labelled extreme: a ringed dot and a line of text such as
 * `£276.80/MWh, highest, Sun 13 at 19:00`. Label it towards the chart's
 * middle (`anchor`) and below the dot for a low.
 */
export function Extreme({
  x,
  y,
  text,
  anchor,
  below = false,
  color = 'var(--chart-price)',
}: {
  x: number
  y: number
  text: string
  anchor: 'start' | 'end'
  below?: boolean
  color?: string
}) {
  return (
    <ReferenceDot
      x={x}
      y={y}
      r={0}
      ifOverflow="visible"
      shape={(p: { cx?: number; cy?: number }) => <ExtremeLabel cx={p.cx ?? 0} cy={p.cy ?? 0} anchor={anchor} below={below} text={text} color={color} />}
    />
  )
}

// ---------------------------------------------------------------- tooltip

export interface TipRow {
  key: string
  color: string
  label: string
  value: string
  dashed?: boolean
  /** A total row: set off by a rule. */
  strong?: boolean
}

/** The compact tooltip: the period as its title, one row per series with a swatch. */
export function TooltipBox({ title, rows, note }: { title: string; rows: TipRow[]; note?: string }) {
  return (
    <div className="gf-tip">
      <div className="gf-tip-title">{title}</div>
      {rows.length > 0 && (
        <table>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={r.strong ? 'gf-tip-strong' : undefined}>
                <td className="gf-tip-value">{r.value}</td>
                <td>
                  <svg width="12" height="8" aria-hidden="true">
                    <line x1="0" y1="4" x2="12" y2="4" stroke={r.color} strokeWidth="3" strokeDasharray={r.dashed ? '3 2' : undefined} />
                  </svg>
                </td>
                <td className="gf-tip-label">{r.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {note && <div className="gf-tip-note">{note}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- key panel

export type KeyMark =
  | { kind: 'line'; color: string; dashed?: boolean }
  | { kind: 'swatch'; color: string }
  /** The highlight band, as drawn on the chart. */
  | { kind: 'band' }
  /** Two bars in one colour: `rise` for values above zero, `fall` for below. */
  | { kind: 'bars'; color: string; shape: 'rise' | 'fall' }
  /** The 50, 80 and 90% forecast bands. */
  | { kind: 'fan' }

function Mark({ mark }: { mark: KeyMark }) {
  switch (mark.kind) {
    case 'line':
      return (
        <svg width="22" height="10" aria-hidden="true">
          <line x1="0" y1="5" x2="22" y2="5" stroke={mark.color} strokeWidth="2" strokeDasharray={mark.dashed ? CHART.fixtureDash : undefined} />
        </svg>
      )
    case 'swatch':
      return <span className="gf-swatch" style={{ background: mark.color }} aria-hidden="true" />
    case 'band':
      return <span className="gf-key-band" aria-hidden="true" />
    case 'bars':
      return (
        <svg width="22" height="10" aria-hidden="true">
          <rect x="4" y="0" width="5" height="10" fill={mark.color} />
          {mark.shape === 'rise' ? <rect x="12" y="3" width="5" height="7" fill={mark.color} /> : <rect x="12" y="0" width="5" height="6" fill={mark.color} />}
        </svg>
      )
    case 'fan':
      return (
        <svg width="22" height="12" aria-hidden="true">
          <rect x="0" y="0" width="22" height="12" fill="var(--chart-fan)" fillOpacity={CHART.fan.b90} />
          <rect x="0" y="2" width="22" height="8" fill="var(--chart-fan)" fillOpacity={CHART.fan.b80} />
          <rect x="0" y="4" width="22" height="4" fill="var(--chart-fan)" fillOpacity={CHART.fan.b50} />
        </svg>
      )
  }
}

export interface KeyItem {
  key: string
  mark: KeyMark
  label: ReactNode
}

/** The key panel's list: a mark and a name for every series, so identity is never colour alone. */
export function KeyList({ items }: { items: KeyItem[] }) {
  return (
    <ul className="gf-key">
      {items.map((i) => (
        <li key={i.key}>
          <Mark mark={i.mark} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** The forecast fan's key: settled actual, median (dashed when synthetic), and the three intervals. */
export function FanKey({ fixture = false }: { fixture?: boolean }) {
  return (
    <KeyList
      items={[
        { key: 'actual', mark: { kind: 'line', color: 'var(--chart-actual)' }, label: 'Actual, settled' },
        { key: 'median', mark: { kind: 'line', color: 'var(--chart-fan)', dashed: fixture }, label: fixture ? 'Median forecast, dashed as fixture' : 'Median forecast' },
        { key: 'fan', mark: { kind: 'fan' }, label: '50, 80 and 90% intervals' },
      ]}
    />
  )
}

/**
 * The generation mix's key: every fuel band, top of the stack first, with its
 * latest value. Selecting one focuses the chart on it; selecting it again
 * returns to the stack.
 */
export function FuelKey({ latest, onPick, focus }: { latest?: MixRow; onPick?: (k: string | undefined) => void; focus?: string }) {
  return (
    <ul className="gf-fuel-key">
      {[...FUEL_BANDS].reverse().map((b) => {
        const v = latest?.[b.key]
        return (
          <li key={b.key} className={focus === b.key ? 'is-focus' : focus ? 'is-muted' : undefined}>
            <button type="button" aria-pressed={focus === b.key} onClick={onPick ? () => onPick(focus === b.key ? undefined : b.key) : undefined} disabled={!onPick}>
              <span className="gf-swatch" style={{ background: fuelVar(b.key) }} />
              <span className="gf-fuel-name">{b.label}</span>
              {latest && <span className="gf-fuel-value">{v === null || v === undefined ? '–' : fmt1(v)}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------- table

export interface TableColumn {
  key: string
  label: string
  align?: 'end'
}

/** A chart's rows as a plain table, for the Chart | Table switch. */
export function DataTable({ columns, rows, caption }: { columns: TableColumn[]; rows: Record<string, ReactNode>[]; caption: string }) {
  return (
    <div className="gf-table-wrap">
      <table className="gf-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.align === 'end' ? 'is-num' : undefined} scope="col">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={c.align === 'end' ? 'is-num' : undefined}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
