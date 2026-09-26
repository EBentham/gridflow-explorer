/**
 * A series page's chart panels from its config: which columns go in the
 * main panel, which in the lower one (the page's own, or a related
 * dataset's), and which only in the table because their unit fits neither
 * axis. By default the main panel takes the columns that share the first
 * column's unit and a second unit gets a lower panel of its own (a price
 * above its volume), so no axis ever mixes units.
 */
import { CHART } from '../../design/chartTheme'
import type { Mark, PageContext, SeriesView } from '../define'
import type { ChartPanel } from './SeriesChart'
import { seriesId, type SeriesDef, type SeriesModel } from './seriesModel'
import { sameUnit } from './units'

export interface PanelPlan {
  panels: ChartPanel[]
  /** How each drawn series is marked, by `seriesId`, for the key. */
  marks: Map<string, Mark>
  /** Drawn series left to the table: their unit fits neither panel. */
  tableOnly: SeriesDef[]
  /** A related dataset the lower panel wanted, when it isn't there to draw. */
  missingLower: { label: string; reason: string } | null
}

const unique = <T>(xs: T[]) => [...new Set(xs)]

export function planPanels(ctx: PageContext): PanelPlan {
  const model = ctx.series
  const view = ctx.view as SeriesView
  const empty: PanelPlan = { panels: [], marks: new Map(), tableOnly: [], missingLower: null }
  if (!model || view.body !== 'series') return empty
  const spec = view.chart ?? {}
  const lower = spec.lower
  const columns = unique(model.drawn.map((d) => d.column))
  const lowerSelf = lower && !lower.from ? (lower.values ?? columns.filter((c) => !(spec.values ?? []).includes(c))) : []

  let mainCols = (spec.values ?? columns).filter((c) => columns.includes(c) && !lowerSelf.includes(c))
  const first = model.drawn.find((d) => mainCols.includes(d.column))
  const fits = (d: SeriesDef) => first !== undefined && sameUnit(d.unit, first.unit)
  const main = model.drawn.filter((d) => mainCols.includes(d.column) && fits(d))
  mainCols = unique(main.map((d) => d.column))

  // A second unit with no lower panel configured gets one of its own.
  let lowerSeries: SeriesDef[] = []
  let lowerModel: SeriesModel | null = null
  let missingLower: PanelPlan['missingLower'] = null
  if (lower?.from) {
    const rel = ctx.related[lower.from]
    lowerModel = rel?.series ?? null
    lowerSeries = lowerModel ? lowerModel.drawn.filter((d) => !lower.values || lower.values.includes(d.column)) : []
    if (!lowerSeries.length) {
      const reason = !rel ? 'it is not in this page’s related datasets' : rel.state === 'error' || rel.state === 'refreshing' ? (rel.error?.message ?? 'it did not load') : 'it holds no values for this window'
      missingLower = { label: rel?.spec.label ?? lower.from, reason }
    }
  } else {
    const rest = model.drawn.filter((d) => !main.includes(d))
    const candidates = lower ? rest.filter((d) => lowerSelf.includes(d.column)) : rest
    const lowerFirst = candidates[0]
    lowerSeries = lowerFirst ? candidates.filter((d) => sameUnit(d.unit, lowerFirst.unit)) : []
    lowerModel = model
  }
  const tableOnly = model.drawn.filter((d) => !main.includes(d) && !(lowerModel === model && lowerSeries.includes(d)))

  const mainMark: Mark = spec.mark ?? 'line'
  const lowerMark: Mark = lower?.mark ?? (lowerModel === model ? 'bars' : 'line')
  const hasLower = lowerSeries.length > 0
  const focusMain = main.find((d) => seriesId(d) === ctx.focus)
  const extremes = spec.extremes ?? (mainMark === 'line' && main.length === 1)
  const panels: ChartPanel[] = []
  if (main.length) {
    panels.push({
      rows: model.rows,
      series: main,
      mark: mainMark,
      unit: main[0].unit,
      stepMs: model.stepMs,
      bucketed: model.bucketed,
      height: spec.height ?? (hasLower ? Math.round(CHART.height * 0.7) : CHART.height),
      zero: spec.zero,
      extremes: extremes ? (focusMain ?? main[0]) : null,
    })
  }
  if (hasLower && lowerModel) {
    panels.push({
      rows: lowerModel.rows,
      series: lowerSeries,
      mark: lowerMark,
      unit: lowerSeries[0].unit,
      stepMs: lowerModel.stepMs,
      bucketed: lowerModel.bucketed,
      height: lower?.height ?? Math.round(CHART.height * 0.36),
      zero: lowerMark !== 'line',
      extremes: lower?.extremes ? lowerSeries[0] : null,
    })
  }
  const marks = new Map<string, Mark>([...main.map((d) => [seriesId(d), mainMark] as const), ...lowerSeries.map((d) => [seriesId(d), lowerMark] as const)])
  return { panels, marks, tableOnly, missingLower }
}
