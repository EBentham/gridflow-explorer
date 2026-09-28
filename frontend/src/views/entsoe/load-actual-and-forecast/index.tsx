/**
 * ENTSO-E's load family: electricity load in four of GB's continental
 * neighbours, per quarter-hour. Actual load (`actual_load`) opens the page,
 * one line per zone, with the day-ahead forecast (`load_forecast`) read
 * beside it; the day-ahead forecast gets the same page the other way round.
 * The working panel sets one zone's actual against its forecast, with the
 * error as bars, then compares the zones and the zone's days (`ForecastPanel`).
 * The week-, month- and year-ahead forecasts are held but left out: each
 * keeps one of the two figures ENTSO-E publishes per period without saying
 * which.
 */
import { SourceLine } from '../../_template/panels'
import { keyStamp, relatedFilters, type SourcePart } from '../../_template/panelHelpers'
import { periodLabel } from '../../../design/time'
import type { PageContext, SlotSpec } from '../../define'
import { defineView } from '../../define'
import { AboutLoad } from './AboutLoad'
import { ACTUAL, ACTUAL_ID, ACTUAL_KEY, AREA, AXIS_WIDTH, FORECAST, FORECAST_ID, FORECAST_KEY, ZONES, zoneInView, zoneName } from './figures'
import { ForecastPanel } from './ForecastPanel'
import { ZoneKey } from './ZoneKey'

/** The other dataset, named in full in a source line. */
function otherPart(ctx: PageContext): SourcePart[] {
  const key = ctx.dataset.id === ACTUAL_ID ? FORECAST_KEY : ACTUAL_KEY
  const rel = ctx.related[key]
  if (!rel) return []
  return [{ source: rel.source, dataset: rel.spec.dataset, columns: [key === FORECAST_KEY ? FORECAST : ACTUAL], by: AREA, filters: relatedFilters(rel), unit: 'GW' }]
}

const ownColumn = (ctx: PageContext) => (ctx.dataset.id === ACTUAL_ID ? ACTUAL : FORECAST)
/** A custom key line drops the template's stamp, so it names the latest step held here. */
const latestText = (ctx: PageContext) => {
  const stamp = keyStamp(ctx)
  return stamp ? `, ${periodLabel(stamp.t, stamp.stepMs)}` : ''
}
const zoneText = (ctx: PageContext) => {
  const z = zoneInView(ctx)
  return z ? zoneName(z) : 'one zone'
}

const panels: { key: SlotSpec; working: SlotSpec; side: SlotSpec } = {
  key: {
    title: 'Key',
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[ownColumn(ctx)]}
        by={AREA}
        unit="GW"
        also={otherPart(ctx)}
        what={`each zone's latest value held${latestText(ctx)}, then ${zoneText(ctx)}'s peak, trough and largest misses in MW`}
      />
    ),
    Body: ZoneKey,
  },
  working: {
    title: (ctx) => (ctx.mode === 'chart' ? `${zoneText(ctx)}: actual against forecast, and the zones` : 'Actual against forecast, by zone and day'),
    src: (ctx) => (
      <SourceLine
        ctx={ctx}
        columns={[ownColumn(ctx)]}
        by={AREA}
        unit="GW"
        also={otherPart(ctx)}
        what={
          ctx.mode === 'chart'
            ? `${zoneText(ctx)} per quarter-hour with actual less forecast in MW, then each zone over the window and ${zoneText(ctx)}'s UK days`
            : `actual less forecast in MW, for each zone over the window, then ${zoneText(ctx)}'s UK days`
        }
      />
    ),
    Body: ForecastPanel,
  },
  side: {
    title: 'About this data',
    Body: AboutLoad,
  },
}

const view = defineView({
  title: 'Load, actual and forecast',
  sub: 'How much electricity four of GB’s continental neighbours drew each quarter-hour, and the forecast of it published the day before.',
  caveats: [
    'The four zones are Germany-Luxembourg, France, the Netherlands and Belgium. ENTSO-E hasn’t published GB’s load since Brexit, so GB isn’t here; they matter to GB through the interconnectors, and About links GB’s own demand.',
    'Each quarter-hour holds one day-ahead forecast, as ENTSO-E showed it when gridflow fetched it. Earlier versions aren’t kept, and the rows don’t say when the forecast was made.',
    'The chart reads the zones on the UK clock, an hour behind their own Central European time: 19:00 there reads 18:00 here.',
    'The Netherlands’ actual load runs well below its day-ahead forecast in the September rows held, by about a fifth of its load, where the other three zones miss by a few per cent. The rows don’t say why, so that gap may not be the forecast’s miss alone.',
    'ENTSO-E’s week-ahead, month-ahead and year-ahead forecasts are held too, but not drawn. ENTSO-E publishes each as two figures per day or week, the lowest and the highest load expected, and the copy held here keeps only one of the two without recording which. Drawn, it could be read as either, so the page leaves them out until both are kept.',
  ],
  datasets: [
    {
      id: ACTUAL_ID,
      body: 'series',
      label: 'Actual load',
      title: 'Actual load per quarter-hour, by zone',
      query: { group: AREA },
      values: [{ column: ACTUAL, label: 'Actual load' }],
      groups: ZONES,
      related: [
        {
          key: FORECAST_KEY,
          source: 'entsoe',
          dataset: FORECAST_ID,
          label: 'Day-ahead forecast',
          query: { group: AREA },
          values: [{ column: FORECAST, label: 'Day-ahead forecast' }],
          groups: ZONES,
        },
      ],
      chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
      panels,
    },
    {
      id: FORECAST_ID,
      body: 'series',
      label: 'Day-ahead forecast',
      title: 'Day-ahead load forecast per quarter-hour, by zone',
      sub: 'ENTSO-E’s forecast, made the day before, of how much electricity four of GB’s continental neighbours would draw each quarter-hour.',
      query: { group: AREA },
      values: [{ column: FORECAST, label: 'Day-ahead forecast' }],
      groups: ZONES,
      related: [
        {
          key: ACTUAL_KEY,
          source: 'entsoe',
          dataset: ACTUAL_ID,
          label: 'Actual load',
          query: { group: AREA },
          values: [{ column: ACTUAL, label: 'Actual load' }],
          groups: ZONES,
        },
      ],
      chart: { mark: 'line', lower: false, axisWidth: AXIS_WIDTH },
      panels,
    },
  ],
})

export default view
