/**
 * The long view's shortcuts, after Chart | Table: 1 year, 5 years or the
 * whole history, each ending on the latest local day, and any calendar year
 * held. They set the template's own custom window (`ctx.range.setCustom`,
 * the same `from` and `to` its date inputs write), so the page makes one
 * rows request for the span and the backend reads it as means where it is
 * long (NEEDS.md). A shortcut is on while the window is exactly its span.
 * While a window of more than a year is read, a note says it can take a
 * while: on the shared backend five years took about 50 s and the whole
 * history over two minutes, with nothing else on the page to say so.
 */
import { Segmented } from '../../../design/frame'
import { shiftDate } from '../../../design/time'
import type { DateRange } from '../../../lib/range'
import type { PageContext } from '../../define'
import { daysIn } from './periods'

interface Span {
  value: string
  label: string
  range: DateRange
}

function spans(first: string, latest: string): Span[] {
  const [y, m, d] = latest.split('-')
  const fiveBack = shiftDate(`${Number(y) - 5}-${m}-${d}`, 1)
  return [
    { value: 'year', label: '1 year', range: { start: shiftDate(latest, -364), end: latest } },
    { value: 'five', label: '5 years', range: { start: fiveBack < first ? first : fiveBack, end: latest } },
    { value: 'all', label: `Since ${first.slice(0, 4)}`, range: { start: first, end: latest } },
  ]
}

/** A calendar year's window, cut to the days held. */
function yearRange(year: number, first: string, latest: string): DateRange {
  const start = `${year}-01-01`
  const end = `${year}-12-31`
  return { start: start < first ? first : start, end: end > latest ? latest : end }
}

export function SpanControl({ ctx }: { ctx: PageContext }) {
  const first = ctx.dataset.coverage?.first_day
  const latest = ctx.dataset.coverage?.latest_local_day
  const range = ctx.range
  if (!range || !first || !latest) return null
  const w = ctx.window
  const same = (r: DateRange) => Boolean(w && w.start === r.start && w.end === r.end)
  const options = spans(first, latest)
  const on = options.find((o) => same(o.range))?.value ?? ''
  const years: number[] = []
  for (let y = Number(first.slice(0, 4)); y <= Number(latest.slice(0, 4)); y += 1) years.push(y)
  const year = years.find((y) => same(yearRange(y, first, latest)))
  return (
    <>
      <Segmented
        label="Long view"
        options={options.map(({ value, label }) => ({ value, label }))}
        value={on}
        onChange={(v) => {
          const o = options.find((x) => x.value === v)
          if (o) range.setCustom(o.range)
        }}
      />
      <label className="gf-range-custom">
        <span>Year</span>
        <select className="gf-select" value={year === undefined ? '' : String(year)} onChange={(e) => e.target.value && range.setCustom(yearRange(Number(e.target.value), first, latest))}>
          <option value="">Choose a year</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      {ctx.state === 'loading' && w && daysIn(w) > 366 && (
        <span className="gf-toolbar-note" role="status">
          Reading years of rows: this can take a minute or more.
        </span>
      )}
    </>
  )
}
