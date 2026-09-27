/**
 * Table cells for events and reference rows: a `ColumnSpec` becomes a
 * `TableCol` with its header (the unit after a comma), its cell (identifiers
 * in mono, numbers in the column's unit, instants on the UK clock, dates with
 * their year) and its sort value. A missing value reads as a dash, never 0.
 */
import type { ReactNode } from 'react'
import { autoDigits, fmtN } from '../../design/format'
import { instantLabel, rangeText } from '../../design/time'
import type { Scalar } from '../contract'
import type { CellFormat, ColumnSpec } from '../define'
import { displayUnit } from './units'
import type { TableCol } from './WindowedTable'

type Row = Record<string, Scalar | undefined>

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const MISSING = <span className="gf-cell-missing">–</span>

/** A time cell's instant: epoch ms or an ISO string; null when it isn't one. */
export function toInstant(v: Scalar | undefined): number | null {
  if (typeof v === 'number') return v
  if (typeof v === 'string' && ISO_INSTANT.test(v)) {
    const ms = Date.parse(v)
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

/** A format for a field from its values: numbers, flags, instants, dates, else text. */
export function inferFormat(rows: Row[], field: string): CellFormat {
  const seen = rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined).slice(0, 200)
  if (!seen.length) return 'text'
  if (seen.every((v) => typeof v === 'number')) return 'number'
  if (seen.every((v) => typeof v === 'boolean')) return 'bool'
  if (seen.every((v) => typeof v === 'string' && ISO_INSTANT.test(v))) return 'time'
  if (seen.every((v) => typeof v === 'string' && ISO_DATE.test(v))) return 'date'
  return 'text'
}

/** Every field of the rows, in first-seen order, but those named in `skip`. */
export function fieldsOf(rows: Row[], skip: string[] = []): string[] {
  const out: string[] = []
  for (const r of rows.slice(0, 200)) for (const k of Object.keys(r)) if (!skip.includes(k) && !out.includes(k)) out.push(k)
  return out
}

/** Column specs for every field, with formats read from the values. */
export function inferColumns(rows: Row[], skip: string[] = []): ColumnSpec[] {
  return fieldsOf(rows, skip).map((field) => ({ field, format: inferFormat(rows, field) }))
}

/** A value as its column reads it in words (`ColumnSpec.text`); null to show it as held. */
export function wordsOf(spec: Pick<ColumnSpec, 'text'>, v: Scalar | undefined): string | null {
  if (!spec.text || v === null || v === undefined || v === '') return null
  return spec.text(v)
}

/** A column's header: its label, or the field id as an identifier, then the unit. */
export function headerOf(spec: ColumnSpec): ReactNode {
  const unit = spec.format === 'number' && spec.unit ? displayUnit(spec.unit, spec.display ?? 'MW').label : null
  const name = spec.label ?? <code>{spec.field}</code>
  return unit ? (
    <>
      {name}, {unit}
    </>
  ) : (
    name
  )
}

/**
 * A spec as a table column over plain rows. `years` names each time's year:
 * a reference table has no window to date its times.
 */
export function toTableCol(spec: ColumnSpec, { years = false }: { years?: boolean } = {}): TableCol<Row> {
  const format = spec.format ?? 'text'
  const unit = spec.unit ? displayUnit(spec.unit, spec.display ?? 'MW') : null
  const cell = (v: Scalar | undefined): ReactNode => {
    if (v === null || v === undefined || v === '') return MISSING
    const words = wordsOf(spec, v)
    if (words !== null) return words
    switch (format) {
      case 'id':
        return <code>{String(v)}</code>
      case 'number': {
        if (typeof v !== 'number') return String(v)
        const shown = unit && unit.numeric ? v * unit.factor : v
        return unit && unit.label !== null ? unit.plain(shown) : fmtN(shown, autoDigits(shown))
      }
      case 'time': {
        const ms = toInstant(v)
        return ms === null ? String(v) : instantLabel(ms, { year: years })
      }
      case 'date':
        return typeof v === 'string' && ISO_DATE.test(v) ? rangeText(v, v) : String(v)
      case 'bool':
        return v === true ? 'yes' : v === false ? 'no' : String(v)
      default:
        return String(v)
    }
  }
  const sortValue = (r: Row): string | number | null => {
    const v = r[spec.field]
    if (v === null || v === undefined || v === '') return null
    const words = wordsOf(spec, v)
    if (words !== null) return words
    if (format === 'time') return toInstant(v)
    if (typeof v === 'number') return v
    // A number the table holds as text ("22.3") sorts as the number; the cell shows it as published.
    if (format === 'number' && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
    if (typeof v === 'boolean') return v ? 1 : 0
    return String(v)
  }
  return { key: spec.field, label: headerOf(spec), num: format === 'number', render: (r) => cell(r[spec.field]), sortValue }
}
