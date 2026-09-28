/**
 * The output-by-unit figures: every unit of the zone and type in view on
 * its own clock, the ones the chart draws (the largest by mean output, each
 * given a series colour by that rank, so no two drawn units share one), and
 * the units' output summed at the steps every one of them holds.
 */
import type { PageContext } from '../../define'
import { seriesId, type SeriesDef } from '../../_template/seriesModel'
import { displayUnit } from '../../_template/units'
import { filteredType, filteredZone, statsOf, sumTracks, trackOf, UNIT_ZONES, unitColor, type Clocked, type Fuel, type Stats, type Track, type Zone } from './figures'

/** The chart draws at most this many units: one per series colour. */
export const UNITS_DRAWN = 9

/** The units' total, in GW: the units themselves stay in MW. */
export const TOTAL_UNIT = displayUnit('MW', 'GW')

export interface UnitRow {
  track: Track
  stats: Stats
  latest: { t: number; v: number } | null
  /** Its colour and place on the chart, when drawn. */
  drawn: SeriesDef | null
  /** No value above zero at any step held. */
  idle: boolean
}

export interface Units {
  zone: Zone
  type: Fuel
  /** Every unit holding a value in the window, largest mean output first. */
  units: UnitRow[]
  drawn: SeriesDef[]
  /** The units summed at the steps all of them hold, in MW. */
  total: Clocked | null
  bucketed: boolean
}

export function unitsOf(ctx: PageContext): Units | null {
  const model = ctx.series
  if (!model) return null
  const held = model.all.filter((d) => d.from === 'self' && d.count > 0)
  const rows = held
    .map((def) => {
      const track = trackOf(model, def)
      const stats = statsOf(track.points)
      return { track, stats, latest: track.points.at(-1) ?? null, idle: stats.high !== null && stats.high.v <= 0 }
    })
    .sort((a, b) => (b.stats.mean ?? 0) - (a.stats.mean ?? 0))
  const drawn = rows.slice(0, UNITS_DRAWN).map((r, i) => ({ ...r.track.def, color: unitColor(i) }))
  return {
    zone: filteredZone(ctx, UNIT_ZONES),
    type: filteredType(ctx),
    units: rows.map((r) => ({ ...r, drawn: drawn.find((d) => d.key === r.track.def.key) ?? null })),
    drawn,
    total: rows.length ? sumTracks(rows.map((r) => r.track)) : null,
    bucketed: model.bucketed,
  }
}

/** The unit selected in the key or the table, drawn or not. */
export const focusedUnit = (ctx: PageContext, u: Units): UnitRow | undefined => u.units.find((r) => seriesId(r.track.def) === ctx.focus)
