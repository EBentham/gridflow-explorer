/**
 * The by-fuel main panel. In the Chart view: each delivery day's forecast
 * usable output, the fuel bands stacked in GW, one point per day; a band
 * selected in the key is drawn alone. In the Table view: the rows as read,
 * one per delivery day and fuel code, in MW, with the issue behind each.
 */
import type { ReactNode } from 'react'
import { fmtDay, instantLabel, windowDomain } from '../../../design/time'
import { SeriesChart } from '../../_template/SeriesChart'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { MW, bandId, bandOf, bandsIn, codeName, daysAhead, daysOf, rowsOf, stackPanel, type Row } from './figures'

const dash = <span className="gf-cell-missing">–</span>

function FuelTable({ ctx }: { ctx: PageContext }) {
  const rows = rowsOf(ctx.response)
    .filter((r) => r.mw !== null)
    .sort((a, b) => a.date.localeCompare(b.date) || bandOf(a.code).order - bandOf(b.code).order || (a.code ?? '').localeCompare(b.code ?? ''))
  const cell = (v: ReactNode | null) => v ?? dash
  const columns: TableCol<Row>[] = [
    { key: 'date', label: 'Delivery day', render: (r) => fmtDay(r.date), sortValue: (r) => r.date },
    { key: 'code', label: 'Fuel code', render: (r) => cell(r.code && <code>{r.code}</code>), sortValue: (r) => r.code },
    { key: 'band', label: 'Fuel', render: (r) => (r.code ? codeName(r.code) : dash), sortValue: (r) => bandOf(r.code).order },
    { key: 'mw', label: `Usable output, ${MW.label}`, num: true, render: (r) => (r.mw === null ? dash : MW.plain(r.mw)), sortValue: (r) => r.mw },
    { key: 'issued', label: 'Issued', render: (r) => (r.issued === null ? dash : instantLabel(r.issued)), sortValue: (r) => r.issued },
    { key: 'ahead', label: 'Days ahead', num: true, render: (r) => (r.issued === null ? dash : daysAhead(r.date, r.issued)), sortValue: (r) => (r.issued === null ? null : daysAhead(r.date, r.issued)) },
  ]
  return (
    <WindowedTable
      columns={columns}
      rows={rows}
      rowKey={(r, i) => `${r.date}:${r.code ?? i}`}
      caption={`${rows.length.toLocaleString('en-GB')} rows, one per delivery day and fuel code, as read. Select a column heading to sort.`}
      maxHeight={600}
    />
  )
}

export function FuelMain({ ctx }: { ctx: PageContext }) {
  if (ctx.mode === 'table') return <FuelTable ctx={ctx} />
  const w = ctx.window
  const days = daysOf(ctx.response, w, 'code')
  const bands = bandsIn(days)
  if (!w || !bands.length) return <p className="gf-state">Rows are held for this window, but none holds a figure to draw. The table lists them.</p>
  const focus = bands.find((b) => bandId(b) === ctx.focus)
  const missing = days.filter((d) => d.held === 0).length
  return (
    <>
      <SeriesChart panels={[stackPanel(days, bands, 560)]} domain={windowDomain(w.start, w.end)} focus={ctx.focus} picked={ctx.picked} onPick={ctx.pick} fixture={ctx.fixture} />
      <p className="gf-hint">
        {focus
          ? `${focus.label} alone: its forecast usable output for each delivery day, in GW. Select it again in the key to draw every fuel.`
          : 'Each band is one fuel’s forecast usable output for the delivery day, in GW, summed over Elexon’s fuel codes in it; the top of the stack counts every code, interconnectors included.'}{' '}
        One point per delivery day, at its UK midnight; the lines between them only join the days.
        {missing > 0 ? ` A gap is a day with no forecast held locally (${missing} in this window).` : ''} Select a day to read it in the key.
      </p>
    </>
  )
}
