/**
 * Elexon's fuel codes as this page draws them. The chart folds the twenty
 * codes into the Generation mix screen's nine bands (`design/fuels.ts`), as
 * that screen's backend folds FUELHH: OCGT, coal and oil into peaking, every
 * `INT…` interconnector into net imports, and a code it doesn't know into
 * other. Colour follows the band, never a series' place. The key and the
 * table itemise the codes, so nothing folded is hidden.
 *
 * A band's value at a time is the sum of its codes held there; it is null
 * only when none of them is held, so a missing reading is never read as zero.
 */
import { FUEL_BANDS, fuelVar } from '../../../design/fuels'
import type { SeriesDef, SeriesModel, WideRow } from '../../_template/seriesModel'
import type { DisplayUnit } from '../../_template/units'
import type { GroupSpec } from '../../define'

export const VALUE = 'generation_mw'
export const FUEL_TYPE = 'fuel_type'

/** The half-hourly sibling, read beside the page. */
export const HH_KEY = 'hh'
export const HH_DATASET = 'fuelhh'

/** Both charts' value axes take this width, so their clocks line up. */
export const AXIS_WIDTH = 44

/** Five minutes: the readings' step, and the gap between a reading's start and its stamp. */
export const FIVE_MIN = 5 * 60 * 1000

/** Elexon's non-interconnector codes, bottom of the stack first, with the band each folds into. */
const CODES: { code: string; label: string; band: string }[] = [
  { code: 'NUCLEAR', label: 'Nuclear', band: 'nuclear' },
  { code: 'NPSHYD', label: 'Hydro', band: 'hydro' },
  { code: 'BIOMASS', label: 'Biomass', band: 'biomass' },
  { code: 'WIND', label: 'Wind', band: 'wind' },
  { code: 'CCGT', label: 'Gas (CCGT)', band: 'gas' },
  { code: 'OCGT', label: 'Gas (OCGT)', band: 'peaking' },
  { code: 'COAL', label: 'Coal', band: 'peaking' },
  { code: 'OIL', label: 'Oil', band: 'peaking' },
  { code: 'OTHER', label: 'Other', band: 'other' },
  { code: 'PS', label: 'Pumped storage', band: 'pumped_storage' },
]

const isLink = (code: string) => code.startsWith('INT')

/** The band a code folds into: `INT…` into net imports, a code the page doesn't know into other, as the Generation mix screen does. */
export function bandOf(code: string): string {
  if (isLink(code)) return 'imports'
  return CODES.find((c) => c.code === code)?.band ?? 'other'
}

/** A code's name: the fuel's, or null for an interconnector or a code the page doesn't know (shown as its code). */
export function codeLabel(code: string): string | null {
  return CODES.find((c) => c.code === code)?.label ?? null
}

/** The twenty codes a day holds, for the template: named and coloured by their band. */
export const GROUPS: GroupSpec[] = [
  ...CODES.map((c) => ({ value: c.code, label: c.label, color: fuelVar(c.band) })),
  ...['INTELEC', 'INTEW', 'INTFR', 'INTGRNL', 'INTIFA2', 'INTIRL', 'INTNED', 'INTNEM', 'INTNSL', 'INTVKL'].map((code) => ({ value: code, label: `Interconnector ${code}`, color: fuelVar('imports') })),
]

