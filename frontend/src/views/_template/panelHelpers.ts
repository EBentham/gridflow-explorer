/**
 * Figures the panels share: the units a set of series print in, which days
 * of the window hold rows, and which series a day table reads.
 */
import { listText } from '../../design/format'
import { datesBetween, dayStart, londonMidnight } from '../../design/time'
import type { ManifestDataset, ManifestSource, Scalar } from '../contract'
import type { PageContext, QuerySpec, RelatedData, SeriesView, ValueSpec } from '../define'
import { displayUnit } from './units'
import { daySummaries, latestValue, seriesId, type SeriesDef } from './seriesModel'
import { planPanels } from './seriesPanels'
import type { HeldDay } from './text'

/** The units a set of series print in: `GW`, or `GW and £/MWh`. */
export function unitsOf(series: SeriesDef[]): string | null {
  const labels = [...new Set(series.map((d) => d.unit.label ?? 'unit unconfirmed'))]
  return labels.length ? listText(labels) : null
}

/**
 * Every day of the window with what it holds: steps with a value (series),
 * or events. A series whose values are all text has nothing to pivot on, so
 * its rows holding some value are counted instead (the backend's rows for
 * missing steps hold none).
 */
export function heldDays(ctx: PageContext): HeldDay[] {
  if (!ctx.window) return []
  if (ctx.series && ctx.series.all.length) return daySummaries(ctx.series, ctx.window).map(({ day, start, expected, held }) => ({ day, start, expected, held }))
  const response = ctx.response
  if (response?.kind === 'events' || response?.kind === 'series') {
    const columns = response.kind === 'series' ? response.columns.map((c) => c.column) : null
    const counts = new Map<number, number>()
    for (const r of response.rows) {
      if (columns && !columns.some((c) => r[c] !== null && r[c] !== undefined)) continue
      const d = londonMidnight(r.ts)
      counts.set(d, (counts.get(d) ?? 0) + 1)
    }
    return datesBetween(ctx.window.start, ctx.window.end).map((day) => {
      const start = dayStart(day)
      return { day, start, expected: null, held: counts.get(start) ?? 0 }
    })
  }
  return []
}

/** The series a day table reads: the focused one when it is the page's own, else the main panel's first. */
export function daySeries(ctx: PageContext): SeriesDef | undefined {
  const model = ctx.series
  if (!model) return undefined
  return model.drawn.find((d) => seriesId(d) === ctx.focus) ?? planPanels(ctx).panels[0]?.series.find((d) => d.from === 'self') ?? model.drawn[0]
}

/**
 * The time the key's values are "latest" at, for its source line: the page's
 * own first drawn series' latest held value. A value in the key held at
 * another time, or on another clock (a related dataset), names its own.
 */
export function keyStamp(ctx: PageContext): { t: number; stepMs: number | null } | null {
  const model = ctx.series
  if (!model) return null
  const own =
    (ctx.view as SeriesView).chart === false
      ? model.drawn
      : planPanels(ctx)
          .panels.flatMap((p) => p.series)
          .filter((d) => d.from === 'self')
  const first = own[0] ?? model.drawn[0]
  const latest = first ? latestValue(model, first) : null
  return latest ? { t: latest.t, stepMs: model.stepMs } : null
}

/** One dataset in a source line: who publishes it, its id, the columns shown, the split, the filters and the unit. */
export interface SourcePart {
  source?: Pick<ManifestSource, 'name'> | null
  dataset: string
  columns?: string[]
  /** The column the series are split by. */
  by?: string | null
  /** Equality filters the rows carry (`market` day-ahead only). */
  filters?: Record<string, Scalar> | null
  /** As printed (`GW`, `£/MWh`); null prints "unit unconfirmed". Omit for no unit. */
  unit?: string | null
}

/**
 * The equality filters a request will carry: the query's own, none when it
 * clears them (`filters: null`), else the dataset's default filter.
 */
export function plannedFilters(query: QuerySpec | undefined, dataset: Pick<ManifestDataset, 'default_filter'> | null): Record<string, Scalar> {
  if (query?.filters === null) return {}
  if (query?.filters && Object.keys(query.filters).length) return query.filters
  const d = dataset?.default_filter
  return d ? { [d.column]: d.equals } : {}
}

/** A related dataset's filters: as applied once its rows are read, as planned before. */
export function relatedFilters(rel: RelatedData): Record<string, Scalar> {
  return rel.response ? rel.response.filters : plannedFilters(rel.spec.query, rel.dataset)
}

/** Source-line parts for the related datasets among `series`, each named in full, in the order they appear. */
export function relatedParts(ctx: PageContext, series: SeriesDef[], withColumns = true): SourcePart[] {
  const froms = [...new Set(series.map((d) => d.from))].filter((f) => f !== 'self')
  return froms.map((from) => {
    const rel = ctx.related[from]
    const defs = series.filter((d) => d.from === from)
    return {
      source: rel?.source ?? null,
      dataset: rel?.spec.dataset ?? from,
      columns: withColumns ? [...new Set(defs.map((d) => d.column))] : undefined,
      by: withColumns ? (rel?.series?.group ?? null) : null,
      filters: withColumns && rel ? relatedFilters(rel) : null,
      unit: unitsOf(defs),
    }
  })
}

/**
 * The units a dataset's value columns print in, from the config's specs and
 * the manifest: `GW`, or `unit unconfirmed`; undefined when none of them is a
 * number (text columns have no unit to name).
 */
function plannedUnit(dataset: ManifestDataset | null, columns: string[], specs: ValueSpec[] | undefined): string | undefined {
  const labels = columns.map((c) => {
    const spec = specs?.find((s) => s.column === c)
    const unit = displayUnit(spec?.unit ?? dataset?.values.find((v) => v.column === c)?.unit, spec?.display)
    return unit.numeric ? (unit.label ?? 'unit unconfirmed') : null
  })
  const known = [...new Set(labels.filter((l): l is string => l !== null))]
  return known.length ? listText(known) : undefined
}

/**
 * A series page's source line before its rows are read, or when they failed:
 * the columns it asks for, their unit, split and filters, and each related
 * dataset, from the config and the manifest rather than from rows.
 */
export function plannedParts(ctx: PageContext): { columns: string[]; by: string | null; filters: Record<string, Scalar> | null; unit: string | undefined; also: SourcePart[] } {
  const view = ctx.view
  const specs = view.body === 'series' ? view.values : undefined
  const columns = specs?.map((v) => v.column) ?? ctx.dataset.values.map((v) => v.column)
  // A query read from the URL isn't known here; its filters show once the rows are read.
  const query = typeof view.query === 'object' ? view.query : undefined
  const filters = ctx.response?.filters ?? (typeof view.query === 'function' ? null : plannedFilters(query, ctx.dataset))
  const also = (view.related ?? []).map((spec) => {
    const rel = ctx.related[spec.key]
    const cols = spec.values?.map((v) => v.column) ?? rel?.dataset?.values.map((v) => v.column) ?? []
    return {
      source: rel?.source ?? null,
      dataset: spec.dataset,
      columns: cols,
      by: spec.query?.group ?? null,
      filters: rel ? relatedFilters(rel) : plannedFilters(spec.query, null),
      unit: plannedUnit(rel?.dataset ?? null, cols, spec.values),
    }
  })
  return { columns, by: query?.group ?? null, filters, unit: plannedUnit(ctx.dataset, columns, specs), also }
}
