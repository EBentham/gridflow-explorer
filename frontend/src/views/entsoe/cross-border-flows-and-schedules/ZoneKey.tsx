/**
 * The key of the net positions: the two sides' marks, then every zone with
 * its latest value and the side it was named on, and how many quarter-hours
 * of the window it holds on each side; select one to draw it alone. Then the
 * selected zone's (or the first's) highest and mean on each side. Nothing is
 * netted: the sign is unconfirmed.
 */
import { KeyList } from '../../../design/charts'
import { periodLabel } from '../../../design/time'
import type { PageContext } from '../../define'
import { SIDE_COLORS } from './areas'
import { sideDays, windowTally, type Tally } from './figures'
import { focusedZone, latestStamp, SIDE_LABELS, zonesOf, type Line, type Zone } from './model'
import { stepWords } from './words'

const cap = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`

/** The zone's latest value held, on whichever side it was named. */
function latestOf(z: Zone, tallies: { in: Tally | null; out: Tally | null }): { t: number; v: number; side: 'in' | 'out'; line: Line } | null {
  const a = tallies.in?.latest && z.inSide ? { ...tallies.in.latest, side: 'in' as const, line: z.inSide } : null
  const b = tallies.out?.latest && z.outSide ? { ...tallies.out.latest, side: 'out' as const, line: z.outSide } : null
  if (a && b) return a.t >= b.t ? a : b
  return a ?? b
}

export function ZoneKey({ ctx }: { ctx: PageContext }) {
  const w = ctx.window
  const zones = zonesOf(ctx)
  if (!w || !zones.length) return <p className="gf-hint">No zone holds a net position in this window, so there is nothing to key.</p>
  const tallyOf = (line: Line | null) => (line ? windowTally(line.points, line.step, w) : null)
  const rows = zones.map((z) => {
    const tallies = { in: tallyOf(z.inSide), out: tallyOf(z.outSide) }
    const step = z.inSide?.step ?? z.outSide?.step ?? null
    const days = sideDays(z.inSide?.points ?? [], z.outSide?.points ?? [], step, w)
    const held = days.reduce((s, d) => s + d.held, 0)
    const expected = days.every((d) => d.expected !== null) ? days.reduce((s, d) => s + (d.expected ?? 0), 0) : null
    return { z, tallies, step, held, expected, latest: latestOf(z, tallies) }
  })
  // The source line names this time; a zone whose latest value is older names its own.
  const stamp = latestStamp(zones.flatMap((z) => [z.inSide, z.outSide]))?.t
  const pickable = zones.length > 1
  // A focus naming no zone in this window selects nothing.
  const focused = zones.some((z) => z.id === ctx.focus)
  const sel = focusedZone(ctx, zones)
  const selRow = rows.find((r) => r.z.id === sel?.id)

  return (
    <>
      <KeyList
        items={[
          { key: 'in', mark: { kind: 'line', color: SIDE_COLORS.in, dashed: ctx.fixture }, label: `Zone ${SIDE_LABELS.in}` },
          { key: 'out', mark: { kind: 'line', color: SIDE_COLORS.out, dashed: ctx.fixture }, label: `Zone ${SIDE_LABELS.out}` },
        ]}
      />
      <ul className="gf-series-key">
        {rows.map(({ z, tallies, step, held, expected, latest }) => {
          const on = ctx.focus === z.id
          return (
            <li key={z.id} className={on ? 'is-focus' : focused ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={!pickable} onClick={() => ctx.setFocus(on ? undefined : z.id)}>
                <span className="gf-series-name">{z.name}</span>
                <span className="gf-series-value">{latest ? latest.line.def.unit.format(latest.v) : '–'}</span>
              </button>
              {latest && (
                <span className="gf-series-when">
                  Latest {SIDE_LABELS[latest.side]}
                  {latest.t !== stamp ? `, ${periodLabel(latest.t, latest.line.step)}` : ''}
                </span>
              )}
              <span className="gf-series-when">
                In area {(tallies.in?.held ?? 0).toLocaleString('en-GB')}, out area {(tallies.out?.held ?? 0).toLocaleString('en-GB')}, of {(expected ?? held).toLocaleString('en-GB')} {stepWords(step)}
              </span>
            </li>
          )
        })}
      </ul>
      {pickable && <p className="gf-hint">{focused ? 'Select it again to draw every zone.' : 'Select a zone to draw it alone.'}</p>}
      {sel && selRow && (
        <>
          <p className="gf-hint">In this window, {sel.name}, each side apart:</p>
          <dl className="gf-stats">
            {(['in', 'out'] as const).map((side) => {
              const t = selRow.tallies[side]
              const line = side === 'in' ? sel.inSide : sel.outSide
              if (!t || !line || !t.held) return null
              return (
                <div key={side}>
                  <dt>{cap(SIDE_LABELS[side])}</dt>
                  <dd>
                    {t.mean === null ? '–' : `${line.def.unit.format(t.mean)} mean`}
                    {t.high && (
                      <span className="gf-stat-when">
                        Highest {line.def.unit.format(t.high.v)}, {periodLabel(t.high.t, line.step)}
                      </span>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
          <p className="gf-hint">Sign unconfirmed: which side means the zone is exporting isn’t known, so the two are shown apart and never netted. Means are of the {stepWords(selRow.step)} held on that side.</p>
        </>
      )}
    </>
  )
}
