/**
 * The supply curve view's key: the reference lines' marks; each fuel in the
 * stack at the half-hour shown, cheapest first, with its capacity, units and
 * cost range; then where the stack clears against the market index. Figures
 * are the rows' own for that half-hour.
 */
import { useMemo } from 'react'
import { KeyList } from '../../../design/charts'
import { fmt1, listText, money, plural } from '../../../design/format'
import { periodName } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { FLOOR_STYLE, MARKET_COLOR, MODEL_COLOR, chosenTime, clearingAt, curveAt, curveTimes, fuelWords, fuelsIn, gapOf, marketAt, ownRows } from './figures'

/** A sentence's first letter capitalised. */
const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const costRange = (low: number, high: number) => (low === high ? `${money(low, 2)}/MWh` : `${money(low, 2)}–${money(high, 2)}/MWh`)

export function CurveKey({ ctx }: { ctx: PageContext }) {
  const rows = ownRows(ctx)
  const times = useMemo(() => curveTimes(rows), [rows])
  const at = chosenTime(ctx.param('at'), times)
  const units = useMemo(() => (at === null ? [] : curveAt(rows, at)), [rows, at])
  const model = ctx.series
  if (!model || model.bucketed || at === null || !units.length) return <p className="gf-hint">No curve is drawn for this window, so there is nothing to key.</p>
  const fuels = fuelsIn(units)
  const total = units[units.length - 1].cumulative
  const clearing = clearingAt(ctx, at)
  const market = marketAt(ctx, at)
  const gap = clearing ? gapOf({ ...clearing, market }) : null
  const coal = fuels.find((f) => f.fuel === 'COAL')
  const chart = ctx.mode === 'chart'
  // Fuels the design draws in one colour (coal and OCGT are both its peaking band).
  const sharing = [...new Set(fuels.map((f) => f.style.color))].map((c) => fuels.filter((f) => f.style.color === c)).filter((g) => g.length > 1)

  return (
    <>
      {chart && (
        <KeyList
          items={[
            { key: 'market', mark: { kind: 'line', color: MARKET_COLOR }, label: 'Market index price' },
            { key: 'model', mark: { kind: 'line', color: MODEL_COLOR }, label: 'Clearing demand, and the price the stack clears at' },
          ]}
        />
      )}
      <p className="gf-hint">For {periodName(at, model.stepMs, model.settlement)}. Cheapest fuel first; capacity is what the rows say is available.</p>
      <dl className="gf-stats">
        {fuels.map((f) => (
          <div key={f.fuel ?? ''}>
            <dt>
              <span className="gf-swatch gf-stack-swatch" style={{ background: f.style.color }} aria-hidden="true" />
              {f.style.label}
            </dt>
            <dd>
              {fmt1(f.mw / 1000)} GW
              <span className="gf-stat-when">
                {plural(f.units, 'unit', 'units')}, {costRange(f.low, f.high)}
              </span>
            </dd>
          </div>
        ))}
        <div>
          <dt>In the stack</dt>
          <dd>
            {fmt1(total / 1000)} GW
            <span className="gf-stat-when">{plural(units.length, 'unit', 'units')}, through the merit order</span>
          </dd>
        </div>
      </dl>
      {chart && sharing.length > 0 && (
        <p className="gf-hint">
          {sentence(sharing.map((g) => `${listText(g.map((f) => fuelWords(f.fuel)))} share a colour`).join('; '))}: hover a block, or read the merit order below, for each unit’s fuel.
        </p>
      )}
      {clearing && (
        <dl className="gf-stats">
          <div>
            <dt>Clearing demand</dt>
            <dd>{clearing.demand === null ? 'not held' : `${fmt1(clearing.demand / 1000)} GW`}</dd>
          </div>
          <div>
            <dt>Set by</dt>
            <dd>
              {clearing.atFloor === true ? (
                FLOOR_STYLE.label
              ) : clearing.unit ? (
                <>
                  <code>{clearing.unit}</code>
                  <span className="gf-stat-when">a {fuelWords(clearing.fuel)} unit</span>
                </>
              ) : (
                'not named'
              )}
            </dd>
          </div>
          <div>
            <dt>Modelled price</dt>
            <dd>{clearing.model === null ? 'not held' : money(clearing.model, 2)}</dd>
          </div>
          <div>
            <dt>Market index price</dt>
            <dd>{market === null ? 'not held' : money(market, 2)}</dd>
          </div>
          {gap !== null && (
            <div>
              <dt>Modelled minus market</dt>
              <dd>{money(gap, 2)}</dd>
            </div>
          )}
        </dl>
      )}
      {coal && (
        <p className="gf-hint">
          The stack counts {plural(coal.units, 'unit', 'units')} the model maps to coal, {fmt1(coal.mw / 1000)} GW in all, though GB’s last coal plant closed in 2024: read them as the model’s unit list, not coal
          plant that could run.
        </p>
      )}
    </>
  )
}
