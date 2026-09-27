/**
 * One period's mix as one horizontal bar, in the design's mix-bar look (the
 * pinned generation mix's `MixBar`, the site's "Great Britain's generation"
 * bar): each fuel's mean as a segment, in stack order, labelled above with
 * its amount and share. NESO's mix has up to seven fuels over 5%, more than
 * the mix bar's two rows of labels hold without one running into the next,
 * so the largest fuels are placed first, each on the first row where it fits
 * (its width estimated at the design's 1440px layout), and the rest are named
 * in the line beneath. No value here goes below zero: NESO's mix counts no
 * exports or pumping.
 */
import { fmt0, listText, niceTicks, pct } from '../../../design/format'
import type { DisplayUnit } from '../../_template/units'
import { FUELS, amountText, printsAsZero } from './fuels'
import type { Period } from './periods'

/** The bar's width at the 1440px layout, px: only for spacing the labels. */
const BAR_PX = 960
/** Fuels at least this share of the total may be labelled above the bar. */
const LABEL_FROM = 0.05

interface Span {
  x0: number
  x1: number
  /** Where the label's rule stands: its left edge, or its right edge for a label set to the end. */
  rule: number
}

/** A label's width in px: its bold name or its figures, whichever is longer, at 12.5px. */
const widthOf = (name: string, figures: string) => Math.max(name.length * 7.3, figures.length * 6.4) + 12

export function ShareBar({ period, unit }: { period: Period; unit: DisplayUnit }) {
  const total = period.total
  if (total === null || total <= 0) return <p className="gf-hint">Not every fuel holds a value in this period, so there is no mix to draw.</p>
  // The total is set only when every fuel holds a mean, so none of these is missing.
  const parts = FUELS.map((f) => ({ ...f, value: period.mean[f.column] ?? 0 }))
  let acc = 0
  const segs = parts
    .filter((p) => p.value > 0)
    .map((p) => {
      const start = acc
      acc += p.value
      const share = p.value / total
      const figures = printsAsZero(unit, p.value) ? amountText(unit, p.value) : `${unit.format(p.value)}, ${pct(share)}`
      return { ...p, start, share, figures, atEnd: start / total > 0.72, row: -1 }
    })
  // Largest first, so the fuels that make up most of the mix are the ones labelled.
  const rows: Span[][] = [[], []]
  for (const s of [...segs].sort((a, b) => b.share - a.share)) {
    if (s.share < LABEL_FROM) break
    const w = widthOf(s.label, s.figures)
    const x0 = s.atEnd ? ((s.start + s.value) / total) * BAR_PX - w : (s.start / total) * BAR_PX
    const span = { x0, x1: x0 + w, rule: s.atEnd ? x0 + w : x0 }
    const clear = (r: number) =>
      rows[r].every((o) => span.x0 >= o.x1 + 6 || span.x1 <= o.x0 - 6) &&
      // A top-row rule runs the labels' full height: it mustn't cut a lower label, nor may a lower label sit across one.
      (r === 0 ? rows[1].every((o) => span.rule <= o.x0 || span.rule >= o.x1) : rows[0].every((o) => o.rule <= span.x0 || o.rule >= span.x1))
    s.row = clear(0) ? 0 : clear(1) ? 1 : -1
    if (s.row >= 0) rows[s.row].push(span)
  }
  const labelled = segs.filter((s) => s.row >= 0)
  const named = new Set(labelled.map((s) => s.column))
  // Every fuel not labelled is named here, a zero included, so none drops out of sight.
  const rest = parts.filter((p) => !named.has(p.column))
  const restText = (p: (typeof parts)[number]) => {
    if (p.value === 0) return `${p.prose} zero`
    if (printsAsZero(unit, p.value)) return `${p.prose} ${amountText(unit, p.value)}`
    // `pct` rounds to whole per cent, so a fuel under half a per cent would print as 0%.
    return `${p.prose} ${unit.format(p.value)} (${p.value / total < 0.005 ? 'under 1%' : pct(p.value / total)})`
  }
  const ticks = niceTicks(0, total, 5).ticks.filter((t) => t < total * 0.92)
  const at = (v: number) => `${(v / total) * 100}%`
  return (
    <figure className="gf-mixbar">
      <div className="gf-mixbar-labels">
        {labelled.map((s) => (
          <span
            key={s.column}
            className={`gf-mixbar-label is-row${s.row}${s.atEnd ? ' is-end' : ''}`}
            style={s.atEnd ? { right: `${(1 - (s.start + s.value) / total) * 100}%` } : { left: at(s.start) }}
          >
            <b>{s.label}</b>
            {s.figures}
          </span>
        ))}
      </div>
      <div className="gf-mixbar-bar" role="img" aria-label={segs.map((s) => `${s.label} ${s.figures}`).join('; ')}>
        {segs.map((s) => (
          <span key={s.column} title={`${s.label}: ${s.figures}`} style={{ left: at(s.start), width: at(s.value), background: s.color }} />
        ))}
      </div>
      <div className="gf-mixbar-axis" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} style={{ left: at(t) }}>
            {fmt0(t)}
          </span>
        ))}
        <span className="is-total" style={{ left: '100%' }}>
          {unit.format(total)}
        </span>
      </div>
      <figcaption className="gf-mixbar-rest">
        {rest.length > 0 && <>Also {listText(rest.map(restText))}. </>}
        The fuels add up to {unit.format(total)} on average, the mean total generation.
      </figcaption>
    </figure>
  )
}
