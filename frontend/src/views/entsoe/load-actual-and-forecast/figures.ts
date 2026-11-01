/**
 * What the load panels share: the two columns, the four zones' names and
 * colours (a zone keeps its colour on both datasets), the colours of the
 * working panel's measures, the value-axis width that lines the working
 * chart up under the main one, and the join of actual load and its forecast
 * for one zone. Nothing is filled in: a quarter-hour missing from either side
 * has no error, never a zero.
 */
import type { GroupSpec, PageContext, RelatedData } from '../../define'
import { seriesId, type SeriesDef, type SeriesModel } from '../../_template/seriesModel'

export const ACTUAL = 'load_mw'
export const FORECAST = 'load_forecast_mw'
export const ACTUAL_ID = 'actual_load'
export const FORECAST_ID = 'load_forecast'
/** Each dataset reads the other beside it under these keys. */
export const ACTUAL_KEY = 'actual'
export const FORECAST_KEY = 'forecast'
export const AREA = 'area_code'

/** The Elexon page with GB's own demand. */
export const GB_DEMAND_ROUTE = '/sources/elexon/demand-outturn'

/** ENTSO-E's area codes (EIC) for the four zones held, largest first, as gridflow's area list names them. */
export const ZONES: GroupSpec[] = [
  { value: '10Y1001A1001A82H', label: 'Germany-Luxembourg', color: 'var(--chart-price)' },
  { value: '10YFR-RTE------C', label: 'France', color: 'var(--chart-price-2)' },
  { value: '10YNL----------L', label: 'Netherlands', color: 'var(--fuel-wind)' },
  { value: '10YBE----------2', label: 'Belgium', color: 'var(--fuel-pumped_storage)' },
]

/** The working panel's measures: one zone's actual and forecast, and the error between them. */
export const MEASURE = {
  actual: 'var(--chart-actual)',
  forecast: 'var(--chart-fan)',
  error: 'var(--fuel-other)',
} as const

export const zoneName = (area: string) => ZONES.find((z) => z.value === area)?.label ?? area

/** The page's actual and forecast models, whichever of the two datasets is open, and the other one's read. */
export function pairOf(ctx: PageContext): { actual: SeriesModel | null; forecast: SeriesModel | null; other: RelatedData | undefined; ownIsActual: boolean } {
  const ownIsActual = ctx.dataset.id === ACTUAL_ID
  const other = ctx.related[ownIsActual ? FORECAST_KEY : ACTUAL_KEY]
  const theirs = other?.series ?? null
  return ownIsActual ? { actual: ctx.series, forecast: theirs, other, ownIsActual } : { actual: theirs, forecast: ctx.series, other, ownIsActual }
}

/** A zone's series in a model. */
export const zoneDef = (model: SeriesModel | null | undefined, area: string): SeriesDef | undefined => model?.all.find((d) => d.group === area)

/** The zone the working panel reads: the one selected in the key, else the first drawn. */
export function zoneInView(ctx: PageContext): string | undefined {
  const model = ctx.series
  if (!model) return undefined
  const focused = model.all.find((d) => seriesId(d) === ctx.focus)
  return (focused ?? model.drawn[0])?.group ?? undefined
}
