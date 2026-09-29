/**
 * The working panel: one day's five-minute readings against FUELHH, the
 * half-hourly dataset the Generation mix screen draws. For total generation,
 * or the band selected in the key, the day's readings as a line with
 * FUELHH's figure held flat across the six readings of each half-hour; how
 * closely the six readings' mean matches that figure; and the widest spread
 * of readings inside one half-hour, which a half-hourly figure can't show.
 * Then every band's figures for the day. Only half-hours with all six
 * readings held are counted.
 *
 * A window the backend reads as means has no single readings to compare,
 * and its means are grouped by stamp, five minutes off FUELHH's half-hours:
 * the panel says so rather than compare them.
 */
import { KeyList } from '../../../design/charts'
import { fmtN } from '../../../design/format'
import { FUEL_BANDS } from '../../../design/fuels'
import { HALF_HOUR, clock, halfHourWindow } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { ErrorWords } from '../../_template/panels'
import type { SeriesDef } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import { displayUnit } from '../../_template/units'
import type { PageContext } from '../../define'
import './page.css'
import { bandLines, dayName, dayRows, halfHourView, hhFolded, pairsFor, summarise, type Day, type PairSummary } from './compare'
import { AXIS_WIDTH, HH_KEY, TOTAL_FIELD, bandField, focusedBand, seriesFor } from './fuels'

const MW = displayUnit('MW', 'MW')
// The axis ink: apart from every fuel, and from the total's neutral ink in both themes (the actual-line ink sits too close to it in dark).
const HH_COLOR = 'var(--chart-axis)'
/** Total generation's readings: not a fuel, so the chart's neutral ink, which no fuel band uses. */
const TOTAL_COLOR = 'var(--chart-tick)'
/** A gap to FUELHH past this many MW is far off the few-tenths typical of these rows, and gets a note. */
const WIDE_GAP_MW = 5

function lineDef(field: string, label: string, color: string, unit: SeriesDef['unit']): SeriesDef {
  return { key: field, field, column: field, group: null, label, color, unit, from: 'self', count: 0, mean: null, min: null, max: null, signed: false }
}

const mw = (gw: number, unit: SeriesDef['unit']) => gw / unit.factor

/** What the summary says of one series' day, in sentences. */
function summaryText(name: string, s: PairSummary, day: Day, unit: SeriesDef['unit'], hhHeld: boolean, wideFuels: number): string[] {
  const out: string[] = []
  out.push(`All six readings are held for ${s.whole} of ${dayName(day)}’s half-hours.`)
  if (hhHeld && s.matched > 0 && s.gap && s.typical !== null) {
    out.push(
      `In the ${s.matched} of those FUELHH holds too, the mean of the six sits a median ${fmtN(mw(s.typical, unit), 1)} MW from FUELHH’s figure; the largest gap is ${fmtN(mw(s.gap.v, unit), 1)} MW, in ${halfHourWindow(s.gap.t)}.`,
    )
    if (Math.abs(mw(s.gap.v, unit)) > WIDE_GAP_MW) {
      const also = wideFuels > 1 ? `, and ${wideFuels} of the nine fuels differ by more than ${WIDE_GAP_MW} MW in that half-hour too` : ''
      out.push(`That half-hour is far off the median${also}. Why the two datasets differ there is not known.`)
    }
  } else if (hhHeld) {
    out.push('FUELHH holds none of those half-hours, so there is nothing to set them against.')
  }
  if (s.move && s.move.hi.v !== s.move.lo.v) {
    const { lo, hi } = s.move
    const [a, b] = lo.t < hi.t ? [lo, hi] : [hi, lo]
    out.push(
      `${name}’s widest spread inside one half-hour was ${MW.format(mw(hi.v - lo.v, unit))}, in ${halfHourWindow(s.move.t)}: from ${unit.format(a.v)} stamped ${clock(a.t)} to ${unit.format(b.v)} stamped ${clock(b.t)}. A half-hourly figure shows only the mean.`,
    )
  }
  return out
}

