/**
 * The page's rows as borders, each with the measures read on it.
 *
 * - Four measures, one per held dataset: the day-ahead net transfer
 *   capacity, the capacity allocated in earlier auctions, the capacity
 *   nominated, and the DC link's intraday limit. Each keeps one colour on
 *   every view of the page, as a panel draws up to three of them on one border.
 * - A border is one out area of the in area read (the page's own series).
 *   The other measures are read beside it for GB's borders (a related read
 *   can't follow the page's parameters), and drawn on a border only when they
 *   were read for the same in area. Only the borders the page's own dataset
 *   holds a value on are drawn: a measure read beside never adds a border.
 * - Each line keeps its own points and step, with a null at every missing
 *   step (`figures.ts`), and becomes one panel of the stacked chart.
 */
import { CHART } from '../../../design/chartTheme'
import { DAY_MS } from '../../../design/time'
import type { Scalar } from '../../contract'
import type { PageContext } from '../../define'
import type { ChartPanel } from '../../_template/SeriesChart'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'
import { areaRank, borderName, IN_PARAM, inAreaCode } from './areas'
import { aloneCount, AXIS_WIDTH, PANEL_HEIGHT, pointsOf, rowsOf, stepOf, withBreaks, type Point } from './figures'

export const NTC = 'net_transfer_capacity'
export const ALLOCATED = 'total_capacity_allocated'
export const NOMINATED = 'total_nominated_capacity'
export const DC_LIMITS = 'dc_link_intraday_transfer_limits'

export interface Measure {
  /** The related read's key when this measure is read beside another. */
  key: string
  dataset: string
  column: string
  /** Sentence case, for keys and headings: `Net transfer capacity`. */
  label: string
  /** Lower case, inside a sentence: `net transfer capacity`. */
  words: string
  /** Short, for table headings. */
  short: string
  color: string
  /**
   * Published only when there is something to publish (a limit set), so an
   * hour with no row isn't a missing step: its days are counted without a
   * full day to count against, and no gap is named.
   */
  whenSet?: boolean
}

// The capacity in the page's lead colour; allocated, nominated and the limit in
// colours no other measure uses, apart from each other and from it in both themes.
export const MEASURES: Record<string, Measure> = {
  [NTC]: { key: 'ntc', dataset: NTC, column: 'ntc_mw', label: 'Net transfer capacity', words: 'net transfer capacity', short: 'Net transfer capacity', color: 'var(--chart-price)' },
  [ALLOCATED]: { key: 'allocated', dataset: ALLOCATED, column: 'quantity_mw', label: 'Capacity allocated', words: 'capacity allocated', short: 'Allocated', color: 'var(--fuel-pumped_storage)' },
  [NOMINATED]: { key: 'nominated', dataset: NOMINATED, column: 'quantity_mw', label: 'Capacity nominated', words: 'capacity nominated', short: 'Nominated', color: 'var(--chart-price-2)' },
  [DC_LIMITS]: { key: 'limit', dataset: DC_LIMITS, column: 'quantity_mw', label: 'Intraday limit', words: 'intraday limit', short: 'Intraday limit', color: 'var(--fuel-peaking)', whenSet: true },
}

/** What each dataset's page draws beside its own measure, on GB's borders. */
export const BESIDE: Record<string, Measure[]> = {
  [NTC]: [MEASURES[ALLOCATED], MEASURES[NOMINATED]],
  [ALLOCATED]: [MEASURES[NTC]],
  [NOMINATED]: [MEASURES[NTC]],
  [DC_LIMITS]: [MEASURES[NTC]],
}

export const measureOf = (ctx: PageContext): Measure => MEASURES[ctx.view.id] ?? MEASURES[NTC]
export const besideOf = (ctx: PageContext): Measure[] => BESIDE[ctx.view.id] ?? []

export interface Line {
  def: SeriesDef
  /** Its own points, with a null at every missing step. */
  points: Point[]
  step: number | null
}

const str = (v: Scalar | undefined): string | null => (typeof v === 'string' ? v : null)

function lineOf(model: SeriesModel, def: SeriesDef | undefined): Line | null {
  if (!def) return null
  const raw = pointsOf(model.rows, def.field)
  const step = stepOf(raw)
  return { def, points: withBreaks(raw, step), step }
}

export const holds = (line: Line | null | undefined) => Boolean(line?.points.some((p) => p.v !== null))

/** The step a line's days are counted on: none for a measure published only when set. */
export const countStep = (m: Measure, line: Line | null | undefined) => (m.whenSet ? null : (line?.step ?? null))

/**
 * The latest value held among the lines, with its line's step: the time a
 * key's "latest" values are at, named in its source line. A line whose
 * latest value is older names its own.
 */