/** The codes the rows hold, in stack order: the fuels, then the interconnectors, then any code the page doesn't know. */
export function codeOrder(codes: string[]): string[] {
  const rank = (code: string) => {
    const i = CODES.findIndex((c) => c.code === code)
    return i >= 0 ? i : isLink(code) ? CODES.length : CODES.length + 1
  }
  return [...codes].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

/** Each code the model holds, with its series: `WIND` → its field in the rows. */
export function codeDefs(model: SeriesModel): Map<string, SeriesDef> {
  const out = new Map<string, SeriesDef>()
  for (const d of model.all) if (d.group !== null) out.set(d.group, d)
  return out
}

/** Codes the page doesn't know, which the chart folds into other. */
export function unknownCodes(model: SeriesModel): string[] {
  return [...codeDefs(model).keys()].filter((c) => !isLink(c) && !CODES.some((k) => k.code === c))
}

/** A band's field in the folded rows. */
export const bandField = (key: string) => `band_${key}`
/** The positive parts of every band, added up: total generation, as the Generation mix screen counts it. */
export const TOTAL_FIELD = 'band_total'
export const TOTAL_LABEL = 'Total generation'

export interface Folded {
  /** One row per time, a field per band (GW), and the total; null where no code of the band is held. */
  rows: WideRow[]
  /** The nine bands as series, bottom first, with their figures over the rows. */
  bands: SeriesDef[]
  unit: DisplayUnit
}

function stats(def: SeriesDef, rows: WideRow[]): SeriesDef {
  let count = 0
  let sum = 0
  let min: number | null = null
  let max: number | null = null
  for (const r of rows) {
    const v = r[def.field]
    if (typeof v !== 'number') continue
    count += 1
    sum += v
    min = min === null ? v : Math.min(min, v)
    max = max === null ? v : Math.max(max, v)
  }
  return { ...def, count, mean: count ? sum / count : null, min, max, signed: (min ?? 0) < 0 }
}

// Every panel and source line folds the same model; fold it once.
const folds = new WeakMap<SeriesModel, Folded | null>()

/** Fold a model's code series into band rows, in its display unit (GW). */
export function fold(model: SeriesModel): Folded | null {
  if (!folds.has(model)) folds.set(model, foldOnce(model))
  return folds.get(model) ?? null
}

function foldOnce(model: SeriesModel): Folded | null {
  const defs = codeDefs(model)
  const first = defs.values().next().value
  if (!first) return null
  const members = new Map<string, SeriesDef[]>()
  for (const [code, d] of defs) members.set(bandOf(code), [...(members.get(bandOf(code)) ?? []), d])
  const rows = model.rows.map((r) => {
    const out: WideRow = { t: r.t }
    let total = 0
    let any = false
    for (const b of FUEL_BANDS) {
      const held = (members.get(b.key) ?? []).map((d) => r[d.field]).filter((v): v is number => typeof v === 'number')
      const v = held.length ? held.reduce((a, x) => a + x, 0) : null
      out[bandField(b.key)] = v
      if (v !== null) {
        any = true
        total += Math.max(v, 0)
      }
    }
    out[TOTAL_FIELD] = any ? total : null
    return out
  })
  const bands = FUEL_BANDS.map((b) =>
    stats(
      { key: b.key, field: bandField(b.key), column: VALUE, group: null, label: b.label, color: fuelVar(b.key), unit: first.unit, from: 'self', count: 0, mean: null, min: null, max: null, signed: false },
      rows,
    ),
  )
  return { rows, bands, unit: first.unit }
}

/** The total as a series, for the half-hour panel. */
export function totalDef(folded: Folded): SeriesDef {
  return stats({ key: 'total', field: TOTAL_FIELD, column: VALUE, group: null, label: TOTAL_LABEL, color: 'var(--chart-tick)', unit: folded.unit, from: 'self', count: 0, mean: null, min: null, max: null, signed: false }, folded.rows)
}

/** The band the key has selected (the page keeps the band key as its focus), if any. */
export const focusedBand = (focus: string | undefined) => FUEL_BANDS.find((b) => b.key === focus)

/** A band's or the total's series in the folded rows. */
export function seriesFor(folded: Folded, key: string | undefined): SeriesDef {
  return folded.bands.find((b) => b.key === key) ?? totalDef(folded)
}

/** The latest time any band holds a value at. */
export function latestRow(folded: Folded): WideRow | undefined {
  for (let i = folded.rows.length - 1; i >= 0; i -= 1) if (typeof folded.rows[i][TOTAL_FIELD] === 'number') return folded.rows[i]
  return undefined
}
