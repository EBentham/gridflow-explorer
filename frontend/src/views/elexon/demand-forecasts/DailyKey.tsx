/**
 * The key for the daily forecasts (`ndfd`, `tsdfd`): the line, the highest
 * and lowest delivery day in the window, the newest issue held and the days
 * it covers, how many days ahead the held figures were issued, and, over the
 * days that hold a whole day of outturn, how far the forecast sat from the
 * outturn's peak and from its mean. Which of the two the daily figure stands
 * for is not confirmed, so the key sets both beside it and names neither.
 */
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { fmtDay, instantLabel } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import type { PageContext } from '../../define'
import { GW_UNIT, NDFD, OUTTURN_KEY, dailyPair, daysAhead, deliveryDays, forecastColumn, seriesOf, signedGw } from './figures'

export function DailyKey({ ctx }: { ctx: PageContext }) {
  const own = seriesOf(ctx.series, forecastColumn(ctx.dataset.id))
  const days = deliveryDays(ctx)
  const national = ctx.dataset.id === NDFD
  const figureOf = (d: (typeof days)[number]) => (national ? d.national : d.transmission)
  const held = days.filter((d) => figureOf(d) !== null)
  if (!own || !held.length) {
    return <p className="gf-hint">No daily forecast is held for any day in this window, so there is nothing to key.</p>
  }
  const { national: nMap, transmission: tMap } = dailyPair(ctx)
  const ownMap = national ? nMap : tMap
  let high = held[0]
  let low = held[0]
  for (const d of held) {
    if ((figureOf(d)?.mw ?? 0) > (figureOf(high)?.mw ?? 0)) high = d
    if ((figureOf(d)?.mw ?? 0) < (figureOf(low)?.mw ?? 0)) low = d
  }
  const issued = held.map((d) => figureOf(d)?.issued).filter((t): t is number => typeof t === 'number')
  const newest = issued.length ? Math.max(...issued) : null
  // The newest issue's delivery days, from every day read (the window may cut it).
  const newestDates = newest === null ? [] : [...ownMap.entries()].filter(([, f]) => f.issued === newest).map(([date]) => date).sort()
  const ahead = held.flatMap((d) => {
    const f = figureOf(d)
    return f && f.issued !== null ? [daysAhead(d.date, f.issued)] : []
  })
  const gw = (mw: number) => GW_UNIT.format(mw * GW_UNIT.factor)
  const both = held.filter((d) => d.peak !== null && d.mean !== null)
  const toPeak = both.map((d) => (figureOf(d)?.mw ?? 0) * GW_UNIT.factor - (d.peak ?? 0))
  const toMean = both.map((d) => (figureOf(d)?.mw ?? 0) * GW_UNIT.factor - (d.mean ?? 0))
  const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const rel = ctx.related[OUTTURN_KEY]
  const outturnName = national ? 'national demand outturn' : 'transmission demand outturn'

  return (
    <>
      <KeyList items={[{ key: 'own', mark: { kind: 'line', color: own.color, dashed: ctx.fixture }, label: `${own.label}, GW, one figure a day` }]} />
      <dl className="gf-stats">
        <div>
          <dt>Highest day</dt>
          <dd>
            {gw(figureOf(high)?.mw ?? 0)}
            <span className="gf-stat-when">{fmtDay(high.date)}</span>
          </dd>
        </div>
        <div>
          <dt>Lowest day</dt>
          <dd>
            {gw(figureOf(low)?.mw ?? 0)}
            <span className="gf-stat-when">{fmtDay(low.date)}</span>
          </dd>
        </div>
        {newest !== null && (
          <div>
            <dt>Newest issue held</dt>
            <dd>
              {instantLabel(newest)}
              {newestDates.length > 0 && (
                <span className="gf-stat-when">
                  for {newestDates.length > 1 ? `${fmtDay(newestDates[0])} to ${fmtDay(newestDates[newestDates.length - 1])}` : fmtDay(newestDates[0])}
                </span>
              )}
            </dd>
          </div>
        )}
        {ahead.length > 0 && (
          <div>
            <dt>Issued ahead</dt>
            <dd>{Math.min(...ahead) === Math.max(...ahead) ? plural(ahead[0], 'day', 'days') : `${Math.min(...ahead)} to ${Math.max(...ahead)} days`}</dd>
          </div>
        )}
      </dl>
      <p className="gf-hint">
        {plural(held.length, 'delivery day', 'delivery days')} of {days.length} in this window hold a figure. Issued ahead counts whole UK days from the day of issue to the day forecast.
      </p>
      {both.length > 0 && (
        <>
          <dl className="gf-stats">
            <div>
              <dt>Less the outturn peak</dt>
              <dd>
                {signedGw(meanOf(toPeak))} GW
                <span className="gf-stat-when">mean over {plural(both.length, 'day', 'days')}</span>
              </dd>
            </div>
            <div>
              <dt>Less the outturn mean</dt>
              <dd>
                {signedGw(meanOf(toMean))} GW
                <span className="gf-stat-when">mean over {plural(both.length, 'day', 'days')}</span>
              </dd>
            </div>
          </dl>
          <p className="gf-hint">
            The daily figure less the highest half-hour and less the mean of {outturnName} that day, on the days holding every half-hour of it. Whether the figure is meant as a peak or a mean is not confirmed; the two lines are there to compare, not to settle it.
          </p>
        </>
      )}
      {rel && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          The outturn could not be read beside it: <ErrorWords error={rel.error} />
        </p>
      )}
      {rel && rel.state !== 'error' && rel.state !== 'refreshing' && both.length === 0 && (
        <p className="gf-hint">
          None of these days holds a whole day of {outturnName}
          {rel.dataset?.coverage?.last_day ? `, which is held to ${fmtDay(rel.dataset.coverage.last_day)}` : ''}, so there is no outturn to set the forecast beside.
        </p>
      )}
    </>
  )
}
