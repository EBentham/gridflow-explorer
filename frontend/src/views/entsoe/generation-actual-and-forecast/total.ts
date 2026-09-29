/**
 * The total generation forecast's figures: each zone's forecast on its own
 * clock, its day-ahead load forecast (read beside it) on the same clock, and
 * the two joined, forecast generation less forecast load, at the steps both
 * hold. Shared by the main, key and working panels.
 */
import type { PageContext } from '../../define'
import { seriesId } from '../../_template/seriesModel'
import { joinPair, LOAD_KEY, TOTAL_ZONES, trackOf, ZONE_PARAM, zoneByCode, type Pair, type Track, type Zone } from './figures'

export interface ZoneForecast {
  zone: Zone
  /** Its generation forecast, when held in the window. */
  gen: Track | null
  /** Its load forecast, when read and held. */
  load: Track | null
  /** Generation less load; null when either is missing or the clocks don't nest. */
  pair: Pair | null
}

export function zoneForecasts(ctx: PageContext): ZoneForecast[] {
  const model = ctx.series
  if (!model) return []
  const loadModel = ctx.related[LOAD_KEY]?.series ?? null
  const own = model.all.filter((d) => d.from === 'self')
  const known = TOTAL_ZONES.map((zone) => ({ zone, def: own.find((d) => d.group === zone.value) }))
  const extra = own
    .filter((d) => !TOTAL_ZONES.some((z) => z.value === d.group))
    .map((d) => ({ zone: zoneByCode(d.group) ?? { value: d.group ?? '', param: '', label: d.label, prose: d.label, color: d.color, cardStep: 0 }, def: d }))
  return [...known, ...extra].map(({ zone, def }) => {
    const gen = def && def.count > 0 ? trackOf(model, def, zone.cardStep || null) : null
    const loadDef = loadModel?.all.find((d) => d.group === zone.value)
    const load = loadModel && loadDef && loadDef.count > 0 ? trackOf(loadModel, loadDef) : null
    return { zone, gen, load, pair: gen && load ? joinPair(gen, load) : null }
  })
}

/** The zone `?zone=` names, when it is one of these and held (it carries over from the other tabs). */
export function zoneOfParam(ctx: PageContext, zones: ZoneForecast[]): ZoneForecast | undefined {
  const p = ctx.param(ZONE_PARAM)
  return zones.find((z) => z.gen && z.zone.param === p)
}

/** The zone the key and working panel read: the one selected in the key, else the one `?zone=` names, else the first held. */
export function zoneInView(ctx: PageContext, zones: ZoneForecast[]): ZoneForecast | undefined {
  return zones.find((z) => z.gen && seriesId(z.gen.def) === ctx.focus) ?? zoneOfParam(ctx, zones) ?? zones.find((z) => z.gen)
}
