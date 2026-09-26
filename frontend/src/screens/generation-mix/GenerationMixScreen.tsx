/**
 * Generation mix (pinned): Elexon FUELHH, half-hourly GB transmission-
 * connected generation by fuel type, from the live backend. The frame is
 * DESIGN §5: the stacked chart with the fuel key beside it, then the mean
 * mix of a picked day and the days in the window.
 */
import { useMemo, useState } from 'react'
import { FetchBanner } from '../../components/FetchBanner'
import { DataTable, FuelKey } from '../../design/charts'
import { daysInWindow, partialDays } from '../../design/days'
import { fmt1, pct } from '../../design/format'
import { Head, Panel, PendingNote, RangeControl, Screen, StatusNote, Toolbar, ViewSwitch, type ChartOrTable } from '../../design/frame'
import { FUEL_BANDS, toMixRows } from '../../design/fuels'
import { emptyRangeText } from '../../design/range'
import { clock, dayLabel, halfHourWindow, rangeText, windowDomain } from '../../design/time'
import { useLiveDataset } from '../../hooks/useLiveDataset'
import { GenerationChart } from './GenerationChart'
import { MixBar } from './MixBar'
import { meanMix, meanTotal, share } from './mix'

const DATASET = (
  <>
    Elexon <code>fuelhh</code>
  </>
)

export function GenerationMixScreen() {
  const live = useLiveDataset('generation-mix')
  const { range } = live.range
  const rows = useMemo(() => toMixRows(live.records, 'timestamp'), [live.records])
  const days = useMemo(() => (range ? daysInWindow(rows, range) : []), [rows, range])
  const domain = useMemo(() => (range ? windowDomain(range.start, range.end) : null), [range])
  const [focus, setFocus] = useState<string | undefined>()
  const [view, setView] = useState<ChartOrTable>('chart')
  const [picked, setPicked] = useState<number | undefined>()

  const held = days.filter((d) => d.rows.length > 0)
  const day = held.find((d) => d.start === picked) ?? held.at(-1)
  const means = useMemo(() => meanMix(day?.rows ?? []), [day])
  const latest = rows.at(-1)
  const focusBand = FUEL_BANDS.find((b) => b.key === focus)
  const windowText = range ? rangeText(range.start, range.end) : ''
  const partial = partialDays(days)
  const ready = live.state === 'data' && domain !== null
  // The range has been read, rows or none: the days list can say which days are missing.
  const read = range !== null && (live.state === 'data' || live.state === 'empty')

  const columns = [{ key: 't', label: 'Half-hour' }, ...FUEL_BANDS.map((b) => ({ key: b.key, label: `${b.label}, GW`, align: 'end' as const }))]
  const tableRows = rows.map((r) => ({
    t: halfHourWindow(r.t),
    ...Object.fromEntries(FUEL_BANDS.map((b) => [b.key, r[b.key] === null ? '–' : fmt1(r[b.key] ?? 0)])),
  }))

  return (
    <Screen state={live.state}>
      <Head
        glyph="pylon"
        title={focusBand ? `Generation mix: ${focusBand.label}` : 'Generation mix'}
        sub="Half-hourly GB transmission-connected generation by fuel type. Pumping and net exports sit below zero."
        stamp={range ? `${windowText}, UK time` : undefined}
      />
      <Toolbar>
        <RangeControl state={live.range} />
        <ViewSwitch value={view} onChange={setView} />
      </Toolbar>
      {range && <FetchBanner key={`${range.start}_${range.end}`} datasetId="generation-mix" source="Elexon" range={range} onComplete={live.reload} />}
      <div className="gf-grid">
        <Panel
          area="main"
          title={focusBand ? `${focusBand.label} generation` : 'Generation by fuel'}
          src={
            <>
              {DATASET}, generation per half-hour by fuel type, GW{windowText && `, ${windowText}`}
            </>
          }
        >
          <StatusNote
            state={live.state}
            error={live.error}
            empty={emptyRangeText(live.range)}
          />
          {ready &&
            (view === 'chart' ? (
              <GenerationChart rows={rows} domain={domain} focus={focus} day={day?.start} onPickDay={setPicked} />
            ) : (
              <DataTable caption={`Generation by fuel per half-hour, GW, ${windowText}`} columns={columns} rows={tableRows} />
            ))}
        </Panel>

        <Panel
          area="key"
          title="Fuel"
          src={
            latest ? (
              <>
                {DATASET}, GW in the half-hour from {clock(latest.t)}, {dayLabel(latest.t)}
              </>
            ) : (
              <>{DATASET}, GW</>
            )
          }
        >
          <FuelKey latest={latest} onPick={setFocus} focus={focus} />
          <p className="gf-hint">{focus ? 'Select the fuel again to return to the full stack.' : 'Select a fuel to draw it on its own.'}</p>
        </Panel>

        <Panel
          area="wide"
          title={day ? `Mean mix, ${dayLabel(day.start)}` : 'Mean mix'}
          src={
            day ? (
              <>
                {DATASET}: mean generation by fuel across the {day.rows.length} half-hours held for {dayLabel(day.start)}, GW
              </>
            ) : (
              <>{DATASET}: mean generation by fuel for one day, GW</>
            )
          }
        >
          {ready && day ? (
            <MixBar means={means} />
          ) : read ? (
            <p className="gf-hint">No day in the window is held locally yet.</p>
          ) : (
            <PendingNote state={live.state} />
          )}
        </Panel>

        <Panel
          area="side"
          title="Days in range"
          src={
            <>
              {DATASET}, mean GW and shares of generation per UK day{windowText && `, ${windowText}`}. Select a day to mark it on the chart and read its mean mix.
            </>
          }
        >
          <PendingNote state={live.state} />
          {read && (
            <div className="gf-days">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col" className="is-num">
                      Mean, GW
                    </th>
                    <th scope="col" className="is-num">
                      Wind
                    </th>
                    <th scope="col" className="is-num">
                      CCGT
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {days.map((d) => {
                    if (d.rows.length === 0) {
                      return (
                        <tr key={d.day} className="is-missing">
                          <th scope="row">{dayLabel(d.start)}</th>
                          <td colSpan={3}>not held locally</td>
                        </tr>
                      )
                    }
                    const on = d.start === day?.start
                    return (
                      <tr key={d.day} className={on ? 'is-on' : undefined}>
                        <th scope="row">
                          <button type="button" aria-pressed={on} onClick={() => setPicked(d.start)}>
                            {dayLabel(d.start)}
                          </button>
                        </th>
                        <td className="is-num">{fmt1(meanTotal(d.rows))}</td>
                        <td className="is-num">{pct(share(d.rows, 'wind'))}</td>
                        <td className="is-num">{pct(share(d.rows, 'gas'))}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {ready && partial.length > 0 && (
            <p className="gf-hint">
              {partial.map((d) => `${dayLabel(d.start)} holds ${d.rows.length} of ${d.expected} half-hours.`).join(' ')}
            </p>
          )}
        </Panel>
      </div>
    </Screen>
  )
}