export function latestStamp(lines: (Line | null)[]): { t: number; step: number | null } | null {
  let best: { t: number; step: number | null } | null = null
  for (const l of lines) {
    const last = l?.points.findLast((p) => p.v !== null)
    if (l && last && (!best || last.t > best.t)) best = { t: last.t, step: l.step }
  }
  return best
}

/** The in area the page reads its borders for: as the rows came back, else as asked. */
export function inAreaOf(ctx: PageContext): string {
  return str(ctx.response?.filters?.in_area_code) ?? inAreaCode(ctx.view.id, ctx.param(IN_PARAM))
}

export type BesideState = 'drawn' | 'other-area' | 'error' | 'none'

/** A measure read beside the page's own: drawn when read for the same in area and holding a value. */
export function besideState(ctx: PageContext, m: Measure): BesideState {
  const rel = ctx.related[m.key]
  if (!rel) return 'none'
  if (rel.state === 'error' || rel.state === 'refreshing') return 'error'
  if (str(rel.response?.filters?.in_area_code) !== inAreaOf(ctx)) return 'other-area'
  return rel.series?.all.some((d) => d.count > 0) ? 'drawn' : 'none'
}

export interface Beside {
  measure: Measure
  line: Line
}

export interface Border {
  /** The key panel's focus id. */
  id: string
  inArea: string
  out: string
  name: string
  own: Line
  /** The measures read beside it that hold a value on it, in the page's order. */
  beside: Beside[]
}

/** Every border of the in area read on which the page's own dataset holds a value in the window, in the areas' drawing order. */
export function bordersOf(ctx: PageContext): Border[] {
  const model = ctx.series
  if (!model) return []
  const inArea = inAreaOf(ctx)
  const besides = besideOf(ctx).flatMap((m) => {
    const rel = ctx.related[m.key]
    return besideState(ctx, m) === 'drawn' && rel?.series ? [{ measure: m, model: rel.series }] : []
  })
  const out: Border[] = []
  for (const d of model.all) {
    if (d.group === null) continue
    const own = lineOf(model, d)
    if (!own || !holds(own)) continue
    const group = d.group
    out.push({
      id: `border:${group}`,
      inArea,
      out: group,
      name: borderName(inArea, group),
      own,
      beside: besides.flatMap(({ measure, model: m }) => {
        const line = lineOf(m, m.all.find((x) => x.group === group))
        return line && holds(line) ? [{ measure, line }] : []
      }),
    })
  }
  return out.sort((a, b) => areaRank(a.out) - areaRank(b.out) || a.out.localeCompare(b.out))
}

/** The border the key selected, else the first. */
export function focusedBorder(ctx: PageContext, borders: Border[]): Border | undefined {
  return borders.find((b) => b.id === ctx.focus) ?? borders[0]
}

const minStep = (steps: (number | null)[]) => {
  const known = steps.filter((s): s is number => s !== null)
  return known.length ? Math.min(...known) : null
}

/**
 * The values a border's lines hold that the chart draws nothing for: those
 * with nothing held a step either side on their own line. The chart dots its
 * values only on a clock of a day or longer, so on a finer one no mark is
 * left for them.
 */
export function aloneIn(b: Border): number {
  const lines = [b.own, ...b.beside.map((x) => x.line)]
  const step = minStep(lines.map((l) => l.step))
  if (step !== null && step >= DAY_MS) return 0
  return lines.reduce((s, l) => s + aloneCount(l.points), 0)
}

/**
 * One border's panel: the measures read beside it first, then its own on top,
 * each in its measure's colour. Alone, it takes the full height and labels
 * its own measure's extremes.
 */
export function borderPanel(b: Border, own: Measure, alone: boolean): ChartPanel {
  // Every read keys a border by its out area: the chart needs a key of its own per line.
  const tag = (line: Line, m: Measure): Line => ({ ...line, def: { ...line.def, key: `${m.key}:${b.out}`, label: `${b.name}, ${m.words}`, color: m.color } })
  const mine = tag(b.own, own)
  const lines = [...b.beside.map((x) => tag(x.line, x.measure)), mine]
  return {
    rows: rowsOf(lines.map((l) => ({ field: l.def.field, points: l.points }))),
    series: lines.map((l) => l.def),
    mark: 'line',
    unit: { ...mine.def.unit, caption: `${b.name}, ${mine.def.unit.label ?? 'unit unconfirmed'}` },
    stepMs: minStep(lines.map((l) => l.step)),
    height: alone ? CHART.height : PANEL_HEIGHT,
    zero: true,
    extremes: alone ? mine.def : null,
    axisWidth: AXIS_WIDTH,
  }
}
