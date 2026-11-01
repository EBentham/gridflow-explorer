/**
 * ENTSO-E's cross-border datasets, read one in area at a time: the rows
 * endpoint splits by one column only and a border is two (an in and an out
 * area), so a page reads one in area's borders, one series per out area,
 * and keeps the in area in `?in=`. Areas are named as gridflow names them
 * (`ENTSOE_AREAS`); a code outside that list shows as the code itself. A
 * border is named in area first, then out area, with an en dash and no
 * arrow: which way the power or capacity runs in the direction held isn't
 * confirmed, so a page never calls it an import or an export.
 */
import type { QuerySpec } from '../define'
import { EIC, ENTSOE_AREAS } from './codes'

/** The value axes' width on a page of stacked border panels, so their clocks line up. */
export const BORDER_AXIS_WIDTH = 56

/** One border's panel among several; a panel drawn alone takes the full chart height. */
export const PANEL_HEIGHT = 132

/** In the order the pages draw them: GB's neighbours first, largest border first, GB last. */
const ORDER: string[] = [EIC.FR, EIC.NL, EIC.BE, EIC.IE_SEM, EIC.DE_LU, EIC.GB]

/** The shorter form an area takes in a border's name: `GB–Germany/Luxembourg`. */
const SHORT: Readonly<Record<string, string>> = { [EIC.GB]: 'GB', [EIC.DE_LU]: 'Germany/Luxembourg' }

/** `France`; the code itself for an area gridflow doesn't name. */
export const areaName = (code: string | null | undefined): string => (code ? (ENTSOE_AREAS[code] ?? code) : 'an unnamed area')

/** `the Netherlands`: an area's name as it reads inside a sentence. */
export const areaPhrase = (code: string | null | undefined): string => (code === EIC.NL ? 'the Netherlands' : areaName(code))

/** Whether gridflow names the area, so a code can be shown beside its name. */
export const isNamed = (code: string): boolean => code in ENTSOE_AREAS

/** `GB–France`: in area first, then out area, with no arrow. */
export function borderName(inArea: string | null, outArea: string): string {
  const part = (code: string | null) => (code ? (SHORT[code] ?? ENTSOE_AREAS[code] ?? code) : 'unknown')
  return `${part(inArea)}–${part(outArea)}`
}

/** Drawing order of an area among the pages' areas; unnamed ones last. */
export function areaRank(code: string): number {
  const i = ORDER.indexOf(code)
  return i < 0 ? ORDER.length : i
}

// ---------------------------------------------------------------- one in area at a time

/** The page's own URL parameter: which in area the borders are read for. */
export const IN_PARAM = 'in'

export interface InArea {
  param: string
  code: string
  label: string
}

export const IN_GB: InArea = { param: 'gb', code: EIC.GB, label: 'GB' }
export const IN_FR: InArea = { param: 'fr', code: EIC.FR, label: 'France' }
export const IN_NL: InArea = { param: 'nl', code: EIC.NL, label: 'Netherlands' }

/** The in area's code for the parameter's value; GB when it is absent, unknown or not among `areas`. */
export function inAreaCode(areas: InArea[], param: string | null): string {
  return areas.find((a) => a.param === param)?.code ?? EIC.GB
}

/** One in area's borders: one series per out area. */
export const borderQuery =
  (areas: InArea[]) =>
  (params: URLSearchParams): QuerySpec => ({ group: 'out_area_code', filters: { in_area_code: inAreaCode(areas, params.get(IN_PARAM)) } })

/** GB's borders, for a dataset read beside the page's own. */
export const GB_QUERY: QuerySpec = { group: 'out_area_code', filters: { in_area_code: EIC.GB } }
