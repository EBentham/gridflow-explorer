/**
 * The key panel: each zone's line with its latest price held, named by its
 * own period (select one to draw it alone), then GB's benchmark, drawn under
 * the zones in pounds. Then, for the zone selected, the window's range,
 * highest, lowest, mean and steps below zero; with none selected, the
 * window's highest and lowest price across the zones. Every figure is read
 * from the rows, on each zone's own clock.
 */
import { KeyList } from '../../../design/charts'
import { currency, plural } from '../../../design/format'
import { clock, dayLabel, periodLabel } from '../../../design/time'
import { latestValue, periodName, seriesId } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { GB_KEY, GB_PRICE, seriesOf, zoneFigures, zoneNoun, type Point, type ZoneFigures } from './figures'

const eur = (v: number) => `${currency(v, '€', 2)}/MWh`

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
      <ul className="gf-series-key">
        {held.map((z) => {
          const def = z.def
          if (!def) return null
          const id = seriesId(def)
          const on = ctx.focus === id
          return (
            <li key={id} className={on ? 'is-focus' : ctx.focus ? 'is-muted' : undefined}>
              <button type="button" aria-pressed={on} disabled={held.length < 2} onClick={() => ctx.setFocus(on ? undefined : id)}>
                <KeyList items={[{ key: id, mark: { kind: 'line', color: z.color, dashed: ctx.fixture }, label: <span className="gf-series-name">{z.label}</span> }]} />
                <span className="gf-series-value">{z.latest ? eur(z.latest.v) : '–'}</span>
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
              <KeyList items={[{ key: 'gb', mark: { kind: 'line', color: gbDef.color, dashed: ctx.fixture }, label: <span className="gf-series-name">GB benchmark, beneath</span> }]} />
              <span className="gf-series-value">{gbLatest ? gbDef.unit.format(gbLatest.v) : '–'}</span>
            </button>
            {gbLatest && <span className="gf-series-when">{periodName(gbLatest.t, gb.series.stepMs, gb.series.settlement)}</span>}
          </li>
        </ul>
      )}
      <p className="gf-hint">
        {held.length > 1 && (focus ? 'Select it again to draw every zone. ' : chart ? 'Select a zone to draw it alone, with its highest and lowest labelled and its runs below zero banded. ' : 'Select a zone to read its figures here. ')}
        {gbDef ? `GB’s benchmark is in pounds and ${chart ? 'on its own axis' : 'in the Chart view only'}: it isn’t a zone of this data.` : ''}
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
                  {highest.z.label}, {dayLabel(highest.p.t)} at {clock(highest.p.t)}
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
                  {lowest.z.label}, {dayLabel(lowest.p.t)} at {clock(lowest.p.t)}
                </span>
              </dd>
            </div>
          )}
          <div>
            <dt>Zones below zero</dt>
            <dd>
              {held.filter((z) => z.below > 0).length} of {held.length}
              <span className="gf-stat-when">at least once in {ctx.windowText}</span>
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
