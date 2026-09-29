/**
 * The by-unit main panel. In the Chart view, by default: every unit's
 * forecast usable output summed fuel by fuel per delivery day, in GW, with
 * the units' total less Elexon's own by-fuel figure under it in MW; a band
 * selected in the key is drawn alone. With one unit asked for (`?unit=`):
 * its figure per delivery day, in MW. In the Table view: the rows holding a value,
 * one per delivery day and unit, or the one unit's.
 */
import type { ReactNode } from 'react'
import { fmtDay, instantLabel, windowDomain } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import { ErrorWords } from '../../_template/panels'
import type { PageContext } from '../../define'
import { FUEL_KEY, MW, bandId, bandOf, bandsIn, barsPanel, codeName, daysAhead, daysOf, linePanel, rowsOf, stackPanel, totalDiffs, heldShape, loneWords, unitKey, unitShown, type Row } from './figures'
import { OneDayWords } from './OneDay'

const dash = <span className="gf-cell-missing">–</span>

function UnitsTable({ ctx }: { ctx: PageContext }) {
  const one = unitShown(ctx)
  // The backend sends a row with no value for each unit on a day it holds nothing for; the table lists the rows holding one.
  const all = rowsOf(ctx.response).filter((r) => r.mw !== null)
  const rows = one ? all.filter((r) => unitKey(r) === one.key) : all
  const id = (r: Row): ReactNode => (r.unit ? <code>{r.unit}</code> : dash)
  const columns: TableCol<Row>[] = [
    { key: 'date', label: 'Delivery day', render: (r) => fmtDay(r.date), sortValue: (r) => r.date },
    ...(one ? [] : [{ key: 'unit', label: 'BM unit', render: id, sortValue: (r: Row) => r.unit }]),
    { key: 'ng', label: 'National Grid id', render: (r) => (r.ng ? <code>{r.ng}</code> : dash), sortValue: (r) => r.ng },
    { key: 'code', label: 'Fuel code', render: (r) => (r.code ? <code>{r.code}</code> : dash), sortValue: (r) => r.code },
    { key: 'fuel', label: 'Fuel', render: (r) => (r.code ? codeName(r.code) : dash), sortValue: (r) => bandOf(r.code).order },
    { key: 'mw', label: `Usable output, ${MW.label}`, num: true, render: (r) => (r.mw === null ? dash : MW.plain(r.mw)), sortValue: (r) => r.mw },
    { key: 'issued', label: 'Issued', render: (r) => (r.issued === null ? dash : instantLabel(r.issued)), sortValue: (r) => r.issued },
    { key: 'ahead', label: 'Days ahead', num: true, render: (r) => (r.issued === null ? dash : daysAhead(r.date, r.issued)), sortValue: (r) => (r.issued === null ? null : daysAhead(r.date, r.issued)) },
  ]
  return (
    <WindowedTable
      columns={columns}
      rows={rows}
      rowKey={(r, i) => `${r.date}:${unitKey(r)}:${i}`}
      initialSort={{ key: 'date', dir: 'asc' }}
      caption={`${rows.length.toLocaleString('en-GB')} rows holding a value, one per delivery day${one ? '' : ' and unit'}; a day with none is left out. Select a column heading to sort.`}
      maxHeight={600}
    />
  )
}

function DiffWords({ ctx }: { ctx: PageContext }) {
  const rel = ctx.related[FUEL_KEY]
  if (!rel) return null
  if (rel.state === 'error' || rel.state === 'refreshing') {
    return (
      <p className="gf-hint">
        Elexon’s by-fuel forecast couldn’t be read, so the units aren’t set against it. <ErrorWords error={rel.error} />
      </p>
    )
  }
  return null
}

export function UnitsMain({ ctx }: { ctx: PageContext }) {
  if (ctx.mode === 'table') return <UnitsTable ctx={ctx} />
  const w = ctx.window
  if (!w) return null
  const domain = windowDomain(w.start, w.end)
  const asked = ctx.param('unit')
  const one = unitShown(ctx)
  if (asked && !one) {
    return (
      <p className="gf-state">
        No unit <code>{asked}</code> is listed in {ctx.windowText}. Pick one from the list in the toolbar or the table below.
      </p>
    )
  }
  const days = daysOf(ctx.response, w, 'unit')
  if (one) {
    const points = days.map((d) => ({ t: d.mid, v: one.byDate.get(d.date)?.mw ?? null }))
    return (
      <>
        <SeriesChart panels={[linePanel(points, one.id ?? one.key, one.band.color, 380)]} domain={domain} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
        <p className="gf-hint">
          The usable output forecast for <code>{one.id}</code> on each delivery day, in MW: one point per day, the lines between them only joining the days. A gap is a day the forecast doesn’t list the unit.
        </p>
      </>
    )
  }
  const bands = bandsIn(days)
  if (!bands.length) return <p className="gf-state">Rows are held for this window, but none holds a figure to draw. The table lists them.</p>
  const shape = heldShape(days)
  if (shape.held === 1) return <OneDayWords day={days.find((d) => d.held > 0)} where="the side panel" />
  const fuelDays = daysOf(ctx.related[FUEL_KEY]?.response, w, 'code')
  const diffs = totalDiffs(days, fuelDays)
  const compared = diffs.some((d) => d.v !== null)
  const focus = bands.find((b) => bandId(b) === ctx.focus)
  const panels = [stackPanel(days, bands, compared ? 400 : 470), ...(compared ? [barsPanel(diffs, 'Units’ total less the by-fuel total', 150)] : [])]
  return (
    <>
      <SeriesChart panels={panels} domain={domain} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      <p className="gf-hint">
        {focus
          ? `${focus.label} alone: the sum of its units’ forecast usable output for each delivery day, in GW. Select it again in the key to draw every fuel.`
          : 'Each band is the sum of the forecast usable output of the units listing that fuel, in GW, per delivery day; the top of the stack is every unit listed that day.'}{' '}
        One point per delivery day, at the middle of its UK day, the lines between them only joining the days; a gap is a day with no unit listed.
        {loneWords(shape.lone, 'the Table view')}
        {compared ? ' Under it, in MW, the units’ total less Elexon’s by-fuel total for the same day: the two are issued apart, so the difference is not only units missing from the list.' : ''}
      </p>
      <DiffWords ctx={ctx} />
    </>
  )
}
