/**
 * The residual view's key: the three lines with their latest values (select
 * one to draw it alone) and the band for clearing demand below zero; what
 * came off demand at that latest half-hour, each piece as held; then the
 * window's means, the lowest clearing demand and how often it fell below
 * zero. Figures are the rows' own, in GW for display.
 */
import { KeyList } from '../../../design/charts'
import { fmt1, plural } from '../../../design/format'
import { extremesOf, latestValue, periodName, runsBelowZero, seriesId, type SeriesDef } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { DEMAND, LINE_COLUMNS, NET_PIECES, ownRows, pieceValue } from './figures'

export function ResidualKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const lines = model ? LINE_COLUMNS.map((c) => model.all.find((d) => d.column === c)).filter((d): d is SeriesDef => d !== undefined && d.count > 0) : []
  if (!model || !lines.length) return <p className="gf-hint">No demand figure is held in this window, so there is nothing to key.</p>
  const clearing = lines.find((d) => d.column === DEMAND) ?? null
  const chart = ctx.mode === 'chart'
  const runs = clearing ? runsBelowZero(model.rows, clearing, model.stepMs) : []
  const stamp = latestValue(model, lines[0])
  const row = stamp ? ownRows(ctx).find((r) => r.ts === stamp.t) : undefined
  const when = (t: number) => periodName(t, model.stepMs, model.settlement)
  const low = clearing ? extremesOf(model.rows, clearing)?.low : undefined
  const below = clearing ? model.rows.filter((r) => typeof r[clearing.field] === 'number' && (r[clearing.field] as number) < 0).length : 0
  const pickable = chart && lines.length > 1

  return (
    <>
      <ul className="gf-series-key">
        {lines.map((d) => {
          const id = seriesId(d)
          const latest = latestValue(model, d)
          const on = ctx.focus === id
          return (
            <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <KeyList items={[{ key: id, mark: { kind: 'line', color: d.color, dashed: ctx.fixture }, label: <span className="gf-series-name">{d.label}</span> }]} />
                <span className="gf-series-value">{latest ? d.unit.format(latest.v) : '–'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      {chart && runs.length > 0 && <KeyList items={[{ key: 'below', mark: { kind: 'band' }, label: 'Clearing demand below zero' }]} />}
      {pickable && <p className="gf-hint">{ctx.focus ? 'Select it again to draw all three.' : 'Select a line to draw it on its own.'}</p>}
      {stamp && row && (
        <>
          <p className="gf-hint">
            Latest values are for {when(stamp.t)}, the latest held. What came off demand then, in GW; a negative figure, such as exports or pumping, adds to it instead:
          </p>
          <dl className="gf-stats">
            {NET_PIECES.map((piece) => {
              const v = pieceValue(row, piece)
              return (
                <div key={piece.key}>
                  <dt>
                    <span className="gf-swatch gf-stack-swatch" style={{ background: piece.color }} aria-hidden="true" />
                    {piece.label}
                  </dt>
                  <dd>{v === null ? 'not held' : fmt1(v / 1000)}</dd>
                </div>
              )
            })}
          </dl>
        </>
      )}
      <dl className="gf-stats">
        {lines.map((d) => (
          <div key={d.key}>
            <dt>{d.label}, mean</dt>
            <dd>{d.mean === null ? '–' : d.unit.format(d.mean)}</dd>
          </div>
        ))}
        {low && clearing && (
          <div>
            <dt>Lowest clearing demand</dt>
            <dd>
              {clearing.unit.format(low.v)}
              <span className="gf-stat-when">{when(low.t)}</span>
            </dd>
          </div>
        )}
        {clearing && (
          <div>
            <dt>Clearing demand below zero</dt>
            <dd>
              {below.toLocaleString('en-GB')} of {clearing.count.toLocaleString('en-GB')}
            </dd>
          </div>
        )}
      </dl>
      <p className="gf-hint">
        Means are of the {plural(lines[0].count, model.bucketed ? 'period' : 'half-hour', model.bucketed ? 'periods' : 'half-hours')} held in the window, each line over those it holds.
      </p>
    </>
  )
}
