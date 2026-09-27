/**
 * Elexon's net balancing services adjustment (`netbsad`): a half-hourly
 * series shown as a table (v0.4 P4-0 reference batch). The source doesn't
 * state its eight columns' units, so nothing is charted against an axis it
 * can't name: the key lists each column's latest value and the days table
 * reads one column at a time.
 */
import { defineView } from '../../define'

const view = defineView({
  title: 'Net balancing services adjustment',
  sub: 'The adjustments the system operator’s balancing services make to the buy and sell prices, per half-hour, as a table.',
  caveats: [
    'Every value Elexon had sent by 27 Sep 2026 was zero, in all eight columns (checked against its raw answers that day). The table shows the zeros as published; they aren’t gaps.',
    'Elexon doesn’t state these columns’ units, so every value shows as published, unit unconfirmed.',
    'These are the net adjustments. The disaggregated balancing services adjustments list the actions behind them one by one.',
  ],
  datasets: [
    {
      id: 'netbsad',
      body: 'series',
      label: 'Adjustments',
      title: 'Adjustments per half-hour',
      values: [
        { column: 'net_buy_price_cost_adjustment_energy', label: 'Buy cost adjustment (energy)' },
        { column: 'net_buy_price_volume_adjustment_energy', label: 'Buy volume adjustment (energy)' },
        { column: 'net_buy_price_volume_adjustment_system', label: 'Buy volume adjustment (system)' },
        { column: 'buy_price_price_adjustment', label: 'Buy price adjustment' },
        { column: 'net_sell_price_cost_adjustment_energy', label: 'Sell cost adjustment (energy)' },
        { column: 'net_sell_price_volume_adjustment_energy', label: 'Sell volume adjustment (energy)' },
        { column: 'net_sell_price_volume_adjustment_system', label: 'Sell volume adjustment (system)' },
        { column: 'sell_price_price_adjustment', label: 'Sell price adjustment' },
      ],
      chart: false,
    },
  ],
})

export default view
