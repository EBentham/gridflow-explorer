/**
 * The areas this family's rows name, by the EIC codes ENTSO-E puts on them,
 * and how the page reads one in area at a time.
 *
 * - Names are gridflow's own (`connectors/entsoe/area_codes.py`); a code
 *   outside that list shows as the code itself, never a guessed name.
 * - A border is named by its in area, then its out area, with an en dash and
 *   no arrow: which way the power moves in the direction held isn't
 *   confirmed, so the page never calls it an import or an export.
 * - Colours follow the area: an out area, or a zone, keeps its token on every
 *   view of the page. The dataset read beside a border, and the two sides of
 *   a net position, take colours no area uses.
 */
import type { GroupSpec, QuerySpec } from '../../define'

export const GB = '10YGB----------A'
export const FR = '10YFR-RTE------C'
export const NL = '10YNL----------L'
export const BE = '10YBE----------2'
export const DE_LU = '10Y1001A1001A82H'
export const IE_SEM = '10Y1001A1001A59C'

/** The placeholder ENTSO-E puts opposite each zone in the net positions: it names no area. */
export const REGION = 'REGION_CODE-----'

interface Area {
  code: string
  name: string
  /** In a border's name: `GB–France`. */
  short: string
  color: string
}

/** In the order the page draws them: GB's neighbours first, largest border first. */
const AREAS: Area[] = [
  { code: FR, name: 'France', short: 'France', color: 'var(--chart-price)' },
  { code: NL, name: 'Netherlands', short: 'Netherlands', color: 'var(--chart-price-2)' },
  { code: BE, name: 'Belgium', short: 'Belgium', color: 'var(--fuel-wind)' },
  { code: IE_SEM, name: 'Ireland (SEM)', short: 'Ireland (SEM)', color: 'var(--fuel-biomass)' },
  { code: DE_LU, name: 'Germany / Luxembourg', short: 'Germany/Luxembourg', color: 'var(--fuel-peaking)' },
  { code: GB, name: 'Great Britain', short: 'GB', color: 'var(--fuel-other)' },
]

/** Labels and colours for the split column's values, in drawing order. */
export const AREA_GROUPS: GroupSpec[] = AREAS.map((a) => ({ value: a.code, label: a.name, color: a.color }))

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

const areaOf = (code: string | null | undefined) => AREAS.find((a) => a.code === code)

/** `France`; the code itself for an area gridflow doesn't name. */
export const areaName = (code: string | null | undefined): string => areaOf(code)?.name ?? code ?? 'an unnamed area'

/** `the Netherlands`: an area's name as it reads inside a sentence. */
export const areaPhrase = (code: string | null | undefined): string => (code === NL ? 'the Netherlands' : areaName(code))

/** Whether gridflow names the area, so a code can be shown beside its name. */
export const isNamed = (code: string): boolean => areaOf(code) !== undefined

/** `GB–France`: in area first, then out area, with no arrow. */
export function borderName(inArea: string | null, outArea: string): string {
  const part = (code: string | null) => areaOf(code)?.short ?? code ?? 'unknown'
  return `${part(inArea)}–${part(outArea)}`
}

export function areaColor(code: string): string {
  return areaOf(code)?.color ?? 'var(--fuel-other)'
}

/** Drawing order of an area among the page's areas; unnamed ones last. */
export function areaRank(code: string): number {
  const i = AREAS.findIndex((a) => a.code === code)
  return i < 0 ? AREAS.length : i
}

// ---------------------------------------------------------------- one in area at a time

/** The page's own URL parameter: which in area the borders are read for. */
export const IN_PARAM = 'in'

/** The in areas gridflow requests pairs from (the research card's eight pairs). */
export const IN_AREAS = [
  { param: 'gb', code: GB, label: 'GB' },
  { param: 'fr', code: FR, label: 'France' },
  { param: 'nl', code: NL, label: 'Netherlands' },
] as const

/** The in area's code for the parameter's value; GB when it is absent or unknown. */
export function inAreaCode(param: string | null): string {
  return IN_AREAS.find((a) => a.param === param)?.code ?? GB
}

/**
 * The rows endpoint splits by one column only, and a border is two (in and
 * out area): read with one in area, the rows form one series per out area.
 */
export const borderQuery = (params: URLSearchParams): QuerySpec => ({ group: 'out_area_code', filters: { in_area_code: inAreaCode(params.get(IN_PARAM)) } })

/** GB's four borders, for the dataset read beside the page's own (a related read can't follow the page's parameters). */
export const GB_QUERY: QuerySpec = { group: 'out_area_code', filters: { in_area_code: GB } }

/** Net positions with the zone named as the in area (the page's own read) and as the out area (read beside it). */
export const IN_SIDE_QUERY: QuerySpec = { group: 'in_area_code', filters: { out_area_code: REGION } }
export const OUT_SIDE_QUERY: QuerySpec = { group: 'out_area_code', filters: { in_area_code: REGION } }
