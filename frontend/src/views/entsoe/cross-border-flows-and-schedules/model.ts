/**
 * The page's rows as borders and zones.
 *
 * - A border is one out area of the in area read (the page's own series),
 *   with the other border dataset beside it when that was read for the same
 *   in area: the schedule beside a flow, or the flow beside a schedule. The
 *   beside read is pinned to GB's borders (a related read can't follow the
 *   page's parameters), so the continental pairs are drawn alone.
 * - A zone is one continental area's net position, held on two sides: named
 *   as the in area (the page's own read) or as the out area (read beside it).
 *   The two are never combined into one signed number.
 * - Each line keeps its own points and step, with a null at every missing
 *   step (`figures.ts`), and becomes one panel of the stacked chart.
 */
import { CHART } from '../../../design/chartTheme'
import type { Scalar } from '../../contract'
import type { PageContext } from '../../define'
import type { ChartPanel } from '../../_template/SeriesChart'
import type { SeriesDef, SeriesModel } from '../../_template/seriesModel'
import { areaColor, areaName, areaRank, borderName, BESIDE_COLOR, IN_PARAM, inAreaCode, SIDE_COLORS } from './areas'
import { AXIS_WIDTH, PANEL_HEIGHT, pointsOf, rowsOf, stepOf, withBreaks, type Point } from './figures'

export const FLOWS = 'cross_border_flows'
export const SCHEDULES = 'commercial_schedules'
export const NET_POSITIONS = 'net_positions'

/** What a border dataset is, and what is read beside it. */
export interface Role {
  /** Its measure in words, lower case: `physical flow`. */
  own: string
  beside: string
  /** The related read's key. */
  besideKey: string
  column: string
}

export const FLOW_ROLE: Role = { own: 'physical flow', beside: 'commercial schedule', besideKey: 'schedule', column: 'flow_mw' }
export const SCHEDULE_ROLE: Role = { own: 'commercial schedule', beside: 'physical flow', besideKey: 'flow', column: 'quantity_mw' }

export const roleOf = (ctx: PageContext): Role => (ctx.view.id === SCHEDULES ? SCHEDULE_ROLE : FLOW_ROLE)

/** The related read of the net positions with the zone named as the out area. */
export const OUT_SIDE_KEY = 'outside'

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

const holds = (line: Line | null) => Boolean(line?.points.some((p) => p.v !== null))

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
  return str(ctx.response?.filters?.in_area_code) ?? inAreaCode(ctx.param(IN_PARAM))
}

export interface Border {
  /** The key panel's focus id. */
  id: string
  inArea: string
  out: string
  name: string
  color: string
  own: Line | null
  beside: Line | null
}

/**
 * Every border of the in area read that holds a value in the window, own or
 * beside, in the areas' drawing order.
 */
export function bordersOf(ctx: PageContext): Border[] {
  const model = ctx.series
  if (!model) return []
  const role = roleOf(ctx)
  const inArea = inAreaOf(ctx)
  const rel = ctx.related[role.besideKey]
  const besideModel = rel?.series && str(rel.response?.filters?.in_area_code) === inArea ? rel.series : null
  const outs = new Set<string>()
  for (const d of model.all) if (d.group !== null) outs.add(d.group)
  for (const d of besideModel?.all ?? []) if (d.group !== null) outs.add(d.group)
  return [...outs]
    .sort((a, b) => areaRank(a) - areaRank(b) || a.localeCompare(b))
    .map((out) => ({
      id: `border:${out}`,
      inArea,
      out,
      name: borderName(inArea, out),
      color: areaColor(out),
      own: lineOf(model, model.all.find((d) => d.group === out)),
      beside: besideModel ? lineOf(besideModel, besideModel.all.find((d) => d.group === out)) : null,
    }))
    .filter((b) => holds(b.own) || holds(b.beside))
}

/** The border the key selected, else the first holding a value of the page's own. */
export function focusedBorder(ctx: PageContext, borders: Border[]): Border | undefined {
  return borders.find((b) => b.id === ctx.focus) ?? borders.find((b) => holds(b.own)) ?? borders[0]
}

