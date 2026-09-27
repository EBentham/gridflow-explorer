/**
 * What each outage dataset's rows hold, for the page's own table and panels:
 * the column naming what is out (a unit, a border asset, an area), its areas,
 * its status and type where it has them, and the filters the table offers.
 * Also the words for ENTSO-E's area codes and statuses, and the table's
 * filters as they live in the URL (`?f.<field>=`, the template's convention).
 */
import { autoDigits, fmt0, fmtN } from '../../../design/format'
import { instantLabel } from '../../../design/time'
import { productionType } from '../../_template/codes'
import type { EventRow, EventsRowsResponse, Scalar } from '../../contract'
import type { PageContext } from '../../define'

/** The value column in every outage table. */
export const MW = 'unavailable_mw'
/** When each availability block starts. The rows are dated by `published_at` instead. */
export const START = 'timestamp_utc'

/** The MW column's heading, everywhere: what the figure means is unsettled. */
export const MW_LABEL = 'MW (available or unavailable, unconfirmed)'

export interface Field {
  field: string
  label: string
  /** An identifier: set in mono unless it has words. */
  id?: boolean
  words?: (v: Scalar) => string | null
}

export interface OutageShape {
  /** The column naming what is out: one row per block of its notice. */
  who: Field
  /** Singular and plural of what `who` names. */
  noun: [string, string]
  /** A readable name beside the id, when the rows carry one. */
  name?: Field
  type?: Field
  areas: Field[]
  status?: Field
  /** Fields the table offers a filter on, in order. */
  filters: string[]
}

/**
 * ENTSO-E's area codes (EIC) that the research card names for these rows.
 * A code not listed shows as held.
 */
const AREAS: Readonly<Record<string, string>> = {
  '10YGB----------A': 'GB',
  '10YFR-RTE------C': 'France',
  '10YBE----------2': 'Belgium',
  '10YNL----------L': 'Netherlands',
  '10Y1001A1001A82H': 'Germany-Luxembourg',
}

export function areaWords(v: Scalar): string | null {
  return typeof v === 'string' ? (AREAS[v] ?? null) : null
}

/** A09 is ENTSO-E's cancelled status; a blank status is a notice that states none. */
export function statusWords(v: Scalar): string | null {
  if (v === 'A09') return 'Cancelled'
  if (v === '' || v === null) return 'Not stated'
  return null
}

const area = (field: string, label: string): Field => ({ field, label, id: true, words: areaWords })
const STATUS: Field = { field: 'document_status', label: 'Status', words: statusWords }

export const SHAPES: Readonly<Record<string, OutageShape>> = {
  outages_generation: {
    who: { field: 'unit_mrid', label: 'Unit id', id: true },
    noun: ['unit', 'units'],
    name: { field: 'unit_name', label: 'Unit' },
    areas: [area('area_code', 'Area')],
    filters: ['area_code', 'unit_name'],
  },
  outages_production: {
    who: { field: 'unit_mrid', label: 'Unit id', id: true },
    noun: ['unit', 'units'],
    type: { field: 'production_type', label: 'Production type', words: productionType },
    areas: [area('area_code', 'Area')],
    status: STATUS,
    filters: ['document_status', 'area_code', 'production_type', 'unit_mrid'],
  },
  outages_transmission: {
    who: { field: 'asset_mrid', label: 'Asset id', id: true },
    noun: ['asset', 'assets'],
    areas: [area('in_area_code', 'In area'), area('out_area_code', 'Out area')],
    status: STATUS,
    filters: ['document_status', 'in_area_code', 'out_area_code', 'asset_mrid'],
  },
  outages_consumption: {
    who: area('area_code', 'Area'),
    noun: ['area', 'areas'],
    areas: [],
    filters: ['area_code'],
  },
}

export function shapeOf(ctx: PageContext): OutageShape | undefined {
  return SHAPES[ctx.dataset.id]
}

/** Every field the shape knows, by id. */
export function fieldsOf(shape: OutageShape): Map<string, Field> {
  const all = [shape.name, shape.who, shape.type, ...shape.areas, shape.status].filter((f): f is Field => Boolean(f))
  return new Map(all.map((f) => [f.field, f]))
}

// ---------------------------------------------------------------- values

/** A block start (or any instant) with its year: blocks run years ahead of the window. */
export function startMs(v: Scalar | undefined): number | null {
  if (typeof v !== 'string') return null
  const ms = Date.parse(v)
  return Number.isFinite(ms) ? ms : null
}

export const withYear = (ms: number) => instantLabel(ms, { year: true })

export function mwText(v: number): string {
  return Number.isInteger(v) ? fmt0(v) : fmtN(v, autoDigits(v))
}

/** A value in its field's words, or as held; `Blank` for an empty one with no words. */
export function said(f: Field | undefined, v: Scalar | undefined): string {
  const words = f?.words?.(v ?? null)
  if (words) return words
  return v === null || v === undefined || v === '' ? 'Blank' : String(v)
}

// ---------------------------------------------------------------- filters

/** The URL value for a blank field, which `?f.<field>=` can't carry as an empty string. */
export const BLANK = '(blank)'

export const filterParam = (field: string) => `f.${field}`

/** A row's value as a filter matches it. */
export const filterValue = (v: Scalar | undefined) => (v === null || v === undefined || v === '' ? BLANK : String(v))

/** The filters set in the URL, as [field, value] pairs. */
export function activeFilters(ctx: PageContext, shape: OutageShape): [string, string][] {
  return shape.filters.map((f) => [f, ctx.param(filterParam(f))] as [string, string | null]).filter((x): x is [string, string] => x[1] !== null)
}

export function applyFilters(rows: EventRow[], active: [string, string][]): EventRow[] {
  if (!active.length) return rows
  return rows.filter((r) => active.every(([f, v]) => filterValue(r[f]) === v))
}

export function rowsOf(ctx: PageContext): EventRow[] {
  return (ctx.response as EventsRowsResponse | null)?.rows ?? []
}
