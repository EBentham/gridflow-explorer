/**
 * The figures the panels share: the types added together, and agpt set
 * against the two datasets it overlaps, FUELHH (Elexon's half-hourly
 * generation by fuel code, which the Generation mix screen draws) and agws
 * (this family's wind and solar). Both carry the same settlement day and
 * period on the same clock as agpt, so a half-hour is compared only where
 * both sides hold a figure; a side made of several types or codes is added
 * up only where every one of them is held. Nothing is filled in.
 */
import { HALF_HOUR } from '../../../design/time'
import type { SeriesDef, SeriesModel, WideRow } from '../../_template/seriesModel'
import { typeOf } from './types'

export const FUELHH_KEY = 'fuelhh'
export const FUEL_TYPE = 'fuel_type'
export const AGWS_KEY = 'agws'

export interface Sum {
  /** Every series' figure added up, at the times all of them hold one. */
  points: { t: number; v: number }[]
  /** Times at least one of them holds a figure. */
  anyHeld: number
}

/** The series added together, only where each holds a figure. */
export function sumOf(model: SeriesModel, defs: SeriesDef[]): Sum {
  const points: Sum['points'] = []
  let anyHeld = 0
  for (const r of model.rows) {
    const vs = defs.map((d) => r[d.field])
    if (vs.some((v) => typeof v === 'number')) anyHeld += 1
    if (vs.every((v) => typeof v === 'number')) points.push({ t: r.t, v: (vs as number[]).reduce((a, x) => a + x, 0) })
  }
  return { points, anyHeld }
}

export interface Pairing {
  key: string
  against: typeof FUELHH_KEY | typeof AGWS_KEY
  /** agpt's side: its `psr_type` values. */
  agpt: string[]
  /** The other side: FUELHH's `fuel_type` codes, or agws's `psr_type` values. */
  other: string[]
  /** agpt's side in words. */
  label: string
}

/** FUELHH's codes paired with agpt's types by name; agws's three types with agpt's same three. */
export const PAIRINGS: Pairing[] = [
  { key: 'fuelhh:nuclear', against: FUELHH_KEY, agpt: ['Nuclear'], other: ['NUCLEAR'], label: 'Nuclear' },
  { key: 'fuelhh:hydro', against: FUELHH_KEY, agpt: ['Hydro Run-of-river and poundage'], other: ['NPSHYD'], label: 'Hydro run-of-river and poundage' },
  { key: 'fuelhh:biomass', against: FUELHH_KEY, agpt: ['Biomass'], other: ['BIOMASS'], label: 'Biomass' },
  { key: 'fuelhh:wind', against: FUELHH_KEY, agpt: ['Wind Onshore', 'Wind Offshore'], other: ['WIND'], label: 'Wind onshore and offshore' },
  { key: 'fuelhh:gas', against: FUELHH_KEY, agpt: ['Fossil Gas'], other: ['CCGT', 'OCGT'], label: 'Fossil gas' },
  { key: 'fuelhh:coal', against: FUELHH_KEY, agpt: ['Fossil Hard coal'], other: ['COAL'], label: 'Fossil hard coal' },
  { key: 'fuelhh:oil', against: FUELHH_KEY, agpt: ['Fossil Oil'], other: ['OIL'], label: 'Fossil oil' },
  { key: 'fuelhh:other', against: FUELHH_KEY, agpt: ['Other'], other: ['OTHER'], label: 'Other' },
  { key: 'fuelhh:ps', against: FUELHH_KEY, agpt: ['Hydro Pumped Storage'], other: ['PS'], label: 'Hydro pumped storage' },
  { key: 'agws:onshore', against: AGWS_KEY, agpt: ['Wind Onshore'], other: ['Wind Onshore'], label: 'Wind onshore' },
  { key: 'agws:offshore', against: AGWS_KEY, agpt: ['Wind Offshore'], other: ['Wind Offshore'], label: 'Wind offshore' },
  { key: 'agws:solar', against: AGWS_KEY, agpt: ['Solar'], other: ['Solar'], label: 'Solar' },
]

/** The working panel's own URL parameter: the pairing it draws. */
export const PAIR_PARAM = 'pair'
export const DEFAULT_PAIR = 'fuelhh:gas'

export const pairingOf = (key: string | null) => PAIRINGS.find((p) => p.key === key) ?? (PAIRINGS.find((p) => p.key === DEFAULT_PAIR) as Pairing)

