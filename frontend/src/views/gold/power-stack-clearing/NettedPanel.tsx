/**
 * The residual view's working panel. Chart: what comes off demand before the
 * priced stack, stacked on the main chart's clock in GW: hydro that isn't
 * pumped storage, wind, solar, other generation, pumped storage, and the
 * interconnectors together as net imports; exports and pumping stack below
 * zero. Then each piece's mean, lowest and highest in the window, the
 * interconnectors one by one, and the rows' own check that the three lines
 * of the main chart follow from these pieces. A piece is drawn only where
 * every column in it is held: nothing is part-summed or filled in.
 */
import { useMemo } from 'react'
import { fmt1, plural } from '../../../design/format'
import { windowDomain } from '../../../design/time'
import { SeriesChart, type ChartPanel } from '../../_template/SeriesChart'
import type { SeriesDef, WideRow } from '../../_template/seriesModel'
import { displayUnit } from '../../_template/units'
import type { PageContext } from '../../define'
import { AXIS_WIDTH, INTERCONNECTORS, INTERCONNECTOR_CODES, NET_PIECES, demandIdentity, num, ownRows, pieceValue, statsOf, type Stats } from './figures'

const GW = displayUnit('MW')
const gw = (v: number | null) => (v === null ? '–' : fmt1(v * GW.factor))

function StatCells({ s }: { s: Stats }) {
  return (
    <>
      <td className="is-num">{gw(s.mean)}</td>
      <td className="is-num">{gw(s.min)}</td>
      <td className="is-num">{gw(s.max)}</td>
    </>
  )
}

export function NettedPanel({ ctx }: { ctx: PageContext }) {
  const rows = ownRows(ctx)
  const built = useMemo(() => {
    const sorted = [...rows].sort((a, b) => a.ts - b.ts)
    const wide: WideRow[] = sorted.map((r) => {
      const w: WideRow = { t: r.ts }
      for (const piece of NET_PIECES) {
        const v = pieceValue(r, piece)
        w[`net_${piece.key}`] = v === null ? null : v * GW.factor
      }
      return w
    })
    const defs: SeriesDef[] = NET_PIECES.map((piece) => {
      const s = statsOf(sorted.map((r) => pieceValue(r, piece)))
      return {
        key: `net:${piece.key}`,
        field: `net_${piece.key}`,
        column: piece.columns.length === 1 ? piece.columns[0] : 'netted_INT*_mw',
        group: null,
        label: piece.label,
        color: piece.color,
        unit: GW,
        from: 'self',
        count: s.n,
        mean: s.mean === null ? null : s.mean * GW.factor,
        min: s.min === null ? null : s.min * GW.factor,
        max: s.max === null ? null : s.max * GW.factor,
        signed: (s.min ?? 0) < 0,
      }
    })
    const pieceStats = NET_PIECES.map((piece) => ({ piece, stats: statsOf(sorted.map((r) => pieceValue(r, piece))) }))
    const links = INTERCONNECTORS.map((c, i) => ({ code: INTERCONNECTOR_CODES[i], stats: statsOf(sorted.map((r) => num(r[c]))) }))
    return { wide, defs, pieceStats, links, identity: demandIdentity(sorted) }
  }, [rows])
  const model = ctx.series
  if (!model || !ctx.window || !rows.length) return <p className="gf-hint">Nothing is held in this window, so there is nothing to take off demand.</p>
  const drawn = built.defs.filter((d) => d.count > 0)
  const panel: ChartPanel = {
    rows: built.wide,
    series: drawn,
    mark: 'stacked',
    unit: GW,
    stepMs: model.stepMs,
    bucketed: model.bucketed,
    settlement: model.settlement,
    height: 230,
    zero: true,
    axisWidth: AXIS_WIDTH,
  }
  const { identity } = built
  const noun = model.bucketed ? 'periods' : 'half-hours'

  return (
    <>
      {ctx.mode === 'chart' && drawn.length > 0 && (
        <SeriesChart panels={[panel]} domain={windowDomain(ctx.window.start, ctx.window.end)} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      )}
      {identity.n > 0 && (
        <p className="gf-hint">
          {identity.residual === identity.n && identity.clearing === identity.n
            ? `In each of the ${plural(identity.n, noun.replace(/s$/, ''), noun)} holding every column, demand less wind and solar is the residual demand, and the residual demand less the rest is the clearing demand, to within half a megawatt: the pieces here are the whole gap between the lines.`
            : `Demand less wind and solar matches the residual demand in ${identity.residual.toLocaleString('en-GB')} of ${plural(identity.n, noun.replace(/s$/, ''), noun)}, and the residual demand less the rest matches the clearing demand in ${identity.clearing.toLocaleString('en-GB')}; the largest difference is ${fmt1(identity.worst)} MW.`}
        </p>
      )}
      <div className="gf-days gf-stack-days">
        <table>
          <thead>
            <tr>
              <th scope="col">Taken off demand, GW</th>
              <th scope="col" className="is-num">
                Mean
              </th>
              <th scope="col" className="is-num">
                Lowest
              </th>
              <th scope="col" className="is-num">
                Highest
              </th>
            </tr>
          </thead>
          <tbody>
            {built.pieceStats.map(({ piece, stats }) => (
              <tr key={piece.key} className={stats.n ? undefined : 'is-missing'}>
                <th scope="row">
                  <span className="gf-swatch gf-stack-swatch" style={{ background: piece.color }} aria-hidden="true" />
                  {piece.label}
                </th>
                <StatCells s={stats} />
              </tr>
            ))}
            {built.links.map(({ code, stats }) => (
              <tr key={code} className={stats.n ? 'gf-stack-sub' : 'gf-stack-sub is-missing'}>
                <th scope="row">
                  <code>{code}</code>
                </th>
                <StatCells s={stats} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="gf-hint">
        Net imports is the interconnectors together, each listed under it by its code in Elexon’s generation by fuel; a negative figure is a net export. Each figure is of the {noun} holding it; net imports only where every interconnector is held.
      </p>
    </>
  )
}
