/**
 * ENTSO-G's congestion management procedures (v0.4 P4-0 reference batch):
 * requests for firm capacity that went unfulfilled, and auctions that
 * cleared at a premium, as tables of events per network point. Most rows are
 * a standard statement that nothing happened, re-stored each day, and the
 * page says so rather than hiding them.
 */
import { defineView } from '../../define'

const view = defineView({
  title: 'Congestion management',
  sub: 'Requests for firm gas capacity that went unfulfilled, and capacity auctions that cleared at a premium, per network point.',
  caveats: [
    'Most rows are the operator’s standard statement that there is nothing to report at the point, stored again each day, so one point’s statement repeats down the table.',
    'Rows are dated midnight Central European time, 23:00 the evening before on the UK clock, so a gas day reads here as the day before it.',
  ],
  datasets: [
    {
      id: 'cmp_unsuccessful_requests',
      body: 'events',
      label: 'Unsuccessful requests',
      title: 'Unsuccessful capacity requests',
      caveats: [
        'A known fault in gridflow’s import leaves these rows’ own date blank (a fix is written but not yet in use), so each is dated by the start of the capacity it asks for.',
        'The requested volume’s unit isn’t confirmed, and direction is written both “entry” and “Entry”.',
      ],
      timeLabel: 'Capacity from',
      columns: [
        { field: 'point_key', label: 'Point', format: 'id' },
        { field: 'operator_key', label: 'Operator', format: 'id' },
        { field: 'direction_key', label: 'Direction' },
        { field: 'requested_volume', label: 'Requested volume', format: 'number' },
        { field: 'general_remarks', label: 'Remarks' },
      ],
      filters: ['operator_key', 'direction_key'],
    },
    {
      id: 'cmp_auction_premiums',
      body: 'events',
      label: 'Auction premiums',
      title: 'Auctions cleared at a premium',
      caveats: ['The auction premium is blank on every row held: the rows so far are statements, not auction results.'],
      timeLabel: 'Dated',
      columns: [
        { field: 'point_key', label: 'Point', format: 'id' },
        { field: 'operator_key', label: 'Operator', format: 'id' },
        { field: 'booking_platform_key', label: 'Booking platform', format: 'id' },
        { field: 'auction_premium', label: 'Auction premium', format: 'number' },
        { field: 'general_remarks', label: 'Remarks' },
      ],
      filters: ['operator_key', 'booking_platform_key'],
    },
  ],
})

export default view
