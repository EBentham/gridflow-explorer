/**
 * The wind and solar forecast's figures for the zone in view: each type on
 * its own clock, wind (onshore and offshore) and wind with solar summed at
 * the steps every part holds, and the zone's total generation forecast,
 * read beside it, joined to that sum. Shared by the main, key and working
 * panels so that they read the same numbers.
 */
import type { PageContext } from '../../define'
import type { SeriesDef } from '../../_template/seriesModel'
import { filteredZone, joinPair, SOLAR_CODE, sumTracks, TOTAL_KEY, trackOf, WIND_CODES, WS_TYPES, WS_ZONES, type Clocked, type Pair, type Track, type Zone } from './figures'

export interface WindSolar {
  zone: Zone
  /** The three types, stack order bottom first, each with its track when the rows hold it. */
  types: { type: (typeof WS_TYPES)[number]; track: Track | null }[]
  held: Track[]
  /** Types with no value in the window. */
  missing: (typeof WS_TYPES)[number][]
  /** Onshore and offshore summed, where the zone holds both (or the one it has). */
  wind: Clocked | null
  solar: Track | null
  /** Every type the zone holds, summed at the steps all of them hold. */
  sum: Clocked | null
  /** The zone's total generation forecast, when it is read and held. */
  total: Track | null
  /** Its read, for its state. */
  totalRead: PageContext['related'][string] | undefined
  /** Total less wind and solar; null when the clocks don't nest. */
  pair: Pair | null
  bucketed: boolean
}

export function windSolarOf(ctx: PageContext): WindSolar | null {
  const model = ctx.series
  if (!model) return null
  const zone = filteredZone(ctx, WS_ZONES)
  const own = model.all.filter((d) => d.from === 'self')
  const types = WS_TYPES.map((type) => {
    const def = own.find((d) => d.group === type.code)
    return { type, track: def && def.count > 0 ? trackOf(model, def, zone.cardStep) : null }
  })
  const held = types.flatMap((x) => (x.track ? [x.track] : []))
  const windTracks = types.filter((x) => WIND_CODES.includes(x.type.code) && x.track).map((x) => x.track as Track)
  const solar = types.find((x) => x.type.code === SOLAR_CODE)?.track ?? null
  const totalRead = ctx.related[TOTAL_KEY]
  const totalModel = totalRead?.series ?? null
  const totalDef: SeriesDef | undefined = totalModel?.all.find((d) => d.group === zone.value)
  const total = totalModel && totalDef && totalDef.count > 0 ? trackOf(totalModel, totalDef, zone.cardStep) : null
  const sum = held.length ? sumTracks(held) : null
  return {
    zone,
    types,
    held,
    missing: types.filter((x) => !x.track).map((x) => x.type),
    wind: windTracks.length ? sumTracks(windTracks) : null,
    solar,
    sum,
    total,
    totalRead,
    pair: sum && total ? joinPair(total, sum) : null,
    bucketed: model.bucketed,
  }
}

/** The types a zone holds none of, in words: `offshore wind or solar`. */
export function missingText(ws: WindSolar): string {
  const names = ws.missing.map((t) => t.prose)
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names.at(-1)}`
}
