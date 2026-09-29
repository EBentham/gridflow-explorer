/**
 * Which bids the page reads: one zone and one direction at a time, from the
 * page's own URL parameters (`?zone=`, `?dir=`).
 *
 * The rows hold one row per bid per quarter-hour, and every bid is its own
 * series (`bid_mrid`). The rows endpoint splits by one column only and adds
 * nothing up, so the page reads a zone and a direction split by bid, and
 * adds the bids up itself (`figures.ts`). Zone and direction can't both be
 * read in one request, and a read beside the page's own can't follow its
 * parameters, so one of each is shown at a time.
 *
 * - Zones are named as gridflow's `connectors/entsoe/area_codes.py` names
 *   them (the same names the transfer capacity page uses); a code outside
 *   this list shows as the code itself.
 * - The directions each zone offers are those it holds rows for, read back
 *   from the local rows on 29 Sep 2026: Belgium and France both, Germany /
 *   Luxembourg A02 only. Without that, Germany / Luxembourg and A01 would
 *   read an empty window and say only that nothing is held.
 * - Belgium also offers one product at a time (`?product=a05|a07`), all of
 *   them by default.
 */
import type { QuerySpec } from '../../define'

export const AREA = 'area_code'
export const DIRECTION = 'direction'
export const BID = 'bid_mrid'
export const QUANTITY = 'quantity_mw'

export const PRODUCT = 'standard_market_product'

export const ZONE_PARAM = 'zone'
export const DIR_PARAM = 'dir'
export const PRODUCT_PARAM = 'product'

export interface Direction {
  /** As ENTSO-E codes it and the rows hold it. */
  code: string
  /** ENTSO-E's code list reading, which gridflow's activated-balancing tables use: never more than that. */
  reading: string
  /** The control's label. */
  label: string
  /** Up takes the colour the system prices use for a short system, down the one for a long system. */
  color: string
}

export const DIRECTIONS: Direction[] = [
  { code: 'A01', reading: 'up', label: 'A01 (up)', color: 'var(--chart-niv-short)' },
  { code: 'A02', reading: 'down', label: 'A02 (down)', color: 'var(--chart-niv-long)' },
]

export interface Zone {
  param: string
  /** The EIC code the rows carry in `area_code`. */
  code: string
  name: string
  /** The control's label. */
  short: string
  /** The direction codes held for it. */
  directions: string[]
  /**
   * The product codes a reader can pick one of, when there is a choice.
   * Belgium's bids carry A05 or A07, and one bid id can carry both in a
   * window, so a window read as means must pin one. France's are mostly
   * blank, which a filter can't match, so it gets no choice.
   */
  products: string[]
  /**
   * ENTSO-E's paged reply for this zone may have been cut off when gridflow
   * fetched it (the research card's finding): what is held is not complete.
   */
  cutOff: boolean
}

export const ZONES: Zone[] = [
  { param: 'be', code: '10YBE----------2', name: 'Belgium', short: 'Belgium', directions: ['A01', 'A02'], products: ['A05', 'A07'], cutOff: false },
  { param: 'fr', code: '10YFR-RTE------C', name: 'France', short: 'France', directions: ['A01', 'A02'], products: [], cutOff: true },
  { param: 'de-lu', code: '10Y1001A1001A82H', name: 'Germany / Luxembourg', short: 'Germany/Luxembourg', directions: ['A02'], products: [], cutOff: true },
]

/** The zone for the parameter's value; Belgium when it is absent or unknown. */
export const zoneOf = (param: string | null): Zone => ZONES.find((z) => z.param === param?.toLowerCase()) ?? ZONES[0]

/** The zone a code names, when gridflow names it. */
export const zoneByCode = (code: string | null | undefined): Zone | undefined => ZONES.find((z) => z.code === code)

/** The direction for the parameter's value, among those the zone holds; its first when absent, unknown or not held there. */
export function directionOf(zone: Zone, param: string | null): Direction {
  const code = param?.toUpperCase()
  const held = DIRECTIONS.filter((d) => zone.directions.includes(d.code))
  return held.find((d) => d.code === code) ?? held[0]
}

/** The product picked, among those the zone offers a choice of; null for all of them. */
export function productOf(zone: Zone, param: string | null): string | null {
  const code = param?.toUpperCase() ?? null
  return code !== null && zone.products.includes(code) ? code : null
}

/** One zone, one direction, and one product or all of them, split by bid. */
export function bidsQuery(params: URLSearchParams): QuerySpec {
  const zone = zoneOf(params.get(ZONE_PARAM))
  const dir = directionOf(zone, params.get(DIR_PARAM))
  const product = productOf(zone, params.get(PRODUCT_PARAM))
  return { group: BID, filters: { [AREA]: zone.code, [DIRECTION]: dir.code, ...(product ? { [PRODUCT]: product } : {}) } }
}

/** What the page shows, from the rows' filters when they are read, else from the parameters. */
export function selectionOf(filters: Record<string, unknown> | null | undefined, param: (name: string) => string | null): Selection {
  const text = (column: string) => (typeof filters?.[column] === 'string' ? (filters[column] as string) : null)
  const zone = zoneByCode(text(AREA)) ?? zoneOf(param(ZONE_PARAM))
  const product = filters ? productOf(zone, text(PRODUCT)) : productOf(zone, param(PRODUCT_PARAM))
  return { zone, dir: directionOf(zone, text(DIRECTION) ?? param(DIR_PARAM)), product }
}

export interface Selection {
  zone: Zone
  dir: Direction
  /** The product picked; null for all of them. */
  product: string | null
}

/** `Belgium, A01 (up)`, with the product when one is picked. */
export const selectionText = (s: Selection) => `${s.zone.name}, ${s.dir.label}${s.product ? `, product ${s.product}` : ''}`
