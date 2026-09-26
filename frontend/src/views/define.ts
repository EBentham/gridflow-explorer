/**
 * The view config: what a family folder's `index.tsx` exports as default,
 * through `defineView({...})`. The template (`_template/DatasetPage.tsx`)
 * reads it and draws the page in the DESIGN §5 frame. `README.md` in this
 * folder is the builder's guide; this file is the typed shape.
 */
import type { ComponentType, ReactNode } from 'react'
import type { ApiError } from '../api/client'
import type { ViewState } from '../design/frame'
import type { ChartOrTable, RangeState } from '../design/range'
import type { DateRange } from '../lib/range'
import type { ManifestDataset, ManifestFamily, ManifestSource, RowsResponse, Scalar } from './contract'
import type { SeriesModel } from './_template/seriesModel'

// ---------------------------------------------------------------- series

/** How a chart panel draws its series: lines, stacked bands (negatives stack below zero), or bars. */
export type Mark = 'line' | 'stacked' | 'bars'

/** How the page shows one value column. */
export interface ValueSpec {
  /** A value column of the dataset (`values[].column` in the manifest). */
  column: string
  /** Its name on the page, sentence case, no unit: `Market index price`. Default: the column id. */
  label?: string
  /**
   * The unit, only when the manifest's is null or a sentence and the P1 card
   * settles it. Never a guess: leave it unset and the page says "unit
   * unconfirmed".
   */
  unit?: string
  /** MW columns show as GW (DESIGN §6). `'MW'` keeps MW, for one unit's or one outage's scale. */
  display?: 'GW' | 'MW'
  /** A token for this column when the series are the columns themselves (no group), e.g. `var(--chart-price)`. */
  color?: string
}

/** How the page shows one value of the group column (a fuel, an area, a site). */
export interface GroupSpec {
  value: string
  label?: string
  /** A token: `var(--fuel-wind)` for a fuel, a `SERIES_COLORS` entry otherwise. */
  color?: string
}

export interface LowerPanel {
  /** Draw a related dataset (its `key` in `related`) instead of this one. */
  from?: string
  /** Value columns for this panel. Default: this dataset's drawn columns not in the main panel, or the related dataset's. */
  values?: string[]
  mark?: Mark
  height?: number
  /** Label the highest and lowest value of the panel's first series. */
  extremes?: boolean
}

export interface ChartSpec {
  /** Default `line`. */
  mark?: Mark
  /** Value columns in the main panel. Default: every drawn column not sent to `lower`. */
  values?: string[]
  height?: number
  /** Put zero on the value axis even when no value reaches it (stacks and bars always do). */
  zero?: boolean
  /** Label the highest and lowest value of the focused, or first, series. Default: on for one line, off otherwise. */
  extremes?: boolean
  /**
   * A second panel under the first on the same clock: volume under a price,
   * or a related dataset. `false`: no second panel. The drawn columns left
   * out of the main panel are the page's own to draw (a working panel of
   * its own), and the table still lists them.
   */
  lower?: LowerPanel | false
  /**
   * Mark each run of the main panel's first series below zero with the
   * highlight band (DESIGN §6: negative-price runs). The key says what the
   * band means.
   */
  belowZero?: boolean
  /**
   * The most series drawn at once (default 10). The rest, ranked by their
   * mean size in the window, are named in the key as not drawn; never merged.
   */
  maxSeries?: number
}

// ---------------------------------------------------------------- events and reference tables

export type CellFormat = 'text' | 'id' | 'number' | 'time' | 'date' | 'bool'

export interface ColumnSpec {
  field: string
  /** Header text. Default: the field id, set as an identifier. */
  label?: string
  /**
   * `id` sets the value as an identifier (mono): unit ids, mrids, codes.
   * `number` formats with `unit` (MW columns stay MW here unless `display`).
   * `time` reads an ISO or epoch instant on the UK clock; `date` a `YYYY-MM-DD`.
   */
  format?: CellFormat
  unit?: string
  display?: 'GW' | 'MW'
  /**
   * How a coded or packed value reads in words, e.g. the name inside a JSON
   * text (`{"code": "FR", "name": "France"}` reads `France`). The cell, the
   * sort, the filter's list and the search read the words; the filter still
   * matches the value as held. Return null to show the value as held.
   */
  text?: (value: Scalar) => string | null
}

export interface SortSpec {
  field: string
  dir: 'asc' | 'desc'
}

// ---------------------------------------------------------------- the datasets a page shows

/** The rows request's extras. The window comes from the toolbar. */
export interface QuerySpec {
  /** A `dims` column to split by. */
  group?: string
  /** Equality filters on `dims` columns. Null clears the dataset's default filter. */
  filters?: Record<string, string> | null
}

/**
 * Another dataset read for the same window: the relationship to price or
 * demand. It loads with the page, and the page is ready only when it has
 * settled too.
 */
export interface RelatedSpec {
  /** How the config refers to it, e.g. `price`. */
  key: string
  source: string
  dataset: string
  /** Its name in keys and tooltips. */
  label: string
  query?: QuerySpec
  values?: ValueSpec[]
  groups?: GroupSpec[]
}

interface DatasetViewBase {
  /** The manifest dataset id. */
  id: string
  /** Its name in the toolbar's dataset switch: short, sentence case. */
  label: string
  /** The main panel's H2. Default: `label`. */
  title?: string
  /** The head's sentence for this dataset, when it differs from the page's `sub`. */
  sub?: string
  /**
   * Plain-words caveats: vintage, unit doubts, known faults, what a default
   * filter leaves out. Written from the manifest notes and the P1 card, never
   * pasted from them (they carry internal references).
   */
  caveats?: string[]
  /** Group and filters, fixed or read from the page's own URL parameters. */
  query?: QuerySpec | ((params: URLSearchParams) => QuerySpec)
  related?: RelatedSpec[]
  /** Replace what a panel shows for this dataset. Omitted panels keep the body's default. */
  panels?: PanelSlots
  /**
   * The page's own toolbar controls, after Chart | Table: a `Segmented` or a
   * select that reads and writes the page's own URL parameters (`ctx.param`,
   * `ctx.setParam`), which `query` then reads. Drawn once the source list is read.
   */
  controls?: ComponentType<{ ctx: PageContext }>
}

