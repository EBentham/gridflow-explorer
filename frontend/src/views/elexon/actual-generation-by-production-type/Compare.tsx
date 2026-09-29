/**
 * agpt's working panel: agpt set against the datasets it overlaps. FUELHH's
 * fuel codes are paired with agpt's types by name (gas with CCGT and OCGT
 * together, wind onshore and offshore with FUELHH's one wind code), and agws's
 * three types with agpt's same three. For the pairing selected (`?pair=`),
 * both sides on the window's clock in GW and the gap between them in MW; then
 * every pairing's figures over the window. The panel reports each gap as it
 * finds it and doesn't explain it: why two Elexon datasets differ is not in
 * the rows.
 */
import { KeyList } from '../../../design/charts'
import { fmtN, listText } from '../../../design/format'
import { periodLabel, windowDomain } from '../../../design/time'
import { ErrorWords } from '../../_template/panels'
import { SeriesChart } from '../../_template/SeriesChart'
import { periodName, type SeriesDef, type SeriesModel } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import { displayUnit } from '../../_template/units'
import type { PageContext } from '../../define'
import { AGWS_KEY, DEFAULT_PAIR, FUELHH_KEY, PAIR_PARAM, PAIRINGS, halfHourly, pairColor, pairFigures, pairRows, pairingOf, type PairFigures, type Pairing } from './figures'
import './page.css'
import { AXIS_WIDTH } from './types'

const GW = displayUnit('MW')
const MW = displayUnit('MW', 'MW')
const OTHER_COLOR = 'var(--chart-actual)'
const GAP_COLOR = 'var(--chart-tick)'
const NAME = { [FUELHH_KEY]: 'FUELHH', [AGWS_KEY]: 'agws' } as const

function lineDef(field: string, label: string, color: string, unit: SeriesDef['unit']): SeriesDef {
  return { key: field, field, column: field, group: null, label, color, unit, from: 'self', count: 0, mean: null, min: null, max: null, signed: false }
}

/** The other side in words: `FUELHH’s CCGT and OCGT`, with the codes as ids. */
function OtherSide({ p }: { p: Pairing }) {
  return (
    <>
      {NAME[p.against]}’s{' '}
      {p.other.map((c, i) => (
        <span key={c}>
          {i > 0 && (i === p.other.length - 1 ? ' and ' : ', ')}
          {p.against === FUELHH_KEY ? <code>{c}</code> : c}
        </span>
      ))}
    </>
  )
}

const otherText = (p: Pairing) => `${NAME[p.against]}’s ${listText(p.other)}`

/** What the selected pairing's figures say, in sentences. */
function summary(f: PairFigures, own: SeriesModel): string[] {
  const p = f.pairing
  const name = (t: number) => periodName(t, own.stepMs, own.settlement)
  if (!f.a) return [`agpt holds no ${p.label.toLowerCase()} rows in this window.`]
  if (!f.b) return [`${otherText(p)} ${p.other.length > 1 ? 'aren’t' : 'isn’t'} in ${NAME[p.against]}’s rows for this window.`]
  if (!f.both) return [`No half-hour in this window holds both agpt’s ${p.label.toLowerCase()} and ${otherText(p)}.`]
  const out = [`agpt and ${NAME[p.against]} both hold ${f.both.toLocaleString('en-GB')} of the window’s half-hours for this pairing, and ${f.same === f.both ? 'every one holds' : `${f.same.toLocaleString('en-GB')} hold`} the same figure.`]
  if (f.largest && f.median !== null && f.same < f.both) {
    out.push(`The median gap is ${MW.format(f.median)}; the largest is ${MW.format(f.largest.v)} (agpt less ${NAME[p.against]}), in ${name(f.largest.t)}.`)
  }
  if (f.belowZero.b > 0 && f.belowZero.a === 0) {
    out.push(`${otherText(p)} is below zero at ${f.belowZero.b.toLocaleString('en-GB')} of those half-hours; agpt’s ${p.label.toLowerCase()} is below zero at none.`)
  }
  return out
}