export function HalfHour({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  if (!model || ctx.state === 'empty' || !ctx.window) return <p className="gf-hint">No reading is held in this window, so there is no half-hour to compare.</p>
  if (model.bucketed) {
    return (
      <p className="gf-hint">
        This window is read as {model.stepMs ? meansText(model.stepMs) : 'means'} of the readings, not the readings themselves, so there are none to set against FUELHH. The backend groups those means by
        stamp, five minutes off FUELHH’s half-hours, so they aren’t compared either. Choose a window of a week or less to read every reading.
      </p>
    )
  }
  const view = halfHourView(ctx)
  if (!view) return <p className="gf-hint">No reading is held in this window, so there is no half-hour to compare.</p>
  const { folded, day } = view
  const rel = ctx.related[HH_KEY]
  const hh = hhFolded(ctx)
  const band = focusedBand(ctx.focus)
  const def = seriesFor(folded, band?.key)
  const field = band ? bandField(band.key) : TOTAL_FIELD
  const name = def.label
  const color = band ? def.color : TOTAL_COLOR
  const unit = folded.unit
  const pairs = pairsFor(folded, hh, field, day.start, day.end)
  const summary = summarise(pairs)
  const lines = bandLines(folded, hh, day)
  // How many fuels are also far off FUELHH in the selected series' widest-gap half-hour: a note, not a cause.
  const gapT = summary.gap?.t
  const wideFuels =
    gapT === undefined
      ? 0
      : FUEL_BANDS.filter((b) => {
          const p = pairsFor(folded, hh, bandField(b.key), gapT, gapT + HALF_HOUR)[0]
          return p?.hh != null && Math.abs(mw(p.mean - p.hh, unit)) > WIDE_GAP_MW
        }).length
  const hhFailed = rel && (rel.state === 'error' || rel.state === 'refreshing')

  return (
    <>
      <SeriesChart
        panels={[
          {
            rows: dayRows(folded, hh, field, day),
            series: [lineDef('reading', `${name}, each reading`, color, unit), ...(hh ? [lineDef('hh', `${name}, FUELHH half-hour`, HH_COLOR, unit)] : [])],
            mark: 'line',
            unit,
            stepMs: null,
            height: 300,
            zero: band?.key === 'imports' || band?.key === 'pumped_storage',
            axisWidth: AXIS_WIDTH,
          },
        ]}
        domain={[day.start, day.end]}
        fixture={ctx.fixture}
        syncId="fuelinst-halfhour"
      />
      <KeyList
        items={[
          { key: 'reading', mark: { kind: 'line', color }, label: `${name}, each five-minute reading` },
          ...(hh ? [{ key: 'hh', mark: { kind: 'line' as const, color: HH_COLOR }, label: 'FUELHH’s half-hour figure, held flat across its six readings' }] : []),
        ]}
      />
      <p className="gf-hint">
        A half-hour’s six readings are those stamped five to thirty minutes after it starts, the six Elexon puts in its settlement period. {ctx.window.start !== ctx.window.end && ctx.mode === 'chart' ? 'Click a day on the chart above to read another.' : ''}
      </p>
      {hhFailed && (
        <p className="gf-hint">
          FUELHH couldn’t be read, so only the readings are drawn. <ErrorWords error={rel.error} />
        </p>
      )}
      {!hh && !hhFailed && <p className="gf-hint">FUELHH holds no rows for this window, so only the readings are drawn.</p>}
      <p className="gf-hint">{summaryText(name, summary, day, unit, Boolean(hh), wideFuels).join(' ')}</p>
      <div className="gf-days fi-whole">
        <table>
          <thead>
            <tr>
              <th scope="col">Fuel</th>
              <th scope="col" className="is-num">
                Whole half-hours
              </th>
              <th scope="col" className="is-num">
                Widest spread inside one, MW
              </th>
              <th scope="col">In</th>
              <th scope="col" className="is-num">
                Median gap to FUELHH, MW
              </th>
              <th scope="col" className="is-num">
                Largest gap to FUELHH, MW
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const s = l.summary
              const on = l.key === 'total' ? !band : band?.key === l.key
              const spread = s.move ? mw(s.move.hi.v - s.move.lo.v, unit) : null
              return (
                <tr key={l.key} className={on ? 'is-on' : s.whole === 0 ? 'is-missing' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.setFocus(l.key === 'total' ? undefined : l.key)}>
                      {l.label}
                    </button>
                  </th>
                  <td className="is-num">{s.whole}</td>
                  <td className="is-num">{spread === null ? '–' : MW.plain(spread)}</td>
                  <td>{s.move && spread !== null ? (spread === 0 ? 'no movement' : halfHourWindow(s.move.t).replace(/^\w+ \d+ \w+, /, '')) : '–'}</td>
                  <td className="is-num">{s.typical === null ? '–' : fmtN(mw(s.typical, unit), 1)}</td>
                  <td className="is-num">{s.gap ? fmtN(mw(s.gap.v, unit), 1) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        For {dayName(day)}: the half-hours with all six readings held; the widest spread between the lowest and highest reading inside one; and, over the half-hours FUELHH also holds, the median size of the gap between the six readings’ mean and FUELHH’s figure, and the largest gap (the mean less FUELHH, signed). Select a fuel to draw it above.
      </p>
    </>
  )
}
