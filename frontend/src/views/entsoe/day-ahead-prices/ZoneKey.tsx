/**
 * The key panel: each zone's line with its latest price held, named by its
 * own period (select one to draw it alone), then GB's benchmark, drawn under
 * the zones in pounds. Then, for the zone selected, the window's range,
 * highest, lowest, mean and steps below zero; with none selected, the
 * window's highest and lowest price across the zones. Every figure is read
 * from the rows, on each zone's own clock.
 */
import { CHART } from '../../../design/chartTheme'
import { currency, plural } from '../../../design/format'
import { periodLabel } from '../../../design/time'
import { latestValue, periodName, seriesId } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { GB_KEY, GB_PRICE, seriesOf, zoneFigures, zoneNoun, type Point, type ZoneFigures } from './figures'

const eur = (v: number) => `${currency(v, '€', 2)}/MWh`

/**
 * A key row: the line's mark, the name, and the value at the right. The name
 * gives way (with an ellipsis) before the value is pushed out of the 272px
 * panel; the rows show the price without its `/MWh`, which the line above
 * the list names once.
 */
function Row({ color, label, value, dashed }: { color: string; label: string; value: string; dashed: boolean }) {
  return (
    <>
      <svg width="22" height="10" aria-hidden="true" style={{ flex: 'none' }}>
        <line x1="0" y1="5" x2="22" y2="5" stroke={color} strokeWidth="2" strokeDasharray={dashed ? CHART.fixtureDash : undefined} />
      </svg>
      <span className="gf-series-name" style={{ flex: '1 1 auto', minWidth: 0 }} title={label}>
        {label}
      </span>
      <span className="gf-series-value">{value}</span>
    </>
  )
}

/** A zone's value and its own period: `Sun 20 Sep, 13:00–13:15 BST`. */
function when(p: Point, z: Pick<ZoneFigures, 'step'>): string {
  return periodLabel(p.t, z.step)
}

export function ZoneKey({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const window = ctx.window
  if (!model || !window) return <p className="gf-hint">No price is held in this window, so there is nothing to key.</p>
  const zones = zoneFigures(model, window)
  const held = zones.filter((z) => z.def && z.points.length)
  if (!held.length) return <p className="gf-hint">No price is held in this window, so there is nothing to key.</p>
  const none = zones.filter((z) => !z.points.length)
  const focus = held.find((z) => z.def && seriesId(z.def) === ctx.focus)
  const gb = ctx.related[GB_KEY]
  const gbDef = seriesOf(gb?.series, GB_PRICE)
  const gbLatest = gb?.series && gbDef ? latestValue(gb.series, gbDef) : null
  const chart = ctx.mode === 'chart'

  let highest: { z: ZoneFigures; p: Point } | null = null
  let lowest: { z: ZoneFigures; p: Point } | null = null
  for (const z of held) {
    if (z.high && (!highest || z.high.v > highest.p.v)) highest = { z, p: z.high }
    if (z.low && (!lowest || z.low.v < lowest.p.v)) lowest = { z, p: z.low }
  }

  return (
    <>
      <p className="gf-hint">Latest price held: the zones per MWh in euros{gbDef ? ', GB’s benchmark in pounds' : ''}.</p>
      <ul className="gf-series-key">
        {held.map((z) => {
          const def = z.def
          if (!def) return null
          const id = seriesId(def)
          const on = ctx.focus === id
          return (
            <li key={id} className={on ? 'is-focus' : focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={held.length < 2} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <Row color={z.color} label={z.label} value={z.latest ? currency(z.latest.v, '€', 2) : '–'} dashed={ctx.fixture} />
              </button>
              {z.latest && <span className="gf-series-when">{when(z.latest, z)}</span>}
            </li>
          )
        })}
      </ul>
      {gbDef && gb?.series && (
        <ul className="gf-series-key">
          <li>
            <button type="button" disabled>
              <Row color={gbDef.color} label="GB benchmark" value={gbLatest ? currency(gbLatest.v, '£', 2) : '–'} dashed={ctx.fixture} />
            </button>
            {gbLatest && <span className="gf-series-when">{periodName(gbLatest.t, gb.series.stepMs, gb.series.settlement)}</span>}
          </li>
        </ul>
      )}
      <p className="gf-hint">
        {held.length > 1 && (focus ? 'Select it again to draw every zone. ' : chart ? 'Select a zone to draw it alone, with its highest and lowest labelled and its runs below zero banded. ' : 'Select a zone to read its figures here. ')}
        {gbDef ? `GB’s benchmark is ${chart ? 'the lower chart, on its own axis' : 'drawn in the Chart view only'}: it isn’t a zone of this data.` : ''}
      </p>
      {none.length > 0 && <p className="gf-hint">No price held in this window: {none.map((z) => z.label).join(', ')}.</p>}
      {focus ? (
        <FocusStats z={focus} bucketed={model.bucketed} windowText={ctx.windowText} />
      ) : (
        <dl className="gf-stats">
          {highest && (
            <div>
              <dt>Highest</dt>
              <dd>
                {eur(highest.p.v)}
                <span className="gf-stat-when">
                  {highest.z.label}, {when(highest.p, highest.z)}
                </span>
              </dd>
            </div>
          )}
          {lowest && (
            <div>
              <dt>Lowest</dt>
              <dd>
                {eur(lowest.p.v)}
                <span className="gf-stat-when">
                  {lowest.z.label}, {when(lowest.p, lowest.z)}
                </span>
              </dd>
            </div>
          )}
          <div>
            <dt>Below zero</dt>
            <dd>
              {held.filter((z) => z.below > 0).length} of {plural(held.length, 'zone', 'zones')}
              <span className="gf-stat-when">at least once in the window</span>
            </dd>
          </div>
        </dl>
      )}
    </>
  )
}

function FocusStats({ z, bucketed, windowText }: { z: ZoneFigures; bucketed: boolean; windowText: string }) {
  const noun = zoneNoun(z, bucketed)
  if (z.mean === null || !z.low || !z.high) return null
  return (
    <>
      <dl className="gf-stats">
        <div>
          <dt>Range</dt>
          <dd>
            {eur(z.low.v)} to {eur(z.high.v)}
            <span className="gf-stat-when">in {windowText}</span>
          </dd>
        </div>
        <div>
          <dt>Highest</dt>
          <dd>
            {eur(z.high.v)}
            <span className="gf-stat-when">{when(z.high, z)}</span>
          </dd>
        </div>
        <div>
          <dt>Lowest</dt>
          <dd>
            {eur(z.low.v)}
            <span className="gf-stat-when">{when(z.low, z)}</span>
          </dd>
        </div>
        <div>
          <dt>Mean</dt>
          <dd>{eur(z.mean)}</dd>
        </div>
        <div>
          <dt>Below zero</dt>
          <dd>
            {z.below.toLocaleString('en-GB')} of {z.points.length.toLocaleString('en-GB')}
          </dd>
        </div>
        {z.longestBelow && (
          <div>
            <dt>Longest run below zero</dt>
            <dd>
              {plural(z.longestBelow.n, noun.replace(/s$/, ''), noun)}
              <span className="gf-stat-when">from {periodLabel(z.longestBelow.start, z.step)}</span>
            </dd>
          </div>
        )}
      </dl>
      <p className="gf-hint">
        {z.label}, over the {z.points.length.toLocaleString('en-GB')} {noun} held in the window. The mean counts each of them once.
      </p>
    </>
  )
}
