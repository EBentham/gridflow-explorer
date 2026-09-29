/**
 * The key. By default: the sum of the top units' start levels at the
 * latest half-hour every one of them holds, then each unit under its fuel
 * (top of the stack first), with its level then and its fuel's part of the
 * sum; select a unit to draw it alone. Then the market index price. For one
 * unit: its fuel, latest, highest, lowest and mean start level, and how
 * often it sat at zero. Every figure is read from the rows; a sum is taken
 * only where every unit holds a level.
 */
import type { ReactNode } from 'react'
import { KeyList } from '../../../design/charts'
import { plural } from '../../../design/format'
import { ErrorWords } from '../../_template/panels'
import { extremesOf, periodName, type SeriesModel } from '../../_template/seriesModel'
import { meansText } from '../../_template/text'
import type { PageContext } from '../../define'
import { FuelWords } from './FuelWords'
import { GW, MW, PRICE_COLOR, latestFullSum, latestOf, levelsOf, pricePairs, priceSeries, priceSplit, sameClock, unitLines, unitShown, type PriceSeries, type UnitLine } from './figures'

function PriceItem({ ctx, price, at }: { ctx: PageContext; price: PriceSeries | null; at: number | undefined }) {
  const rel = ctx.related.price
  if (!rel) return null
  const { model, def } = price ?? { model: null, def: null }
  const atValue = model && def && at !== undefined ? model.rows.find((r) => r.t === at)?.[def.field] : undefined
  const latest = model && def ? latestOf(model, def) : null
  const shown = typeof atValue === 'number' ? { t: at as number, v: atValue } : latest
  const banded = def !== null && def.min !== null && def.min < 0 && ctx.mode === 'chart'
  return (
    <>
      <ul className="gf-series-key">
        <li>
          <button type="button" disabled>
            <KeyList items={[{ key: 'price', mark: { kind: 'line', color: PRICE_COLOR, dashed: ctx.fixture }, label: <span className="gf-series-name">Market index price</span> }]} />
            <span className="gf-series-value">{shown && def ? def.unit.format(shown.v) : '–'}</span>
          </button>
          {shown && model && shown.t !== at && <span className="gf-series-when">{periodName(shown.t, model.stepMs, model.settlement)}</span>}
        </li>
      </ul>
      {banded && <KeyList items={[{ key: 'below', mark: { kind: 'band' }, label: 'Market index price below zero' }]} />}
      {!price && (rel.state === 'error' || rel.state === 'refreshing') && (
        <p className="gf-hint">
          The price couldn’t be read. <ErrorWords error={rel.error} />
        </p>
      )}
      {!price && rel.state !== 'error' && rel.state !== 'refreshing' && <p className="gf-hint">No market index price is held in this window.</p>}
    </>
  )
}

/** The fuels in the key's order, top of the stack first, each with its units, largest first. */
function fuelGroups(lines: UnitLine[]): { label: string; lines: UnitLine[] }[] {
  const out: { label: string; lines: UnitLine[] }[] = []
  for (const l of [...lines].reverse()) {
    const g = out.find((x) => x.label === l.fuel.label)
    if (g) g.lines.push(l)
    else out.push({ label: l.fuel.label, lines: [l] })
  }
  return out
}

function UnitItem({ ctx, model, line, at, focus }: { ctx: PageContext; model: SeriesModel; line: UnitLine; at: number | undefined; focus: string | undefined }) {
  const on = focus === line.id
  const atValue = at === undefined ? undefined : model.rows.find((r) => r.t === at)?.[line.def.field]
  const shown = typeof atValue === 'number' ? { t: at as number, v: atValue } : latestOf(model, line.def)
  return (
    <li className={on ? 'is-focus' : focus ? 'is-muted' : undefined}>
      <button type="button" aria-pressed={on} onClick={() => ctx.setFocus(on ? undefined : line.id)}>
        <KeyList items={[{ key: line.id, mark: { kind: 'swatch', color: line.fuel.color }, label: <code className="gf-series-name">{line.id}</code> }]} />
        <span className="gf-series-value">{shown ? MW.format(shown.v) : '–'}</span>
      </button>
      {shown && shown.t !== at && <span className="gf-series-when">{periodName(shown.t, model.stepMs, model.settlement)}</span>}
    </li>
  )
}