/** The pairing's colour: its agpt type's colour token (the first, for wind). */
export const pairColor = (p: Pairing) => typeOf(p.agpt[0])?.color ?? 'var(--chart-tick)'

/** A side's figures in MW by time, added up where every member holds one; null when a member isn't in the rows at all. */
function sideOf(model: SeriesModel, groups: string[]): Map<number, number> | null {
  const defs = groups.map((g) => model.all.find((d) => d.group === g))
  if (defs.some((d) => !d)) return null
  const held = defs as SeriesDef[]
  const out = new Map<number, number>()
  for (const p of sumOf(model, held).points) out.set(p.t, p.v / held[0].unit.factor)
  return out
}

export interface PairFigures {
  pairing: Pairing
  /** agpt's side and the other side, MW by time; null when a member isn't in the rows. */
  a: Map<number, number> | null
  b: Map<number, number> | null
  /** Half-hours both sides hold. */
  both: number
  /** Of those, how many hold the same figure. */
  same: number
  /** The median size of the gap (agpt less the other), MW. */
  median: number | null
  /** The largest gap, agpt less the other, sign kept, MW. */
  largest: { t: number; v: number } | null
  /** Of the half-hours both hold, those where each side is below zero. */
  belowZero: { a: number; b: number }
}

export function pairFigures(pairing: Pairing, own: SeriesModel, other: SeriesModel | null): PairFigures {
  const a = sideOf(own, pairing.agpt)
  const b = other ? sideOf(other, pairing.other) : null
  const sizes: number[] = []
  let same = 0
  let largest: PairFigures['largest'] = null
  const belowZero = { a: 0, b: 0 }
  if (a && b) {
    for (const [t, va] of a) {
      const vb = b.get(t)
      if (vb === undefined) continue
      const d = va - vb
      if (Math.abs(d) < 1e-6) same += 1
      sizes.push(Math.abs(d))
      if (!largest || Math.abs(d) > Math.abs(largest.v)) largest = { t, v: d }
      if (va < 0) belowZero.a += 1
      if (vb < 0) belowZero.b += 1
    }
  }
  sizes.sort((x, y) => x - y)
  const mid = sizes.length >> 1
  const median = sizes.length ? (sizes.length % 2 ? sizes[mid] : (sizes[mid - 1] + sizes[mid]) / 2) : null
  return { pairing, a, b, both: sizes.length, same, median, largest, belowZero }
}

/**
 * The pairing chart's rows on agpt's clock: each side in GW, and the gap in
 * MW. The other side is drawn only where agpt's is held, as the panel
 * compares the two; null where either is missing.
 */
export function pairRows(own: SeriesModel, f: PairFigures): WideRow[] {
  return own.rows.map((r) => {
    const va = f.a?.get(r.t)
    const vb = f.b?.get(r.t)
    return {
      t: r.t,
      a: va === undefined ? null : va / 1000,
      b: va === undefined || vb === undefined ? null : vb / 1000,
      gap: va === undefined || vb === undefined ? null : va - vb,
    }
  })
}

/** Whether a model's rows are half-hours as held, not means. */
export const halfHourly = (m: SeriesModel | null | undefined) => Boolean(m && !m.bucketed && m.stepMs === HALF_HOUR)

/** The types a wind-and-solar-only half-hour leaves out: every held type but these. */
const WIND_SOLAR = ['Wind Onshore', 'Wind Offshore', 'Solar']

export interface Run {
  start: number
  last: number
  n: number
}

/**
 * Runs of half-hours where every type held other than wind and solar holds
 * exactly zero. agpt holds such runs at the start of each block of days held;
 * the rows don't say why, so the page names them rather than hide or drop them.
 * None for a model with no type beyond wind and solar.
 */
export function zeroRuns(model: SeriesModel): Run[] {
  const defs = model.all.filter((d) => d.from === 'self' && d.group !== null && !WIND_SOLAR.includes(d.group) && d.count > 0)
  if (!defs.length || model.stepMs === null) return []
  const out: Run[] = []
  let run: Run | null = null
  for (const r of model.rows) {
    const vs = defs.map((d) => r[d.field])
    if (vs.every((v) => v === 0)) {
      if (run && r.t - run.last <= model.stepMs) {
        run.last = r.t
        run.n += 1
      } else {
        run = { start: r.t, last: r.t, n: 1 }
        out.push(run)
      }
    } else run = null
  }
  return out
}

/** Whether `t` falls in one of the runs. */
export const inRuns = (runs: Run[], t: number) => runs.some((r) => t >= r.start && t <= r.last)