export interface SeriesView extends DatasetViewBase {
  body: 'series'
  /** Columns to draw, in order. Default: every numeric value column. Text columns go to the table only. */
  values?: ValueSpec[]
  /** Group values' labels and colours; their order is the stack order, bottom first. */
  groups?: GroupSpec[]
  /**
   * How the chart draws the series. `false`: no chart. The rows show as a
   * table, the toolbar has no Chart | Table switch, and the key lists each
   * series' latest value (a table-only family: unitless columns that one
   * axis would mislead with, a handful of weekly points, or text only).
   */
  chart?: ChartSpec | false
}

export interface EventsView extends DatasetViewBase {
  body: 'events'
  /** The event time's column header, e.g. `Published`. Default `Time`. */
  timeLabel?: string
  /** Table columns after the event time. Default: every field of the rows. */
  columns?: ColumnSpec[]
  /** Fields with a column filter. Default: text fields holding at most 40 distinct values in the window. */
  filters?: string[]
  /** Default: newest first. */
  sort?: SortSpec
  /** Events per period as bars above the table, in the Chart view. `true` picks hours for a day or two, days beyond. */
  strip?: boolean | { per: 'hour' | 'day' }
}

export interface ReferenceView extends DatasetViewBase {
  body: 'reference'
  columns?: ColumnSpec[]
  sort?: SortSpec
  /** Fields the search box reads. Default: every text column. */
  search?: string[]
  /** The working panel's default: rows counted by this field (fuel type, country). */
  countBy?: string
}

/** One dataset on the page. `body` picks the template body; it usually matches the manifest kind. */
export type DatasetView = SeriesView | EventsView | ReferenceView

// ---------------------------------------------------------------- panels

/** A panel's content. The template draws the panel, its H2, the source line and any Fixture tag. */
export interface SlotSpec {
  title: string | ((ctx: PageContext) => string)
  /** The source line: dataset id, columns, unit, window. Default: the dataset's own (`SourceLine`). */
  src?: (ctx: PageContext) => ReactNode
  Body: ComponentType<{ ctx: PageContext }>
}

/** The DESIGN §5 grid: `main` with the 272px `key` beside it, then `working` (wide) with `side`. */
export interface PanelSlots {
  main?: SlotSpec
  key?: SlotSpec
  working?: SlotSpec
  side?: SlotSpec
}

// ---------------------------------------------------------------- the page

export interface ViewConfig {
  /** The H1: the family's name as a reader would say it. */
  title: string
  /** One sentence under the H1: what this is and what it shows. */
  sub: string
  /** The datasets, in the order of the toolbar's switch. The first held one opens by default. */
  datasets: DatasetView[]
  /** Caveats for the whole family, shown with each dataset's own. */
  caveats?: string[]
  /** Read the dev fixture whatever the app's adapter is. Fixture pages carry the Fixture tag on every panel. */
  adapter?: 'fixture'
}

/** A related dataset as a panel sees it. */
export interface RelatedData {
  spec: RelatedSpec
  /** Its source and dataset in gridflow's source list (for source lines and coverage). */
  source: ManifestSource | null
  dataset: ManifestDataset | null
  state: ViewState
  response: RowsResponse | null
  error: ApiError | null
  /** Its series model, when it is a series. */
  series: SeriesModel | null
}

/** Everything a panel body gets. */
export interface PageContext {
  config: ViewConfig
  view: DatasetView
  source: ManifestSource
  family: ManifestFamily
  dataset: ManifestDataset
  /** When the backend last read coverage (ISO), for "as read at" lines. */
  readAt: string
  /** Synthetic data: every panel carries the Fixture tag and dashes its traces. */
  fixture: boolean
  /** The toolbar's range; null for a reference table, which has no clock. */
  range: RangeState | null
  window: DateRange | null
  /** `16 Sep – 22 Sep 2026`, or empty for a reference table. */
  windowText: string
  mode: ChartOrTable
  /** The page's state: `data-view-ready` carries it. */
  state: ViewState
  error: ApiError | null
  response: RowsResponse | null
  /** The series model of the page's dataset (series bodies, once rows are read). */
  series: SeriesModel | null
  related: Record<string, RelatedData>
  /** A series key selected in the key panel: the chart draws it alone, the day table reads it. */
  focus: string | undefined
  setFocus: (key: string | undefined) => void
  /** A UK day's midnight picked on the chart or in a day table: the chart's highlight band. */
  picked: number | undefined
  pick: (midnight: number | undefined) => void
  /** The page's URL parameters, for controls a page adds (not one of `TEMPLATE_PARAMS`, nor `f.…`). */
  param: (name: string) => string | null
  setParam: (name: string, value: string | null) => void
  /** Several parameters in one change (a null removes one). */
  setParams: (changes: Record<string, string | null>) => void
}

/**
 * URL parameters the template and the app own. A page's own controls use
 * other names, and never start with `f.` (the events table's column filters).
 */
export const TEMPLATE_PARAMS = ['days', 'from', 'to', 'view', 'dataset', 'q', 'theme', 'fixture'] as const

/** A family's view. Identity at runtime; it types the config. */
export function defineView(config: ViewConfig): ViewConfig {
  return config
}
