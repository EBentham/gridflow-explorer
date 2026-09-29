/**
 * NESO's national carbon intensity (v0.4 P4): how many grams of CO₂ each
 * kWh of GB electricity carried, half-hour by half-hour, as NESO forecast it
 * and as it estimated it afterwards, with NESO's index grade for each
 * half-hour. Only `carbon_intensity` is drawn. The family's other held
 * datasets ask NESO for the same half-hours another way, so the template
 * lists them as held and left out; the two that serve only the present
 * moment (`intensity_current`, `intensity_today`) are named as not held.
 *
 * The main panel (`IntensityMain`) draws the index strip over the two lines;
 * the key (`IntensityKey`) gives the latest half-hour, the window's range and
 * means, and the grades; the working panel (`DaysPanel`) sets the forecast
 * against the estimate per half-hour and per UK day; the side panel
 * (`FamilySide`) adds to About why the rest of the family isn't drawn. The grades' boundaries
 * in gCO₂/kWh aren't held here, so no grade is placed on the value axis
 * (NEEDS.md).
 */
import { SourceLine } from '../../_template/panels'
import { defineView } from '../../define'
import { ACTUAL, AXIS_WIDTH, COLORS, FORECAST, INDEX } from './figures'
import { DaysPanel } from './DaysPanel'
import { FamilySide } from './FamilySide'
import { IntensityKey } from './IntensityKey'
import { IntensityMain } from './IntensityMain'

const UNIT = 'gCO₂/kWh'

const view = defineView({
  title: 'National carbon intensity',
  sub: 'How much CO₂ each kWh of GB electricity carried, half-hour by half-hour: NESO’s forecast, its estimate of what it was, and its index grade for each half-hour.',
  caveats: [
    'The actual is NESO’s estimate of each half-hour’s intensity, made after it.',
    'gridflow keeps one forecast per half-hour: the one NESO gave when gridflow last fetched it, which replaces any fetched before. When that forecast was made isn’t recorded, so the gap between the lines shows how far this forecast sat from the estimate, not how well NESO forecasts a day ahead.',
    'The index (very low, low, moderate, high, very high) is NESO’s own grade for each half-hour, drawn as published. Its boundaries in gCO₂/kWh aren’t held here, nor which of the two figures it grades, so no grade is marked on the value axis.',
    'The rows carry no settlement period. Each half-hour is dated by its start in UTC, shown here on the UK clock.',
  ],
  datasets: [
    {
      id: 'carbon_intensity',
      body: 'series',
      label: 'National',
      title: 'Carbon intensity per half-hour',
      values: [
        { column: ACTUAL, label: 'Estimated actual', color: COLORS.actual },
        { column: FORECAST, label: 'Forecast', color: COLORS.forecast },
        { column: INDEX, label: 'NESO index' },
      ],
      chart: { mark: 'line', extremes: true, lower: false, axisWidth: AXIS_WIDTH },
      panels: {
        main: {
          title: 'Carbon intensity per half-hour',
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[ACTUAL, FORECAST, INDEX]}
              filters={ctx.response?.filters}
              unit={UNIT}
              what={ctx.mode === 'chart' ? 'each half-hour: the estimate and the forecast, NESO’s grade in the strip above' : 'every half-hour held, with NESO’s grade'}
            />
          ),
          Body: IntensityMain,
        },
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[ACTUAL, FORECAST, INDEX]} unit={UNIT} what="the latest half-hour held, the window’s range and means, and the grades held" />,
          Body: IntensityKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Forecast against the estimate, and the days' : 'Forecast against the estimate, by day'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[ACTUAL, FORECAST, INDEX]}
              unit={UNIT}
              what={ctx.mode === 'chart' ? 'estimate less forecast per half-hour, then each UK day’s means, difference and grades' : 'each UK day’s means, difference and grades'}
            />
          ),
          Body: DaysPanel,
        },
        side: {
          title: 'About this data',
          src: (ctx) => <SourceLine ctx={ctx} what="what it holds, and the rest of the family" window={false} />,
          Body: FamilySide,
        },
      },
    },
  ],
})

export default view
