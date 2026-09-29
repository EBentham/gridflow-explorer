/**
 * The areas this family's rows name, by the EIC codes ENTSO-E puts on them,
 * and how the page reads one in area at a time.
 *
 * - Names are gridflow's own (`connectors/entsoe/area_codes.py`), as on the
 *   flows page; a code outside that list shows as the code itself, never a
 *   guessed name.
 * - A border is named by its in area, then its out area, with an en dash and
 *   no arrow: which way the capacity runs in the direction held isn't
 *   confirmed, so the page never calls it an import or an export capacity.
 * - The in areas each dataset offers are those it holds rows for, so the
 *   control never offers a read that comes back empty.
 */
import type { QuerySpec } from '../../define'

export const GB = '10YGB----------A'
export const FR = '10YFR-RTE------C'
export const NL = '10YNL----------L'
export const BE = '10YBE----------2'
export const DE_LU = '10Y1001A1001A82H'
export const IE_SEM = '10Y1001A1001A59C'

interface Area {
  code: string
  name: string
  /** In a border's name: `GB–France`. */
  short: string
}

/** In the order the page draws them: GB's neighbours first, largest border first. */
const AREAS: Area[] = [
  { code: FR, name: 'France', short: 'France' },
  { code: NL, name: 'Netherlands', short: 'Netherlands' },
  { code: BE, name: 'Belgium', short: 'Belgium' },
  { code: IE_SEM, name: 'Ireland (SEM)', short: 'Ireland (SEM)' },
  { code: DE_LU, name: 'Germany / Luxembourg', short: 'Germany/Luxembourg' },
  { code: GB, name: 'Great Britain', short: 'GB' },
]

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

/** Drawing order of an area among the page's areas; unnamed ones last. */
export function areaRank(code: string): number {
  const i = AREAS.findIndex((a) => a.code === code)
  return i < 0 ? AREAS.length : i
}

// ---------------------------------------------------------------- one in area at a time

/** The page's own URL parameter: which in area the borders are read for. */
export const IN_PARAM = 'in'

export interface InArea {
  param: string
  code: string
  label: string
}

const IN_GB: InArea = { param: 'gb', code: GB, label: 'GB' }
const IN_FR: InArea = { param: 'fr', code: FR, label: 'France' }
const IN_NL: InArea = { param: 'nl', code: NL, label: 'Netherlands' }

/**
 * The in areas each dataset holds rows for (the research card's pairs, read
 * back from the local rows): net transfer capacity GB and the Netherlands,
 * nominated GB and France, allocated all three, the DC link limits GB only.
 */
export const IN_AREAS: Record<string, InArea[]> = {
  net_transfer_capacity: [IN_GB, IN_NL],
  total_capacity_allocated: [IN_GB, IN_FR, IN_NL],
  total_nominated_capacity: [IN_GB, IN_FR],
  dc_link_intraday_transfer_limits: [IN_GB],
}

/** The in area's code for the parameter's value; GB when it is absent, unknown or not held for this dataset. */
export function inAreaCode(dataset: string, param: string | null): string {
  return (IN_AREAS[dataset] ?? []).find((a) => a.param === param)?.code ?? GB
}

/**
 * The rows endpoint splits by one column only, and a border is two (in and
 * out area): read with one in area, the rows form one series per out area.
 */
export const borderQuery =
  (dataset: string) =>
  (params: URLSearchParams): QuerySpec => ({ group: 'out_area_code', filters: { in_area_code: inAreaCode(dataset, params.get(IN_PARAM)) } })

/** GB's borders, for a dataset read beside the page's own (a related read can't follow the page's parameters). */
export const GB_QUERY: QuerySpec = { group: 'out_area_code', filters: { in_area_code: GB } }
