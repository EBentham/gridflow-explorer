/**
 * The key: the template's own series key (each city's line with its latest
 * temperature; select one to draw it alone), then the window across all
 * seven cities: the coldest and warmest reading and where, the mean, and the
 * mean heating and cooling degrees. Every figure is read from the rows
 * (`ctx.series`); the means are unweighted over the city-hours held, and
 * the panel says so.
 */
import { SeriesKey } from '../../_template/panels'
import { periodName } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { CDD, HDD, TEMP, citySeries, cityStepsText, spreadOf } from './figures'

export function WeatherKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const temps = citySeries(model, TEMP)
  if (!model || !temps.length) return <SeriesKey ctx={ctx} />
  const temp = spreadOf(model.rows, temps)
  const hdd = spreadOf(model.rows, citySeries(model, HDD))
  const cdd = spreadOf(model.rows, citySeries(model, CDD))
  const unit = temps[0].unit
  const kUnit = citySeries(model, HDD)[0]?.unit
  const when = (t: number) => periodName(t, model.stepMs, null)
  return (
    <>
      <SeriesKey ctx={ctx} />
      {temp.held > 0 && temp.mean !== null && (
        <>
          <dl className="gf-stats">
            {temp.low && (
              <div>
                <dt>Coldest</dt>
                <dd>
                  {unit.format(temp.low.v)}
                  <span className="gf-stat-when">
                    {temp.low.city}, {when(temp.low.t)}
                  </span>
                </dd>
              </div>
            )}
            {temp.high && (
              <div>
                <dt>Warmest</dt>
                <dd>
                  {unit.format(temp.high.v)}
                  <span className="gf-stat-when">
                    {temp.high.city}, {when(temp.high.t)}
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt>Mean</dt>
              <dd>{unit.format(temp.mean)}</dd>
            </div>
            {kUnit && hdd.mean !== null && (
              <div>
                <dt>Heating degrees</dt>
                <dd>{kUnit.format(hdd.mean)}</dd>
              </div>
            )}
            {kUnit && cdd.mean !== null && (
              <div>
                <dt>Cooling degrees</dt>
                <dd>{kUnit.format(cdd.mean)}</dd>
              </div>
            )}
          </dl>
          <p className="gf-hint">
            Across the seven cities, over the {cityStepsText(temp.held, model)} held in {ctx.windowText}. The means weight every city alike, not by population or demand. Heating degrees are how far a reading sits below 15.5 °C, cooling degrees how far above 22 °C, as gridflow works them out; their mean over a whole day is that
            day&rsquo;s degree-days.
          </p>
        </>
      )}
    </>
  )
}
