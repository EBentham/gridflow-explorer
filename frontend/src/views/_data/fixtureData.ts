/**
 * FIXTURE: the synthetic "Template demo" source that proves the dataset
 * page template before the rows endpoint is wired (v0.4 P0-2; P4-0 deletes
 * it with the demo page). Nothing here is read from gridflow.
 *
 * The numbers are made in the browser from fixed formulas and a seeded
 * generator, so every screenshot is the same. They are shaped to exercise
 * every honesty state a real page meets: a local depth shorter than a
 * 30-day window, a day with no rows, a day held in part, a stub latest day
 * (2 of 48 half-hours, as fuelhh's is), a short gap inside a day, values
 * below zero, a default filter that leaves rows out, and a window too big
 * to return at full detail.
 */
import { DAY_MS, HALF_HOUR, HOUR_MS, dayStart, londonMidnight, nextLondonMidnight } from '../../design/time'
import type { EventRow, ManifestDataset, ManifestSource, ReferenceRow } from '../contract'

export const FIXTURE_SOURCE_KEY = 'demo'
export const FIXTURE_FAMILY_SLUG = 'dataset-page'
/** The first and latest UK days the fixture "holds". */
export const FIXTURE_FIRST_DAY = '2026-09-08'
export const FIXTURE_LATEST_DAY = '2026-09-22'
/** When the fixture's coverage was "read". */
export const FIXTURE_READ_AT = '2026-09-26T19:30:00Z'

// ---------------------------------------------------------------- a seeded generator

