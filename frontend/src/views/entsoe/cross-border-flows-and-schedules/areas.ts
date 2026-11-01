/**
 * The page's colours for the areas its rows name, and its reads. Names,
 * border names, drawing order and the one-in-area-at-a-time read are the
 * template's (`_template/borders.ts`).
 *
 * Colours follow the area: an out area, or a zone, keeps its token on every
 * view of the page. The dataset read beside a border, and the two sides of a
 * net position, take colours no area uses.
 */
import { IN_FR, IN_GB, IN_NL, type InArea } from '../../_template/borders'
import { EIC, ENTSOE_AREAS } from '../../_template/codes'
import type { GroupSpec, QuerySpec } from '../../define'

/** The placeholder ENTSO-E puts opposite each zone in the net positions: it names no area. */
export const REGION = 'REGION_CODE-----'

/** Each area's colour, in drawing order. */
const COLORS: [string, string][] = [
  [EIC.FR, 'var(--chart-price)'],
  [EIC.NL, 'var(--chart-price-2)'],
  [EIC.BE, 'var(--fuel-wind)'],
  [EIC.IE_SEM, 'var(--fuel-biomass)'],
  [EIC.DE_LU, 'var(--fuel-peaking)'],
  [EIC.GB, 'var(--fuel-other)'],
]

/** Labels and colours for the split column's values, in drawing order. */
export const AREA_GROUPS: GroupSpec[] = COLORS.map(([code, color]) => ({ value: code, label: ENTSOE_AREAS[code], color }))

export const areaColor = (code: string): string => COLORS.find(([c]) => c === code)?.[1] ?? 'var(--fuel-other)'

/**
 * The dataset read beside a border's own: the schedule beside a flow, or the
 * flow beside a schedule. Purple, which none of GB's four borders uses and
 * which stays apart from their petrol, orange, teal and gold in both themes.
 */
export const BESIDE_COLOR = 'var(--fuel-pumped_storage)'

/**
 * A zone named as the in area, and as the out area, in the net positions:
 * orange against blue, neither a direction's colour nor near the accent.
 */
export const SIDE_COLORS = { in: 'var(--fuel-gas)', out: 'var(--fuel-hydro)' } as const

/** The in areas gridflow requests pairs from (the research card's eight pairs). */
export const IN_AREAS: InArea[] = [IN_GB, IN_FR, IN_NL]

/** Net positions with the zone named as the in area (the page's own read) and as the out area (read beside it). */
export const IN_SIDE_QUERY: QuerySpec = { group: 'in_area_code', filters: { out_area_code: REGION } }
export const OUT_SIDE_QUERY: QuerySpec = { group: 'out_area_code', filters: { in_area_code: REGION } }
