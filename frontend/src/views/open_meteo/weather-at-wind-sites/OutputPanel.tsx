/**
 * The reanalysis working panel. In the Chart view, one dot per hour: the
 * wind speed at 100 m (the mean of the sites, or the site picked in the key)
 * against GB wind output over the same hour, which is the shape of the
 * fleet's power curve as the weather drives it. Then each UK day: the hours
 * held, the speed's mean, lowest and highest, and GB wind output's mean over
 * the half-hours held. Select a day to mark it on the chart.
 */
import type { ReactNode } from 'react'
import { plural } from '../../../design/format'
import { HOUR_MS, dayLabel, stepNoun, stepsInDay } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { OUTPUT, OUTPUT_COLOR, OUTPUT_KEY, focusedSite, heldSites, meanByDay, outputPerStep, speedByDay, speedPoints } from './figures'
import { SpeedScatter, type Pair } from './SpeedScatter'

export function OutputPanel({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const sites = heldSites(model)
  if (!model || !ctx.window || !sites.length) {
    return <p className="gf-hint">No wind speed is held at any site in this window, so there is nothing to set against wind output or summarise by day.</p>
  }
  const site = focusedSite(ctx, model)
  const points = speedPoints(model, site)
  const unit = sites[0].unit
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : stepNoun(model.stepMs)

  const rel = ctx.related[OUTPUT_KEY]
  const out = rel?.series ?? null
  const outDef = out?.all.find((d) => d.column === OUTPUT)
  const perStep = out && outDef ? outputPerStep(out, outDef, model.stepMs) : null
  const pairs: Pair[] = perStep
    ? points.flatMap((p) => {
        const y = perStep.get(p.t)
        return y === undefined ? [] : [{ t: p.t, x: p.v, y }]
      })
    : []
  const days = speedByDay(model, ctx.window, points)
  const outDays = out && outDef ? meanByDay(out, outDef) : null
  const outNoun = out ? (out.bucketed && out.stepMs ? meansText(out.stepMs) : stepNoun(out.stepMs)) : ''
  // A day's output held in part is a mean of that part: its count says so beside it.
  const outExpected = (start: number) => (out && !(out.bucketed && out.stepMs !== null && out.stepMs > HOUR_MS) ? stepsInDay(start, out.stepMs) : null)
  const outPartial = (start: number, held: number) => {
    const e = outExpected(start)
    return e !== null && held < e
  }
  const outHeld = (start: number, held: number) => {
    const e = outExpected(start)
    return e !== null && held < e ? `${held} of ${e}` : String(held)
  }
  const fmt = (x: { v: number } | null) => (x ? unit.plain(x.v) : '–')

  let scatterNote: ReactNode = null
  if (ctx.mode === 'chart') {
    if (!rel) scatterNote = null
    else if (rel.state === 'error' || rel.state === 'refreshing') {
      scatterNote = (
        <p className="gf-hint">
          GB wind output couldn’t be read, so there is nothing to set the speed against. <ErrorWords error={rel.error} />
        </p>
      )
    } else if (!outDef || !outDef.count) scatterNote = <p className="gf-hint">No GB wind output is held in this window, so there is nothing to set the speed against.</p>
    else if (!perStep) scatterNote = <p className="gf-hint">GB wind output comes back on a coarser clock than the speed in this window, so the two aren’t paired. Try a shorter window.</p>
    else if (!pairs.length) scatterNote = <p className="gf-hint">No {model.bucketed ? 'period' : 'hour'} in this window holds both a speed and every half-hour of wind output.</p>
  }

  return (
    <>
      {ctx.mode === 'chart' && pairs.length > 0 && outDef && (
        <>
          <SpeedScatter
            pairs={pairs}
            x={{ label: site ? `${site.label}, 100 m wind speed` : 'Mean 100 m wind speed of the sites', unit }}
            y={{ label: rel?.spec.label ?? 'GB wind output', unit: outDef.unit, color: OUTPUT_COLOR }}
            color={OUTPUT_COLOR}
            stepMs={model.stepMs}
          />
          <p className="gf-hint">
            Each dot is one {model.bucketed ? `of the ${noun}` : 'hour'}: {site ? `${site.label}’s speed` : 'the mean of the sites’ speeds'} as published for it, against the mean of GB wind output’s {outNoun} inside it. {plural(pairs.length, 'dot', 'dots')}; {model.bucketed ? 'periods' : 'hours'} missing either figure, or any of those {outNoun}, are left out.
          </p>
        </>
      )}
      {scatterNote}
      <div className="gf-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="is-num">
                Held
              </th>
              <th scope="col" className="is-num">
                {site ? site.label : 'Sites’ mean'}, {unit.label}
              </th>
              <th scope="col" className="is-num">
                Lowest
              </th>
              <th scope="col" className="is-num">
                Highest
              </th>
              {outDays && outDef && (
                <>
                  <th scope="col" className="is-num">
                    Output held
                  </th>
                  <th scope="col" className="is-num">
                    Wind output, mean {outDef.unit.label}
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const o = outDays?.get(d.start)
              const span = outDays ? 5 : 3
              if (d.speed.count === 0 && !o) {
                return (
                  <tr key={d.day} className="is-missing">
                    <th scope="row">{dayLabel(d.start)}</th>
                    <td className="is-num">{d.expected === null ? '0' : `0 of ${d.expected}`}</td>
                    <td colSpan={span}>not held locally</td>
                  </tr>
                )
              }
              const on = d.start === ctx.picked
              const partial = d.expected !== null && d.speed.count < d.expected
              return (
                <tr key={d.day} className={on ? 'is-on' : partial ? 'is-partial' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.pick(on ? undefined : d.start)}>
                      {dayLabel(d.start)}
                    </button>
                  </th>
                  <td className="is-num">{d.expected === null || !partial ? d.speed.count : `${d.speed.count} of ${d.expected}`}</td>
                  <td className="is-num">{d.speed.mean === null ? '–' : unit.plain(d.speed.mean)}</td>
                  <td className="is-num">{fmt(d.speed.low)}</td>
                  <td className="is-num">{fmt(d.speed.high)}</td>
                  {outDays && outDef && (
                    <>
                      <td className={outPartial(d.start, o?.held ?? 0) ? 'is-num is-flag' : 'is-num'}>{outHeld(d.start, o?.held ?? 0)}</td>
                      <td className="is-num">{o ? outDef.unit.plain(o.mean) : '–'}</td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {days.length > 8 && <p className="gf-hint">{plural(days.length, 'day', 'days')}, oldest first. Scroll the table for the rest.</p>}
      <p className="gf-hint">
        {site ? `Held counts the ${noun} with a speed at ${site.label}.` : `Held counts the ${noun} with a speed at every site; the speed is their plain mean, each site counted the same.`}{' '}
        {outDays ? `Wind output is the mean of the ${outNoun} held that day. ` : ''}
        {days.some((d) => (d.expected !== null && d.speed.count > 0 && d.speed.count < d.expected) || (outDays !== null && outPartial(d.start, outDays.get(d.start)?.held ?? 0))) ? 'A count in bold is a day held in part: its figures cover only what it holds. ' : ''}
        {ctx.mode === 'chart' ? 'Select a day to mark it on the chart.' : 'Select a day to mark it.'}
      </p>
    </>
  )
}