/** FNV-1a: a string to a 32-bit seed. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: a small, fast, seeded generator of numbers in [0, 1). */
export function seeded(seed: string): () => number {
  let a = hash(seed)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A deterministic wobble in [-1, 1] for one series at one instant. */
const wobble = (series: string, t: number) => seeded(`${series}:${t}`)() * 2 - 1

// ---------------------------------------------------------------- series: output by plant type, and a price

const T0 = Date.UTC(2026, 8, 1)
const TAU = 2 * Math.PI

/** Hours since UK midnight. */
const ukHour = (t: number) => (t - londonMidnight(t)) / HOUR_MS

/** `YYYY-MM-DD` of the UK day holding `t` (UK noon always falls on the same UTC date). */
const dayOf = (t: number) => new Date(londonMidnight(t) + 12 * HOUR_MS).toISOString().slice(0, 10)

export const PLANT_TYPES = ['wind', 'gas', 'storage'] as const
export type PlantType = (typeof PLANT_TYPES)[number]

function wind(t: number): number {
  const d = (t - T0) / DAY_MS
  const w = 6200 + 3900 * Math.sin((TAU * d) / 5.3 + 0.7) + 1600 * Math.sin((TAU * d) / 1.9 + 2.1) + 260 * wobble('wind', t)
  return Math.min(13500, Math.max(300, w))
}

function demand(t: number): number {
  const h = ukHour(t)
  const weekday = new Date(t).getUTCDay()
  const weekend = weekday === 0 || weekday === 6 ? -2600 : 0
  return 21000 + 7000 * (0.5 - 0.5 * Math.cos((TAU * (h - 4)) / 24)) + 2200 * Math.exp(-((h - 18) ** 2) / 4) + weekend + 300 * wobble('demand', t)
}

function storage(t: number): number {
  const h = ukHour(t)
  return 1700 * Math.exp(-((h - 18.5) ** 2) / 2) - 1300 * Math.exp(-((h - 3) ** 2) / 3) - 500 * Math.exp(-((h - 13) ** 2) / 3) + 120 * wobble('storage', t)
}

function gas(t: number): number {
  return Math.min(22000, Math.max(1200, demand(t) - wind(t) - storage(t) - 8000 + 200 * wobble('gas', t)))
}

export function outputMw(plant: PlantType, t: number): number {
  const v = plant === 'wind' ? wind(t) : plant === 'gas' ? gas(t) : storage(t)
  return Math.round(v)
}

export function priceGbpMwh(t: number): number {
  const h = ukHour(t)
  if (wind(t) > 10500 && (h < 6 || (h > 12 && h < 15))) return Math.round((-8 - 18 * Math.abs(wobble('price-neg', t))) * 100) / 100
  return Math.round((55 + 5.5 * (gas(t) / 1000 - 6) + 6 * wobble('price', t)) * 100) / 100
}

const inDepth = (t: number) => t >= dayStart(FIXTURE_FIRST_DAY) && t < nextLondonMidnight(dayStart(FIXTURE_LATEST_DAY))

/**
 * Whether the fixture "holds" a half-hour. Output: 17 Sep is missing, 12 Sep
 * stops at 20:00, and the latest day is a stub of two half-hours. Price: a
 * three-hour hole on 19 Sep, and the same stub.
 */
export function isHeld(dataset: 'demo_output' | 'demo_price', t: number): boolean {
  if (!inDepth(t)) return false
  const day = londonMidnight(t)
  if (day === dayStart(FIXTURE_LATEST_DAY)) return t < day + 2 * HALF_HOUR
  if (dataset === 'demo_output') {
    if (day === dayStart('2026-09-17')) return false
    if (day === dayStart('2026-09-12')) return t < day + 20 * HOUR_MS
    return true
  }
  if (day === dayStart('2026-09-19')) return t < day + 12 * HOUR_MS || t >= day + 15 * HOUR_MS
  return true
}

// ---------------------------------------------------------------- reference: a unit register

const FUELS: { fuel: string; code: string; n: number; min: number; max: number }[] = [
  { fuel: 'Wind', code: 'WND', n: 12, min: 50, max: 650 },
  { fuel: 'Gas', code: 'GAS', n: 8, min: 400, max: 1400 },
  { fuel: 'Storage', code: 'STO', n: 6, min: 50, max: 400 },
  { fuel: 'Solar', code: 'SOL', n: 5, min: 20, max: 80 },
  { fuel: 'Biomass', code: 'BIO', n: 3, min: 150, max: 650 },
  { fuel: 'Nuclear', code: 'NUC', n: 2, min: 1100, max: 1600 },
]
const COMPANIES = ['Demo Power', 'Example Energy', 'Sample Generation', 'Placeholder Renewables']
const REGIONS = ['Scotland', 'North of England', 'Midlands', 'Wales', 'South West', 'South East']

export const UNITS: ReferenceRow[] = FUELS.flatMap(({ fuel, code, n, min, max }) =>
  Array.from({ length: n }, (_, i) => {
    const r = seeded(`unit:${code}:${i}`)
    const id = `DMO-${code}-${String(i + 1).padStart(2, '0')}`
    return {
      unit_id: id,
      name: `Demo ${fuel.toLowerCase()} unit ${i + 1}`,
      fuel,
      capacity_mw: Math.round(min + (max - min) * r()),
      company: COMPANIES[Math.floor(r() * COMPANIES.length)],
      region: REGIONS[Math.floor(r() * REGIONS.length)],
    }
  }),
)

export const UNITS_LAST_WRITTEN = '2026-09-21T05:12:00Z'

// ---------------------------------------------------------------- events: outage notices

const iso = (ms: number) => new Date(ms).toISOString().replace('.000Z', 'Z')

/** Notices published 9–22 Sep (two on the stub day), newest first; 15% are for another area. */
export const NOTICES: EventRow[] = (() => {
  const out: EventRow[] = []
  for (let day = dayStart('2026-09-09'); day <= dayStart(FIXTURE_LATEST_DAY); day = nextLondonMidnight(day)) {
    const r = seeded(`notices:${day}`)
    const stub = day === dayStart(FIXTURE_LATEST_DAY)
    const n = stub ? 2 : 6 + Math.floor(r() * 12)
    for (let i = 0; i < n; i += 1) {
      const unit = UNITS[Math.floor(r() * UNITS.length)]
      const published = day + Math.floor(r() * (stub ? 1 : 24) * 60) * 60 * 1000
      const starts = Math.ceil((published + r() * 8 * DAY_MS) / HALF_HOUR) * HALF_HOUR
      const open = r() < 0.1
      const ends = open ? null : starts + Math.ceil((2 * HOUR_MS + r() * 4 * DAY_MS) / HALF_HOUR) * HALF_HOUR
      const s = r()
      const capacity = Number(unit.capacity_mw)
      out.push({
        ts: published,
        notice_id: `DMO-N-${dayOf(day).slice(2).replace(/-/g, '')}-${String(i + 1).padStart(2, '0')}`,
        unit_id: unit.unit_id,
        fuel: unit.fuel,
        event_type: r() < 0.7 ? 'Planned' : 'Forced',
        status: s < 0.75 ? 'Active' : s < 0.9 ? 'Cancelled' : 'Dismissed',
        unavailable_mw: Math.round(capacity * (0.2 + 0.8 * r())),
        starts_at: iso(starts),
        ends_at: ends === null ? null : iso(ends),
        area: r() < 0.85 ? 'GB' : 'IE',
      })
    }
  }
  return out.sort((a, b) => b.ts - a.ts)
})()

// ---------------------------------------------------------------- the manifest

function seriesCoverage(dataset: 'demo_output' | 'demo_price', groups: number) {
  let rows = 0
  const days = new Set<string>()
  for (let t = dayStart(FIXTURE_FIRST_DAY); t < nextLondonMidnight(dayStart(FIXTURE_LATEST_DAY)); t += HALF_HOUR) {
    if (!isHeld(dataset, t)) continue
    rows += groups
    days.add(dayOf(t))
  }
  return { rows, first_day: FIXTURE_FIRST_DAY, last_day: FIXTURE_LATEST_DAY, day_count: days.size, latest_local_day: FIXTURE_LATEST_DAY }
}

function datasets(): ManifestDataset[] {
  const noteless = { notes: [], volume_class: 'small' as const, default_filter: null, schedule: 'hourly' }
  const halfHourly = { column: 'timestamp_utc', grain: '30min', settlement_cols: [] }
  const noticeDays = new Set(NOTICES.map((n) => dayOf(n.ts)))
  return [
    {
      ...noteless,
      id: 'demo_output',
      kind: 'series',
      verdict: 'chart',
      clock: halfHourly,
      latest_day_rule: { mode: 'max', column: 'timestamp_utc' },
      values: [{ column: 'output_mw', unit: 'MW', label: 'synthetic output per half-hour by plant type' }],
      dims: [{ column: 'plant_type', role: 'series', cardinality: 3 }],
      held: true,
      relation: 'fixture_demo_output',
      not_held_cause: null,
      coverage: seriesCoverage('demo_output', PLANT_TYPES.length),
    },
    {
      ...noteless,
      id: 'demo_price',
      kind: 'series',
      verdict: 'chart',
      clock: halfHourly,
      latest_day_rule: { mode: 'max', column: 'timestamp_utc' },
      values: [{ column: 'price_gbp_mwh', unit: 'GBP/MWh', label: 'synthetic price per half-hour' }],
      dims: [],
      held: true,
      relation: 'fixture_demo_price',
      not_held_cause: null,
      coverage: seriesCoverage('demo_price', 1),
    },
    {
      ...noteless,
      id: 'demo_notices',
      kind: 'events',
      verdict: 'events-table',
      schedule: 'daily',
      clock: { column: 'published_at', grain: 'event', settlement_cols: [] },
      latest_day_rule: { mode: 'max', column: 'published_at' },
      values: [{ column: 'unavailable_mw', unit: 'MW', label: 'synthetic unavailable capacity' }],
      dims: [
        { column: 'area', role: 'filter', cardinality: 2 },
        { column: 'status', role: 'filter', cardinality: 3 },
      ],
      default_filter: { column: 'area', equals: 'GB' },
      held: true,
      relation: 'fixture_demo_notices',
      not_held_cause: null,
      coverage: { rows: NOTICES.filter((n) => n.area === 'GB').length, first_day: '2026-09-09', last_day: FIXTURE_LATEST_DAY, day_count: noticeDays.size, latest_local_day: FIXTURE_LATEST_DAY },
    },
    {
      ...noteless,
      id: 'demo_units',
      kind: 'reference',
      verdict: 'reference-table',
      schedule: 'weekly',
      clock: { column: null, grain: 'snapshot', settlement_cols: [] },
      latest_day_rule: { mode: 'reference', column: null },
      values: [{ column: 'capacity_mw', unit: 'MW', label: 'synthetic registered capacity' }],
      dims: [{ column: 'fuel', role: 'filter', cardinality: FUELS.length }],
      held: true,
      relation: 'fixture_demo_units',
      not_held_cause: null,
      coverage: { rows: UNITS.length, first_day: null, last_day: null, day_count: null, latest_local_day: null, last_ingested: UNITS_LAST_WRITTEN },
    },
    {
      ...noteless,
      id: 'demo_forecast',
      kind: 'series',
      verdict: 'not-held',
      clock: null,
      latest_day_rule: { mode: 'unknown', column: null },
      values: [{ column: 'forecast_mw', unit: 'MW', label: 'a forecast the fixture never made' }],
      dims: [],
      held: false,
      relation: null,
      not_held_cause: 'never-fetched: the fixture has no forecast',
      coverage: null,
    },
  ]
}

export function fixtureSource(): ManifestSource {
  return {
    key: FIXTURE_SOURCE_KEY,
    name: 'Template demo',
    domain: 'Electricity',
    layer: 'silver',
    host: 'made in the browser',
    blurb: 'Synthetic datasets that exercise the dataset page template. Nothing here is read from gridflow.',
    families: [
      {
        slug: FIXTURE_FAMILY_SLUG,
        label: 'Dataset page demo',
        kind: 'series',
        page: 'build',
        route: `/sources/${FIXTURE_SOURCE_KEY}/${FIXTURE_FAMILY_SLUG}`,
        notes: [],
        datasets: datasets(),
      },
    ],
  }
}
