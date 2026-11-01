/**
 * What each outage dataset's rows hold, for the page's own table and panels:
 * the column naming what is out (a unit, a border asset, an area), its areas,
 * its status and type where it has them, and the filters the table offers.
 * Also the words for ENTSO-E's area codes and statuses, and the events
 * table's columns.
 */
import { autoDigits, fmt0, fmtN } from '../../../design/format'
import { instantLabel } from '../../../design/time'
import { entsoeArea, productionType } from '../../_template/codes'
import type { EventRow, EventsRowsResponse, Scalar } from '../../contract'
import type { ColumnSpec, PageContext } from '../../define'

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

/** A09 is ENTSO-E's cancelled status; a blank status is a notice that states none. */
export function statusWords(v: Scalar): string | null {
  if (v === 'A09') return 'Cancelled'
  if (v === '' || v === null) return 'Not stated'
  return null
}

/** An area column: named as gridflow names it, a code it doesn't name shown as held. */
const area = (field: string, label: string): Field => ({ field, label, id: true, words: entsoeArea })
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

export function rowsOf(ctx: PageContext): EventRow[] {
  return (ctx.response as EventsRowsResponse | null)?.rows ?? []
}

// ---------------------------------------------------------------- the table

const asColumn = (f: Field): ColumnSpec => ({ field: f.field, label: f.label, format: f.id ? 'id' : 'text', text: f.words })

/**
 * The events table's columns: what is out, its status, then the block and
 * its figure; identifiers a name already covers go last, so a narrow box
 * cuts them off before the figures. A block start names its year: blocks
 * run years ahead of the window.
 */
export function columnsOf(shape: OutageShape): ColumnSpec[] {
  const one = (f: Field | undefined) => (f ? [asColumn(f)] : [])
  return [
    ...one(shape.name ?? shape.who),
    ...one(shape.status),
    { field: START, label: 'Block starts', format: 'time', years: true },
    { field: MW, label: MW_LABEL, format: 'number' },
    ...one(shape.type),
    ...shape.areas.map(asColumn),
    ...(shape.name ? one(shape.who) : []),
  ]
}
