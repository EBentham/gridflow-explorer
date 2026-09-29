/**
 * What this page's panels share: the three columns of `carbon_intensity`,
 * the two lines' colours, the value-axis width that lines every chart's clock
 * up, NESO's five index grades as the page draws them, and the readings the
 * key and the working panel take from the rows.
 *
 * The grades' names come from gridflow's schema for these rows
 * (`IntensityIndex`: very low, low, moderate, high, very high). Their
 * boundaries in gCO₂/kWh are held nowhere locally, so nothing here places a
 * grade on the value axis: each half-hour carries the grade NESO published
 * with it, and that is all the page draws.
 */
import type { SeriesRow, SeriesRowsResponse } from '../../contract'
import type { SeriesDef, SeriesModel, WideRow } from '../../_template/seriesModel'
import { datesBetween, dayStart, londonMidnight } from '../../../design/time'
import type { DateRange } from '../../../lib/range'

export const FORECAST = 'forecast_gco2_kwh'
export const ACTUAL = 'actual_gco2_kwh'
export const INDEX = 'intensity_index'

/**
 * The forecast and the estimate take the demand-forecast page's pair (forecast
 * in the fan colour, what came in the actual's), so a forecast reads the same
 * across the Explorer. In light the forecast is also the carbon intensity's
 * colour on the historic generation mix page; in dark the estimate is.
 */
export const COLORS = {
  forecast: 'var(--chart-fan)',
  actual: 'var(--chart-actual)',
  miss: 'var(--fuel-other)',
  grade: 'var(--heat-hi)',
} as const

/** Every chart on the page takes this value-axis width, so their clocks line up. */
export const AXIS_WIDTH = 52

export interface Grade {
  value: string
  label: string
  /** The grade's wash: the heat ramp's darker end at this opacity, deeper for a higher grade. */
  opacity: number
}

/** NESO's five grades, lowest first, as named in gridflow's schema for these rows. */
export const GRADES: Grade[] = [
  { value: 'very low', label: 'Very low', opacity: 0.1 },
  { value: 'low', label: 'Low', opacity: 0.22 },
  { value: 'moderate', label: 'Moderate', opacity: 0.36 },
  { value: 'high', label: 'High', opacity: 0.52 },
  { value: 'very high', label: 'Very high', opacity: 0.7 },
]

export const gradeOf = (value: string): Grade | undefined => GRADES.find((g) => g.value === value)

/** A column's series in the model, when the rows hold it. */
export const seriesOf = (model: SeriesModel | null, column: string): SeriesDef | undefined => model?.all.find((d) => d.column === column)

/** Each time's published grade, from the rows as read; a missing step, or a mean, has none. */
export function gradesByTime(response: SeriesRowsResponse | null): Map<number, string> {
  const out = new Map<number, string>()
  for (const r of (response?.rows ?? []) as SeriesRow[]) {
    const v = r[INDEX]
    if (typeof v === 'string' && v !== '') out.set(r.ts, v)
  }
  return out
}

export interface GradeRun {
  value: string
  start: number
  /** The run's last half-hour's start. */
  last: number
  n: number
}

/** Runs of consecutive half-hours holding one grade; a step without one ends a run. */
export function gradeRuns(grades: Map<number, string>, stepMs: number | null): GradeRun[] {
  if (stepMs === null) return []
  const out: GradeRun[] = []
  let run: GradeRun | null = null
  for (const [t, value] of [...grades.entries()].sort((a, b) => a[0] - b[0])) {
    if (run && run.value === value && t - run.last === stepMs) {
      run.last = t
      run.n += 1
    } else {
      run = { value, start: t, last: t, n: 1 }
      out.push(run)
    }
  }
  return out
}

/** Half-hours held per grade, in grade order; grades the schema doesn't name come after, as published. */
export function gradeCounts(grades: Iterable<string>): { value: string; n: number }[] {
  const counts = new Map<string, number>()
  for (const g of grades) counts.set(g, (counts.get(g) ?? 0) + 1)
  const known = GRADES.filter((g) => counts.has(g.value)).map((g) => ({ value: g.value, n: counts.get(g.value) ?? 0 }))
  const other = [...counts.entries()].filter(([v]) => !gradeOf(v)).map(([value, n]) => ({ value, n }))
  return [...known, ...other]
}

/** Estimated actual less forecast, per time where both are held; null (a gap) where either isn't. */
export function missRows(model: SeriesModel, forecast: SeriesDef, actual: SeriesDef, field: string): WideRow[] {
  return model.rows.map((r) => {
    const f = r[forecast.field]
    const a = r[actual.field]
    return { t: r.t, [field]: typeof f === 'number' && typeof a === 'number' ? a - f : null }
  })
}

export interface DayFigures {
  day: string
  start: number
  /** Half-hours holding a forecast, an estimate, and both. */
  forecastHeld: number
  actualHeld: number
  bothHeld: number
  forecastMean: number | null
  actualMean: number | null
  /** Over the half-hours holding both. */
  missMean: number | null
  missAbsMean: number | null
  grades: Map<string, number>
}

/** Every UK day of the window, held or not, with its means and grade counts over what it holds. */
export function dayFigures(model: SeriesModel, window: DateRange, forecast: SeriesDef, actual: SeriesDef, grades: Map<number, string>): DayFigures[] {
  const byDay = new Map<number, WideRow[]>()
  for (const r of model.rows) {
    const d = londonMidnight(r.t)
    const list = byDay.get(d)
    if (list) list.push(r)
    else byDay.set(d, [r])
  }
  return datesBetween(window.start, window.end).map((day) => {
    const start = dayStart(day)
    let fN = 0
    let fSum = 0
    let aN = 0
    let aSum = 0
    let bN = 0
    let mSum = 0
    let mAbs = 0
    const g = new Map<string, number>()
    for (const r of byDay.get(start) ?? []) {
      const f = r[forecast.field]
      const a = r[actual.field]
      if (typeof f === 'number') {
        fN += 1
        fSum += f
      }
      if (typeof a === 'number') {
        aN += 1
        aSum += a
      }
      if (typeof f === 'number' && typeof a === 'number') {
        bN += 1
        mSum += a - f
        mAbs += Math.abs(a - f)
      }
      const grade = grades.get(r.t)
      if (grade) g.set(grade, (g.get(grade) ?? 0) + 1)
    }
    return {
      day,
      start,
      forecastHeld: fN,
      actualHeld: aN,
      bothHeld: bN,
      forecastMean: fN ? fSum / fN : null,
      actualMean: aN ? aSum / aN : null,
      missMean: bN ? mSum / bN : null,
      missAbsMean: bN ? mAbs / bN : null,
      grades: g,
    }
  })
}

/** A signed whole number with a true minus: `+12`, `−8`, `0`. */
export function signed(v: number): string {
  const r = Math.round(v)
  if (r === 0) return '0'
  return r > 0 ? `+${r.toLocaleString('en-GB')}` : `−${Math.abs(r).toLocaleString('en-GB')}`
}
