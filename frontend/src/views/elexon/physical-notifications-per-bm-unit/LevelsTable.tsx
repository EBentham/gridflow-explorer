/**
 * The Table view: the rows as read, one per half-hour and unit (or, for one
 * unit, per half-hour), with both levels as gridflow holds them, each unit's
 * fuel, and, for one unit, the market index price of the same half-hour
 * beside its levels. Settlement date and period come from the rows. A dash
 * is a half-hour with no value held; nothing is filled in.
 */
import type { ReactNode } from 'react'
import { periodLabel } from '../../../design/time'
import type { SeriesRow, SeriesRowsResponse } from '../../contract'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { END, MW, START, UNIT, focusedLine, fuelFor, fuelLookup, num, priceAt, priceSeries, sameClock, unitLines, unitShown } from './figures'

const dash = <span className="gf-cell-missing">–</span>

const level = (v: number | null): ReactNode => (v === null ? dash : MW.plain(v))

export function LevelsTable({ ctx }: { ctx: PageContext }) {
  const model = ctx.series
  const response = ctx.response as SeriesRowsResponse | null
  if (!model || !response) return null
  const one = unitShown(ctx)
  const lookup = fuelLookup(ctx)
  const lines = unitLines(ctx)
  const order = new Map(lines.map((l, i) => [l.id, i]))
  // A unit selected in the key lists its rows alone, as the chart draws it alone.
  const focus = one ? undefined : focusedLine(ctx, lines)
  const price = priceSeries(ctx)
  const prices = one && sameClock(model, price) ? priceAt(price) : null
  const hasSettlement = response.rows.some((r) => 'settlement_period' in r)
  const idOf = (r: SeriesRow) => (typeof r[UNIT] === 'string' ? (r[UNIT] as string) : null)
  const rows = focus ? response.rows.filter((r) => idOf(r) === focus.id) : response.rows

  const columns: TableCol<SeriesRow>[] = [
    { key: 't', label: model.bucketed ? 'Period (means)' : 'Period', render: (r) => periodLabel(r.ts, model.stepMs), sortValue: (r) => r.ts },
    ...(hasSettlement
      ? [
          { key: 'sd', label: 'Settlement date', render: (r: SeriesRow) => r.settlement_date ?? dash, sortValue: (r: SeriesRow) => r.settlement_date ?? null },
          { key: 'sp', label: 'SP', num: true, render: (r: SeriesRow) => r.settlement_period ?? dash, sortValue: (r: SeriesRow) => r.settlement_period ?? null },
        ]
      : []),
    ...(one
      ? []
      : [
          {
            key: 'unit',
            label: 'Unit',
            render: (r: SeriesRow) => {
              const id = idOf(r)
              return id ? <code>{id}</code> : dash
            },
            sortValue: (r: SeriesRow) => idOf(r),
          },
          {
            key: 'fuel',
            label: 'Fuel',
            render: (r: SeriesRow) => {
              const id = idOf(r)
              return id ? fuelFor(lookup, id).label : dash
            },
            // Stack order: fuel by fuel, as the chart and the key run.
            sortValue: (r: SeriesRow) => {
              const id = idOf(r)
              return id ? (order.get(id) ?? null) : null
            },
          },
        ]),
    { key: 'start', label: `Start level, ${MW.label}`, num: true, render: (r) => level(num(r[START])), sortValue: (r) => num(r[START]) },
    { key: 'end', label: `End level as kept, ${MW.label}`, num: true, render: (r) => level(num(r[END])), sortValue: (r) => num(r[END]) },
    ...(prices && price
      ? [
          {
            key: 'price',
            label: `Market index price, ${price.def.unit.label}`,
            num: true,
            render: (r: SeriesRow) => {
              const v = prices.get(r.ts)
              return v === undefined ? dash : price.def.unit.plain(v)
            },
            sortValue: (r: SeriesRow) => prices.get(r.ts) ?? null,
          },
        ]
      : []),
  ]

  const units = one ? null : new Set(response.rows.map(idOf).filter((x) => x !== null)).size
  const what = one ? `Notified levels of ${one}` : focus ? `Notified levels of ${focus.id}, one of the top ${units} units` : `Notified levels of the top ${units} units`
  const per = one || focus ? (model.bucketed ? 'period' : 'half-hour') : model.bucketed ? 'period and unit' : 'half-hour and unit'
  const caption = `${what}, ${ctx.windowText}: ${rows.length.toLocaleString('en-GB')} rows, one per ${per}. Select a column heading to sort.`
  return (
    <>
      <WindowedTable
        columns={columns}
        rows={rows}
        caption={caption}
        initialSort={{ key: 't', dir: 'asc' }}
        rowKey={(r, i) => `${r.ts}:${idOf(r) ?? i}`}
        // Beside the top units' key, which lists every unit under its fuel, the table takes the height to match.
        maxHeight={one ? undefined : 830}
      />
      <p className="gf-hint">
        Both levels in MW, as gridflow holds them. A dash is a half-hour with no value held.
        {focus ? ` Only ${focus.id}’s rows: select it again in the key to list all ${units} units.` : ''}
        {one && price && !prices ? ' The market index price comes at another step in this window, so it isn’t set beside the levels.' : ''}
        {one && prices ? ' The market index price is the same half-hour’s, where it is held.' : ''}
      </p>
    </>
  )
}
