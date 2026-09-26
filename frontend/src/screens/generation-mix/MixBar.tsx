/**
 * One horizontal stacked bar of mean GW by fuel, labelled above in two
 * staggered rows like the gridflow site's "Great Britain's generation" bar.
 * Fuels under 6% of the total are named in the line beneath instead of
 * labelled; bands that averaged below zero are named there too, not drawn.
 */
import { fmt0, fmt1, niceTicks, pct } from '../../design/format'
import { fuelVar } from '../../design/fuels'
import type { MixMean } from './mix'

export function MixBar({ means }: { means: MixMean[] }) {
  const pos = means.filter((m) => m.gw > 0.005)
  const total = pos.reduce((s, m) => s + m.gw, 0)
  const scale = total || 1
  const ticks = niceTicks(0, total, 5).ticks.filter((t) => t < total * 0.92)
  let acc = 0
  let row = 0
  const segs = pos.map((m) => {
    const start = acc
    acc += m.gw
    const share = m.gw / scale
    const labelled = share >= 0.06
    const seg = { ...m, start, share, labelled, row: labelled ? row % 2 : -1 }
    if (labelled) row += 1
    return seg
  })
  const small = segs.filter((s) => !s.labelled)
  const negs = means.filter((m) => m.gw < -0.005)
  const at = (v: number) => `${(v / scale) * 100}%`
  return (
    <figure className="gf-mixbar">
      <div className="gf-mixbar-labels">
        {segs
          .filter((s) => s.labelled)
          .map((s) => {
            const atEnd = s.start / scale > 0.72
            return (
              <span
                key={s.key}
                className={`gf-mixbar-label is-row${s.row}${atEnd ? ' is-end' : ''}`}
                style={atEnd ? { right: `${(1 - (s.start + s.gw) / scale) * 100}%` } : { left: at(s.start) }}
              >
                <b>{s.label}</b>
                {`${fmt1(s.gw)} GW, ${pct(s.share)}`}
              </span>
            )
          })}
      </div>
      <div className="gf-mixbar-bar" role="img" aria-label={segs.map((s) => `${s.label} ${fmt1(s.gw)} GW`).join(', ')}>
        {segs.map((s) => (
          <span key={s.key} title={`${s.label}: ${fmt1(s.gw)} GW, ${pct(s.share)}`} style={{ left: at(s.start), width: at(s.gw), background: fuelVar(s.key) }} />
        ))}
      </div>
      <div className="gf-mixbar-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: at(t) }}>
            {fmt0(t)}
          </span>
        ))}
        <span className="is-total" style={{ left: '100%' }}>
          {fmt1(total)} GW
        </span>
      </div>
      <figcaption className="gf-mixbar-rest">
        {small.length > 0 && <>Also {small.map((s) => `${s.label} ${fmt1(s.gw)} GW`).join(', ')}. </>}
        {negs.map((m) => `${m.label} averaged ${fmt1(m.gw)} GW, below zero and not drawn. `)}
        Positive parts sum to {fmt1(total)} GW.
      </figcaption>
    </figure>
  )
}