function TopKey({ ctx, model }: { ctx: PageContext; model: SeriesModel }) {
  const lines = unitLines(ctx).filter((l) => l.def.count > 0)
  if (!lines.length) return <p className="gf-hint">No unit holds a start level in this window, so there is nothing to key.</p>
  const n = lines.length
  const full = latestFullSum(model, lines)
  const at = full?.t
  const focus = lines.find((l) => l.id === ctx.focus)?.id
  const when = (t: number) => periodName(t, model.stepMs, model.settlement)
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : 'half-hours'
  const price = priceSeries(ctx)
  return (
    <>
      {full ? (
        <dl className="gf-stats">
          <div>
            <dt>{model.bucketed ? `Sum of the ${n}, latest mean` : `Sum of the ${n}`}</dt>
            <dd>
              {GW.format(full.sum * GW.factor)}
              <span className="gf-stat-when">{when(full.t)}</span>
            </dd>
          </div>
        </dl>
      ) : (
        <p className="gf-hint">No one of the {noun} in this window holds a level for all {n} units, so there is no sum; each unit shows its own latest.</p>
      )}
      {fuelGroups(lines).map((g) => {
        const part = full?.byFuel.get(g.label)
        return (
          <div key={g.label} className="gf-pn-fuel">
            <p className="gf-hint">
              {g.label}
              {part !== undefined ? `, ${GW.format(part * GW.factor)}` : ''}
            </p>
            <ul className="gf-series-key">
              {g.lines.map((l) => (
                <UnitItem key={l.id} ctx={ctx} model={model} line={l} at={at} focus={focus} />
              ))}
            </ul>
          </div>
        )
      })}
      <p className="gf-hint">
        {full
          ? `Listed as they stack, top first: each unit’s start level ${model.bucketed ? 'in that period' : 'at that half-hour'}, in MW, and each fuel’s part of the sum, in GW. `
          : 'Listed as they stack, top first: each unit’s latest start level, in MW. '}
        {ctx.mode === 'chart'
          ? focus
            ? 'Select it again to draw them all.'
            : 'Select a unit to draw it alone.'
          : focus
            ? 'Select it again to list them all.'
            : 'Select a unit to list its rows alone.'}
      </p>
      <PriceItem ctx={ctx} price={price} at={at} />
      <FuelWords ctx={ctx} lines={lines} />
    </>
  )
}

function UnitKey({ ctx, model, id }: { ctx: PageContext; model: SeriesModel; id: string }) {
  const line = unitLines(ctx)[0]
  if (!line || !line.def.count) {
    return (
      <p className="gf-hint">
        <code>{id}</code> holds no start level in this window, so there is nothing to key.
      </p>
    )
  }
  const def = line.def
  const latest = latestOf(model, def)
  const ex = extremesOf(model.rows, def)
  const lv = levelsOf(model, def)
  const price = priceSeries(ctx)
  const paired = sameClock(model, price)
  const pairs = paired ? pricePairs(model, def, price) : []
  const split = priceSplit(pairs)
  const when = (t: number) => periodName(t, model.stepMs, model.settlement)
  const noun = model.bucketed && model.stepMs ? meansText(model.stepMs) : 'half-hours'
  const stat = (label: string, value: ReactNode, t?: number) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd>
        {value}
        {t !== undefined && <span className="gf-stat-when">{when(t)}</span>}
      </dd>
    </div>
  )
  return (
    <>
      <KeyList
        items={[
          {
            key: id,
            mark: { kind: 'line', color: line.fuel.color, dashed: ctx.fixture },
            label: (
              <span>
                <code>{id}</code>, {line.fuel.code === null ? line.fuel.label.toLowerCase() : line.fuel.label}
              </span>
            ),
          },
        ]}
      />
      <dl className="gf-stats">
        {latest && stat(model.bucketed ? 'Latest mean start level' : 'Latest start level', MW.format(latest.v), latest.t)}
        {/* A level held flat all window has no highest, lowest or mean apart from it. */}
        {ex && ex.low.v === ex.high.v && stat(model.bucketed ? 'Mean in every period' : 'Level in every half-hour', MW.format(ex.low.v))}
        {ex && ex.low.v !== ex.high.v && (
          <>
            {stat('Highest', MW.format(ex.high.v), ex.high.t)}
            {stat('Lowest', MW.format(ex.low.v), ex.low.t)}
            {def.mean !== null && stat('Mean', MW.format(def.mean))}
          </>
        )}
        {stat('At zero', `${lv.zero.toLocaleString('en-GB')} of ${lv.held.toLocaleString('en-GB')}`)}
        {lv.below > 0 && stat('Below zero', `${lv.below.toLocaleString('en-GB')} of ${lv.held.toLocaleString('en-GB')}`)}
      </dl>
      <p className="gf-hint">
        In MW, over the {plural(lv.held, noun === 'half-hours' ? 'half-hour' : noun, noun)} held in the window.
        {ex && ex.low.v !== ex.high.v ? ' The mean is of their start levels; a half-hour with none held is left out.' : ''}
      </p>
      <PriceItem ctx={ctx} price={price} at={latest?.t} />
      {split.length > 0 && paired && (
        <>
          <dl className="gf-stats">{split.map((s) => stat(`Mean price, ${s.label.toLowerCase()}`, price.def.unit.format(s.mean)))}</dl>
          <p className="gf-hint">
            The market index price, averaged over the {plural(pairs.length, noun === 'half-hours' ? 'half-hour' : noun, noun)} holding both figures, split by where the start level sat: {split.map((s) => `${s.label.toLowerCase()} ${s.n.toLocaleString('en-GB')}`).join(', ')}. Each counts the same.
          </p>
        </>
      )}
      <FuelWords ctx={ctx} lines={[line]} />
    </>
  )
}

export function UnitsKey({ ctx }: { ctx: PageContext }) {
  const one = unitShown(ctx)
  const model = ctx.series
  if (ctx.state === 'empty' || !model) {
    return one ? (
      <p className="gf-hint">
        No rows for <code>{one}</code> in {ctx.windowText}. Check the id, or pick a unit from the list in the toolbar.
      </p>
    ) : (
      <p className="gf-hint">Nothing is held in this window, so there is nothing to key.</p>
    )
  }
  return one ? <UnitKey ctx={ctx} model={model} id={one} /> : <TopKey ctx={ctx} model={model} />
}
