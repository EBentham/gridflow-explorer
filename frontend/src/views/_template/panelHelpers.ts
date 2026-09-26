/**
 * Figures the panels share: the units a set of series print in, which days
 * of the window hold rows, and which series a day table reads.
 */
import { listText } from '../../design/format'
import { datesBetween, dayStart, londonMidnight } from '../../design/time'
import type { ManifestSource } from '../contract'
import type { PageContext } from '../define'
import { daySummaries, seriesId, type SeriesDef } from './seriesModel'
import { planPanels } from './seriesPanels'
import type { HeldDay } from './text'

/** The units a set of series print in: `GW`, or `GW and £/MWh`. */
export function unitsOf(series: SeriesDef[]): string | null {
  const labels = [...new Set(series.map((d) => d.unit.label ?? 'unit unconfirmed'))]
  return labels.length ? listText(labels) : null
}

/** Every day of the window with what it holds: steps with a value (series), or events. */
export function heldDays(ctx: PageContext): HeldDay[] {
  if (!ctx.window) return []
  if (ctx.series) return daySummaries(ctx.series, ctx.window).map(({ day, start, expected, held }) => ({ day, start, expected, held }))
  if (ctx.response?.kind === 'events') {
    const counts = new Map<number, number>()
    for (const r of ctx.response.rows) {
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

/** One dataset in a source line: who publishes it, its id, the columns shown, the split and the unit. */
export interface SourcePart {
  source?: Pick<ManifestSource, 'name'> | null
  dataset: string
  columns?: string[]
  /** The column the series are split by. */
  by?: string | null
  /** As printed (`GW`, `£/MWh`); null prints "unit unconfirmed". Omit for no unit. */
  unit?: string | null
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
      unit: unitsOf(defs),
    }
  })
}
