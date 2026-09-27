/**
 * The supply curve view's working panel: the merit order at the half-hour
 * the main panel draws, one row per unit held, cheapest first, the unit
 * whose cost set the price marked; beside it, how the units' costs were set,
 * as each unit's cost note names every part of its cost. Rank, capacity
 * through the order and cost are the rows' own; nothing is re-derived.
 */
import { Fragment, useMemo } from 'react'
import { fmt0, fmtN, listText, money, plural } from '../../../design/format'
import { periodName } from '../../_template/seriesModel'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { chosenTime, clearingAt, costTerms, curveAt, curveTimes, fuelStyle, fuelWords, fuelsIn, ownRows, termWords, type CostEntry, type CurveUnit } from './figures'

const SYNTHETIC = /^synthetic\b/
const ZERO_FUEL = 'zero_fuel'

/** The fuels an entry covers, in words; `every fuel` when it is all of them at this half-hour. */
function fuelsText(entry: CostEntry, all: number): string {
  if (entry.fuels.length === all) return 'every fuel'
  return listText(entry.fuels.map(fuelWords))
}

function CostAssumptions({ units }: { units: CurveUnit[] }) {
  const { terms, unreadable, missing } = useMemo(() => costTerms(units), [units])
  const fuels = useMemo(() => fuelsIn(units), [units])
  if (!terms.length) {
    return (
      <div>
        <h3 className="gf-stack-h3">How the costs were set</h3>
        <p className="gf-hint">No unit at this half-hour carries a readable cost note, so how its cost was set isn’t shown.</p>
      </div>
    )
  }
  const entries = terms.flatMap((t) => t.entries)
  const allAssumed = entries.every((e) => e.marked === 'assumption')
  const synthetic = terms
    .map((t) => ({ t, e: t.entries.filter((e) => SYNTHETIC.test(e.value)) }))
    .filter(({ e }) => e.length > 0)
    .map(({ t, e }) => {
      const words = (termWords(t.term) ?? t.term).toLowerCase()
      const covered = new Set(e.flatMap((x) => x.fuels))
      return covered.size === fuels.length ? `the ${words}` : `the ${words} of ${listText([...covered].map(fuelWords))} units`
    })
  const zero = terms.find((t) => t.term === 'fuel_price')?.entries.find((e) => e.value === ZERO_FUEL)
  const zeroFuels = zero ? fuels.filter((f) => zero.fuels.includes(f.fuel)) : []

  return (
    <div>
      <h3 className="gf-stack-h3">How the costs were set</h3>
      <p className="gf-hint">
        Each unit’s cost note names where each part of its cost came from{allAssumed ? '; every part of every note is marked an assumption, none a measured source' : ''}. At this half-hour:
      </p>
      <dl className="gf-facts">
        {terms.map((t) => (
          <div key={t.term}>
            <dt>{termWords(t.term) ?? <code>{t.term}</code>}</dt>
            <dd>
              {t.entries.map((e, i) => (
                <Fragment key={`${e.marked ?? ''}:${e.value}`}>
                  {i > 0 && '; '}
                  <code>{e.value}</code>
                  {!allAssumed && e.marked === 'source' && ' (a source)'}, {fuelsText(e, fuels.length)}
                </Fragment>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      {synthetic.length > 0 && (
        <p className="gf-hint">
          Marked synthetic: {listText(synthetic)}. These are generated figures (the note names its random seed), not prices that traded, so the costs, and the modelled price built on them,
          show how the stack works rather than what fuel and carbon cost.
        </p>
      )}
      {zeroFuels.length > 0 && (
        <p className="gf-hint">
          {listText(zeroFuels.map((f) => `${fuelWords(f.fuel)} (${f.low === f.high ? `${money(f.low, 2)}` : `${money(f.low, 2)} to ${money(f.high, 2)}`}/MWh)`))} carry no fuel price at all: the note
          records zero, as an assumption.
        </p>
      )}
      {(missing > 0 || unreadable > 0) && (
        <p className="gf-hint">
          {missing > 0 && `${plural(missing, 'unit carries', 'units carry')} no cost note. `}
          {unreadable > 0 && `${plural(unreadable, 'unit’s note', 'units’ notes')} couldn’t be read.`}
        </p>
      )}
    </div>
  )
}

export function MeritOrder({ ctx }: { ctx: PageContext }) {
  const rows = ownRows(ctx)
  const times = useMemo(() => curveTimes(rows), [rows])
  const at = chosenTime(ctx.param('at'), times)
  const units = useMemo(() => (at === null ? [] : curveAt(rows, at)), [rows, at])
  const model = ctx.series
  if (!model || model.bucketed) return <p className="gf-hint">A merit order is one half-hour’s: choose one day in the range to list each half-hour’s.</p>
  if (at === null || !units.length) return <p className="gf-hint">No unit’s cost is held for this half-hour, so there is no merit order to list.</p>

  const clearing = clearingAt(ctx, at)
  const marginal = clearing?.atFloor === false ? clearing.unit : null
  const columns: TableCol<CurveUnit>[] = [
    { key: 'rank', label: 'Rank', num: true, render: (u) => u.rank, sortValue: (u) => u.rank },
    { key: 'unit', label: 'Unit', render: (u) => <code>{u.unit}</code>, sortValue: (u) => u.unit },
    {
      key: 'fuel',
      label: 'Fuel',
      render: (u) => {
        const style = fuelStyle(u.fuel)
        return (
          <>
            <span className="gf-swatch gf-stack-swatch" style={{ background: style.color }} aria-hidden="true" />
            {style.label}
          </>
        )
      },
      sortValue: (u) => fuelStyle(u.fuel).label,
    },
    { key: 'available', label: 'Available, MW', num: true, render: (u) => fmt0(u.available), sortValue: (u) => u.available },
    { key: 'through', label: 'Through the order, MW', num: true, render: (u) => fmt0(u.cumulative), sortValue: (u) => u.cumulative },
    { key: 'cost', label: 'Marginal cost, £/MWh', num: true, render: (u) => fmtN(u.cost, 2), sortValue: (u) => u.cost },
  ]
  const caption = (
    <>
      The merit order at {periodName(at, model.stepMs, model.settlement)}: {plural(units.length, 'unit', 'units')}, cheapest first
      {marginal ? (
        <>
          ; <code>{marginal}</code>, whose cost set the price, is marked
        </>
      ) : clearing?.atFloor === true ? (
        '; the price floor, not a unit, set the price'
      ) : (
        ''
      )}
      . Select a column heading to sort.
    </>
  )

  return (
    <div className="gf-stack-split">
      <WindowedTable
        columns={columns}
        rows={units}
        caption={caption}
        initialSort={{ key: 'rank', dir: 'asc' }}
        rowKey={(u) => u.unit}
        rowClass={(u) => (u.unit === marginal ? 'is-marginal' : undefined)}
        maxHeight={360}
      />
      <CostAssumptions units={units} />
    </div>
  )
}
