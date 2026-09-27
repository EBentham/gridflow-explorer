/**
 * The Table view of the net positions: one row per zone and quarter-hour
 * held, naming the side the zone is on, with the value as published (no
 * sign). Rows from both reads, oldest first; nothing is netted or filled in.
 */
import { periodLabel } from '../../../design/time'
import { WindowedTable, type TableCol } from '../../_template/WindowedTable'
import type { PageContext } from '../../define'
import { SIDE_LABELS, zonesOf, type Line } from './model'

interface ZoneRow {
  t: number
  step: number | null
  zone: string
  side: string
  v: number
  format: (v: number) => string
}

export function ZoneTable({ ctx }: { ctx: PageContext }) {
  const zones = zonesOf(ctx)
  const rows: ZoneRow[] = []
  const add = (zone: string, line: Line | null, side: string) => {
    if (!line) return
    for (const p of line.points) if (p.v !== null) rows.push({ t: p.t, step: line.step, zone, side, v: p.v, format: line.def.unit.plain })
  }
  for (const z of zones) {
    add(z.name, z.inSide, SIDE_LABELS.in)
    add(z.name, z.outSide, SIDE_LABELS.out)
  }
  if (!rows.length) return <p className="gf-state">Rows are held for this window, but no zone holds a value.</p>
  rows.sort((a, b) => a.t - b.t || a.zone.localeCompare(b.zone))
  const first = zones.map((z) => z.inSide ?? z.outSide).find((l) => l !== null)
  const label = first?.def.unit.label ?? 'unit unconfirmed'
  const columns: TableCol<ZoneRow>[] = [
    { key: 't', label: 'Period', render: (r) => periodLabel(r.t, r.step), sortValue: (r) => r.t },
    { key: 'zone', label: 'Zone', render: (r) => r.zone, sortValue: (r) => r.zone },
    { key: 'side', label: 'The zone is', render: (r) => r.side, sortValue: (r) => r.side },
    { key: 'v', label: `Net position, ${label}, sign unconfirmed`, num: true, render: (r) => r.format(r.v), sortValue: (r) => r.v },
  ]
  const caption = `Net positions, ${ctx.windowText}: ${rows.length.toLocaleString('en-GB')} rows, one per zone and quarter-hour held. Select a column heading to sort.`
  return (
    <>
      <WindowedTable columns={columns} rows={rows} caption={caption} initialSort={{ key: 't', dir: 'asc' }} rowKey={(r) => `${r.t}:${r.zone}:${r.side}`} />
      <p className="gf-hint">Every value is positive, as ENTSO-E publishes it. Which side means the zone is exporting isn’t confirmed, so the table gives the side rather than a sign.</p>
    </>
  )
}
