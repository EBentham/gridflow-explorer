/**
 * The working panel. In the Chart view, three charts on the main chart's
 * clock and value-axis width: the forecast and the wind output GB metered in
 * the same hour on one axis; metered less forecast as bars; and how many
 * hours before the hour each hour's issue was made (below zero, after it),
 * which shows where the line passes from one issue to the next. Then each UK
 * day: the hours held, the issues drawn, the forecast's mean, the metered
 * mean, and metered less forecast over the hours both hold. A step either
 * side lacks is a gap, never a zero.
 */
import { KeyList, type KeyItem } from '../../../design/charts'
import { plural } from '../../../design/format'
import { clock, dayLabel, dayTick, stepNoun, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import { periodName, type SeriesDef } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, COLORS, FORECAST, LEAD_UNIT, METERED, METERED_KEY, MW_UNIT, byDay, issuesByHour, joinMetered, seriesOf, signedMw, type DayRow } from './figures'

const dash = '–'

function def(base: SeriesDef, key: string, label: string, color: string, unit = base.unit): SeriesDef {
  return { ...base, key, field: key, label, color, from: key, unit }
}

/** `Wed 23, 00:30`: an issue time, short enough for a table cell. */
const issueShort = (t: number) => `${dayTick(t)}, ${clock(t)}`

function IssueCells({ d }: { d: DayRow }) {
  if (!d.issues.length) {
    return (
      <>
        <td>{dash}</td>
        <td>{dash}</td>
      </>
    )
  }
  const lead = d.ahead === 0 ? 'all after' : d.ahead === d.held ? 'all before' : `${d.ahead} before, ${d.held - d.ahead} after`
  return (
    <>
      <td>
        {d.issues.map((t, i) => (
          <span key={t}>
            {i > 0 && <br />}
            {issueShort(t)}
          </span>
        ))}
      </td>
      <td>{lead}</td>
    </>
  )
}

