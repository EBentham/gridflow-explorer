/**
 * Gridflow's GB day-ahead benchmark (`gold_gb_day_ahead_benchmark`): the
 * price the power stack model's modelled price is set against, taken from
 * Elexon's market index price (provider APXMIDP) one half-hour at a time.
 * The page says plainly that it is derived from that index and is not an
 * auction price, and links the market index price page it comes from.
 * Main: the price line, extremes labelled and runs below zero banded, over
 * the volume traded on the same clock. Key: the latest half-hour and the
 * window's range, extremes and means (`BenchmarkKey`). Working: the price's
 * shape through the day by UK clock time, then the days (`ProfilePanel`).
 * Side: About, with where the benchmark comes from (`AboutBenchmark`).
 */
import { SourceLine } from '../../_template/panels'
import { defineView } from '../../define'
import { AboutBenchmark } from './AboutBenchmark'
import { BenchmarkKey } from './BenchmarkKey'
import { PRICE, VOLUME } from './figures'
import { ProfilePanel } from './ProfilePanel'

const view = defineView({
  title: 'GB day-ahead benchmark from the market index price',
  sub: 'The half-hourly price the power stack model is checked against. It is derived from Elexon’s market index price, not traded in a day-ahead auction.',
  caveats: [
    'Derived, not traded: gridflow takes each half-hour’s price and volume from Elexon’s market index price, as reported by one provider, APXMIDP. No day-ahead auction sets it, and it reflects trading in the short-term market.',
    'It keeps APXMIDP only, so it has no provider filter of its own. The market index price page reads the same half-hours.',
    'Where the index was never published for a half-hour, or isn’t held locally, the half-hour shows as a gap, never as a zero.',
    'The index carries no time of publication. Where gridflow has read a half-hour more than once, the benchmark keeps the copy read last.',
  ],
  datasets: [
    {
      id: 'gold_gb_day_ahead_benchmark',
      body: 'series',
      label: 'Benchmark',
      title: 'Benchmark price per half-hour, with the volume behind it',
      values: [
        { column: PRICE, label: 'Benchmark price', color: 'var(--chart-price)' },
        { column: VOLUME, label: 'Volume traded', color: 'var(--chart-fan-soft)' },
      ],
      chart: { mark: 'line', values: [PRICE], lower: { values: [VOLUME], mark: 'bars', height: 140 }, belowZero: true, axisWidth: 52 },
      panels: {
        key: {
          title: 'Key',
          src: (ctx) => <SourceLine ctx={ctx} columns={[PRICE, VOLUME]} unit="£/MWh and MWh" what="the latest half-hour held, and the window's range, extremes and means" />,
          Body: BenchmarkKey,
        },
        working: {
          title: (ctx) => (ctx.mode === 'chart' ? 'Price by time of day, and the days' : 'The days'),
          src: (ctx) => (
            <SourceLine
              ctx={ctx}
              columns={[PRICE, VOLUME]}
              unit="£/MWh and MWh"
              what={ctx.mode === 'chart' ? 'mean, lowest and highest price at each UK clock time, then price and volume per UK day' : 'price and volume per UK day'}
            />
          ),
          Body: ProfilePanel,
        },
        side: {
          title: 'About this data',
          Body: AboutBenchmark,
        },
      },
    },
  ],
})

export default view