/** The beside read, when it is the one drawn: read for the same in area as the page's own. */
export function besideState(ctx: PageContext): 'drawn' | 'other-area' | 'error' | 'none' {
  const role = roleOf(ctx)
  const rel = ctx.related[role.besideKey]
  if (!rel) return 'none'
  if (rel.state === 'error' || rel.state === 'refreshing') return 'error'
  if (str(rel.response?.filters?.in_area_code) !== inAreaOf(ctx)) return 'other-area'
  return rel.series?.all.some((d) => d.count > 0) ? 'drawn' : 'none'
}

const minStep = (steps: (number | null)[]) => {
  const known = steps.filter((s): s is number => s !== null)
  return known.length ? Math.min(...known) : null
}

/** A panel's own caption: the area it draws, then the unit. */
const captioned = (def: SeriesDef, name: string): SeriesDef['unit'] => ({ ...def.unit, caption: `${name}, ${def.unit.label ?? 'unit unconfirmed'}` })

/**
 * One border's panel: its own line in the area's colour, drawn over the one
 * read beside it. Alone, it takes the full height and labels its extremes.
 */
export function borderPanel(b: Border, role: Role, alone: boolean): ChartPanel | null {
  const own = b.own && holds(b.own) ? { ...b.own, def: { ...b.own.def, label: `${b.name}, ${role.own}`, color: b.color } } : null
  const beside = b.beside && holds(b.beside) ? { ...b.beside, def: { ...b.beside.def, label: `${b.name}, ${role.beside}`, color: BESIDE_COLOR } } : null
  const lines = [beside, own].filter((l): l is Line => l !== null)
  if (!lines.length) return null
  const lead = own ?? lines[0]
  return {
    rows: rowsOf(lines.map((l) => ({ field: l.def.field, points: l.points }))),
    series: lines.map((l) => l.def),
    mark: 'line',
    unit: captioned(lead.def, b.name),
    stepMs: minStep(lines.map((l) => l.step)),
    height: alone ? CHART.height : PANEL_HEIGHT,
    zero: true,
    extremes: alone && own ? own.def : null,
    axisWidth: AXIS_WIDTH,
  }
}

// ---------------------------------------------------------------- net positions

export interface Zone {
  id: string
  code: string
  name: string
  /** Named as the in area, the placeholder as the out area. */
  inSide: Line | null
  /** Named as the out area, the placeholder as the in area. */
  outSide: Line | null
}

/** Every zone holding a value on either side in the window, in the areas' drawing order. */
export function zonesOf(ctx: PageContext): Zone[] {
  const model = ctx.series
  if (!model) return []
  const outModel = ctx.related[OUT_SIDE_KEY]?.series ?? null
  const codes = new Set<string>()
  for (const d of model.all) if (d.group !== null) codes.add(d.group)
  for (const d of outModel?.all ?? []) if (d.group !== null) codes.add(d.group)
  return [...codes]
    .sort((a, b) => areaRank(a) - areaRank(b) || a.localeCompare(b))
    .map((code) => ({
      id: `zone:${code}`,
      code,
      name: areaName(code),
      inSide: lineOf(model, model.all.find((d) => d.group === code)),
      outSide: outModel ? lineOf(outModel, outModel.all.find((d) => d.group === code)) : null,
    }))
    .filter((z) => holds(z.inSide) || holds(z.outSide))
}

export function focusedZone(ctx: PageContext, zones: Zone[]): Zone | undefined {
  return zones.find((z) => z.id === ctx.focus) ?? zones[0]
}

export const SIDE_LABELS = { in: 'named as the in area', out: 'named as the out area' } as const

/** One zone's panel: the two sides as two unsigned lines, never one signed one. */
export function zonePanel(z: Zone, alone: boolean): ChartPanel | null {
  const side = (line: Line | null, which: 'in' | 'out'): Line | null =>
    line && holds(line) ? { ...line, def: { ...line.def, label: `${z.name}, ${SIDE_LABELS[which]}`, color: SIDE_COLORS[which] } } : null
  const lines = [side(z.inSide, 'in'), side(z.outSide, 'out')].filter((l): l is Line => l !== null)
  if (!lines.length) return null
  return {
    rows: rowsOf(lines.map((l) => ({ field: l.def.field, points: l.points }))),
    series: lines.map((l) => l.def),
    mark: 'line',
    unit: captioned(lines[0].def, z.name),
    stepMs: minStep(lines.map((l) => l.step)),
    height: alone ? CHART.height : PANEL_HEIGHT,
    zero: true,
    axisWidth: AXIS_WIDTH,
  }
}