export function Compare({ ctx }: { ctx: PageContext }) {
  const own = ctx.series
  if (!own || ctx.state === 'empty' || !ctx.window) return <p className="gf-hint">agpt holds no rows in this window, so there is nothing to set against FUELHH or agws.</p>
  if (!halfHourly(own)) {
    return (
      <p className="gf-hint">
        This window is read as {own.stepMs ? meansText(own.stepMs) : 'means'}, not half-hours, so agpt isn’t set against FUELHH or agws here. Choose a window of 30 days or less.
      </p>
    )
  }
  const selected = pairingOf(ctx.param(PAIR_PARAM))
  const rel = ctx.related[selected.against]
  const other = rel?.series ?? null
  const failed = rel && (rel.state === 'error' || rel.state === 'refreshing')
  const usable = (m: SeriesModel | null) => (halfHourly(m) ? m : null)
  const figures = PAIRINGS.map((p) => pairFigures(p, own, usable(ctx.related[p.against]?.series ?? null)))
  const f = figures.find((x) => x.pairing.key === selected.key) as PairFigures
  const color = pairColor(selected)
  const domain = windowDomain(ctx.window.start, ctx.window.end)
  const drawable = Boolean(f.both && other && halfHourly(other))

  return (
    <>
      {drawable && (
        <>
          <SeriesChart
            panels={[
              {
                rows: pairRows(own, f),
                series: [lineDef('a', `agpt, ${selected.label.toLowerCase()}`, color, GW), lineDef('b', otherText(selected), OTHER_COLOR, GW)],
                mark: 'line',
                unit: GW,
                stepMs: own.stepMs,
                settlement: own.settlement,
                height: 260,
                zero: true,
                axisWidth: AXIS_WIDTH,
              },
              {
                rows: pairRows(own, f),
                series: [lineDef('gap', `agpt less ${NAME[selected.against]}`, GAP_COLOR, MW)],
                mark: 'bars',
                unit: MW,
                stepMs: own.stepMs,
                settlement: own.settlement,
                height: 150,
                zero: true,
                axisWidth: AXIS_WIDTH,
              },
            ]}
            domain={domain}
            fixture={ctx.fixture}
            syncId="agpt-compare"
          />
          <KeyList
            items={[
              { key: 'a', mark: { kind: 'line', color }, label: `agpt, ${selected.label.toLowerCase()}` },
              { key: 'b', mark: { kind: 'line', color: OTHER_COLOR }, label: <OtherSide p={selected} /> },
              { key: 'gap', mark: { kind: 'bars', color: GAP_COLOR, shape: 'fall' }, label: `The gap, agpt less ${NAME[selected.against]}, in MW (lower chart)` },
            ]}
          />
        </>
      )}
      {failed && (
        <p className="gf-hint">
          {NAME[selected.against]} couldn’t be read, so there is nothing to set agpt against. <ErrorWords error={rel.error} />
        </p>
      )}
      {!failed && other && !halfHourly(other) && <p className="gf-hint">{NAME[selected.against]} is read as means over this window, not half-hours, so it isn’t set against agpt here.</p>}
      {!failed && other && halfHourly(other) && <p className="gf-hint">{summary(f, own).join(' ')}</p>}
      <div className="gf-days agpt-whole">
        <table>
          <thead>
            <tr>
              <th scope="col">agpt type</th>
              <th scope="col">Set against</th>
              <th scope="col" className="is-num">
                Half-hours both hold
              </th>
              <th scope="col" className="is-num">
                Same figure
              </th>
              <th scope="col" className="is-num">
                Median gap, MW
              </th>
              <th scope="col" className="is-num">
                Largest gap, MW
              </th>
              <th scope="col">In</th>
            </tr>
          </thead>
          <tbody>
            {figures.map((x) => {
              const p = x.pairing
              const on = p.key === selected.key
              return (
                <tr key={p.key} className={on ? 'is-on' : x.both === 0 ? 'is-missing' : undefined}>
                  <th scope="row">
                    <button type="button" aria-pressed={on} onClick={() => ctx.setParam(PAIR_PARAM, p.key === DEFAULT_PAIR ? null : p.key)}>
                      {p.label}
                    </button>
                  </th>
                  <td>
                    <OtherSide p={p} />
                  </td>
                  <td className="is-num">{x.both.toLocaleString('en-GB')}</td>
                  <td className="is-num">{x.both ? x.same.toLocaleString('en-GB') : '–'}</td>
                  <td className="is-num">{x.median === null ? '–' : fmtN(x.median, 0)}</td>
                  <td className="is-num">{x.largest ? MW.plain(x.largest.v) : '–'}</td>
                  <td>{x.largest && x.largest.v !== 0 ? periodLabel(x.largest.t, own.stepMs) : '–'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Over the window, at the half-hours both datasets hold. A gap is agpt less the other, in MW, sign kept; the median is of its size. Select a row to draw it above. FUELHH’s codes are paired with agpt’s
        types by name, which doesn’t show that the two count the same plant. FUELHH has no solar code, and agpt no interconnectors, so neither is set against the other.
      </p>
    </>
  )
}