export function MeteredPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const own = seriesOf(model, FORECAST)
  if (!model || !ctx.window || !own || !own.count) {
    return <p className="gf-hint">No forecast is held in this window, so there is no metered output to set it against and no day to summarise.</p>
  }
  const rel = ctx.related[METERED_KEY]
  const mModel = rel?.series ?? null
  const mDef = seriesOf(mModel, METERED)
  const issues = issuesByHour(ctx.response)
  const join = joinMetered(model, own, mModel, mDef, issues)
  const days = byDay(model, own, mModel, mDef, join, issues, ctx.window)
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)
  const mNoun = mModel ? (mModel.bucketed && mModel.stepMs ? meansText(mModel.stepMs) : stepNoun(mModel.stepMs)) : ''
  const unit = own.unit
  const relFailed = rel && (rel.state === 'error' || rel.state === 'refreshing')
  const hasMetered = Boolean(mDef && mDef.count > 0 && join.comparable)
  const hasLead = issues.size > 0
  const common = { rows: join.rows, stepMs: model.stepMs, bucketed: model.bucketed, settlement: model.settlement, axisWidth: AXIS_WIDTH }

  const panels: ChartPanel[] = [
    {
      ...common,
      series: [def(own, 'f', own.label, own.color), ...(hasMetered ? [def(own, 'm', 'Metered wind output', COLORS.metered)] : [])],
      mark: 'line',
      unit,
      height: 220,
    },
  ]
  if (hasMetered && join.all.count > 0) {
    panels.push({ ...common, series: [def(own, 'e', 'Metered less forecast', COLORS.difference, MW_UNIT)], mark: 'bars', unit: MW_UNIT, height: 130, zero: true })
  }
  if (hasLead) {
    panels.push({ ...common, series: [def(own, 'l', 'Issued before the hour', COLORS.lead, LEAD_UNIT)], mark: 'bars', unit: LEAD_UNIT, height: 130, zero: true })
  }
  const items: KeyItem[] = [
    { key: 'f', mark: { kind: 'line', color: own.color, dashed: ctx.fixture }, label: `${own.label}, ${unit.label}` },
    ...(hasMetered ? [{ key: 'm', mark: { kind: 'line' as const, color: COLORS.metered, dashed: ctx.fixture }, label: `Metered wind output, mean of each hour’s half-hours, ${unit.label}` }] : []),
    ...(hasMetered && join.all.count > 0 ? [{ key: 'e', mark: { kind: 'bars' as const, color: COLORS.difference, shape: 'rise' as const }, label: 'Metered less forecast, MW, second chart' }] : []),
    ...(hasLead ? [{ key: 'l', mark: { kind: 'bars' as const, color: COLORS.lead, shape: 'rise' as const }, label: 'Hours the issue drawn was made before the hour; below zero, after it; lowest chart' }] : []),
  ]

  // A long window opening on days not fetched shows them as one row, so the held days aren't below the fold.
  const firstHeld = days.findIndex((d) => d.held > 0)
  const lead = firstHeld === -1 ? 0 : firstHeld
  const shown = lead >= 2 ? days.slice(lead) : days
  const cols = hasMetered ? 8 : 5
  const gw = (v: number | null) => (v === null ? dash : unit.plain(v))
  const count = (held: number, expected: number | null) => (expected !== null && held < expected ? `${held} of ${expected}` : String(held))
  const meteredTo = join.meteredTo !== null && mModel ? periodName(join.meteredTo, mModel.stepMs, mModel.settlement) : null
  const lastForecast = [...join.rows].reverse().find((r) => typeof r.f === 'number')?.t ?? null

  return (
    <>
      {ctx.mode === 'chart' && (
        <>
          <KeyList items={items} />
          <SeriesChart panels={panels} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
        </>
      )}
      {(join.above || join.below) && (
        <p className="gf-hint">
          {join.above ? `Metered output ran furthest above the forecast at ${periodName(join.above.t, model.stepMs, model.settlement)}, by ${signedMw(join.above.v)} MW` : ''}
          {join.above && join.below ? '; ' : ''}
          {join.below ? `${join.above ? 'furthest' : 'Metered output ran furthest'} below it at ${periodName(join.below.t, model.stepMs, model.settlement)}, by ${signedMw(join.below.v)} MW` : ''}.
        </p>
      )}
      {hasMetered && meteredTo && lastForecast !== null && join.meteredTo !== null && join.meteredTo < lastForecast && (
        <p className="gf-hint">Metered wind output is held locally to {meteredTo}; the forecast runs on past it, so the hours after it have no metered figure to set against.</p>
      )}
      {relFailed && (
        <p className="gf-hint">
          The metered wind output could not be read beside it, so there is nothing to set the forecast against: <ErrorWords error={rel.error} />
        </p>
      )}
      {!relFailed && mDef && mDef.count > 0 && !join.comparable && <p className="gf-hint">The metered output comes back on a coarser clock than the forecast in this window, so the two are not set against each other. Choose a shorter window.</p>}
      {!relFailed && rel && (rel.state === 'empty' || (mDef && mDef.count === 0)) && <p className="gf-hint">No metered wind output is held locally in this window, so the forecast is drawn alone.</p>}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Hours
              </th>
              <th scope="col">Issued</th>
              <th scope="col">Before or after</th>
              <th scope="col" className="is-num">
                Forecast mean, {unit.label}
              </th>
              {hasMetered && (
                <>
                  <th scope="col" className="is-num">
                    Metered mean, {unit.label}
                  </th>
                  <th scope="col" className="is-num">
                    Metered less forecast, MW
                  </th>
                  <th scope="col" className="is-num">
                    Absolute, MW
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lead >= 2 && (
              <tr className="is-missing">
                <th scope="row">
                  {dayLabel(days[0].start)} – {dayLabel(days[lead - 1].start)}
                </th>
                <td className="is-num">0</td>
                <td colSpan={cols - 2}>not held locally, {plural(lead, 'day', 'days')}</td>
              </tr>
            )}
            {shown.map((d) => {
              if (d.held === 0) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={cols - 2}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.held < d.expected
              const mPartial = d.mExpected !== null && d.mHeld > 0 && d.mHeld < d.mExpected
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{count(d.held, d.expected)}</td>
                  <IssueCells d={d} />
                  <td className="is-num">{gw(d.forecastMean)}</td>
                  {hasMetered && (
                    <>
                      <td className="is-num">
                        {d.mHeld === 0 ? 'not held' : gw(d.meteredMean)}
                        {mPartial ? `, over ${count(d.mHeld, d.mExpected)}` : ''}
                      </td>
                      <td className="is-num">{d.diff.count ? signedMw(d.diff.sum / d.diff.count) : dash}</td>
                      <td className="is-num">{d.diff.count ? MW_UNIT.plain(d.diff.sumAbs / d.diff.count) : dash}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {shown.length > 5 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        Hours counts the {noun} of forecast held, and a mean over a day held in part is a mean of that part. Issued names each issue drawn that day on the UK clock, and whether it was made before or after the hours it gives.
        {hasMetered
          ? ` The metered mean is over the ${mNoun} of wind output held that day; where it holds only some, the cell says over how many. Metered less forecast is the mean over the hours both hold of each hour’s metered mean less its forecast, and Absolute the mean of its size; a dash where they hold none in common. Above zero, more wind was metered than forecast.`
          : ''}
        {model.bucketed ? ` This window is read as ${noun}, so the differences are between means.` : ''}
        {ctx.mode === 'chart' ? ' Select a day to mark it on every chart.' : ' Select a day to mark it.'}
      </p>
    </>
  )
}
