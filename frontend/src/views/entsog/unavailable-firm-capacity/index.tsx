/**
 * ENTSO-G's unavailable firm capacity (`cmp_unavailable_firm_capacity`):
 * each network point's statement on whether firm capacity is offered in the
 * regular allocation process, as a table of events (v0.4 P4-0 reference
 * batch). Research found the rows dated per point and day, so the page
 * reads them as events rather than a register.
 */
import { defineView } from '../../define'

const view = defineView({
  title: 'Unavailable firm capacity',
  sub: 'What each gas network point’s operator states about firm capacity it can’t offer in the regular allocation process.',
  caveats: [
    'ENTSO-G publishes no capacity figure here: each row is a statement, and most say firm products are offered in the regular process as usual.',
    'The same statements are stored again each day, so one point’s statement repeats down the table.',
    'Rows are dated midnight Central European time, 23:00 the evening before on the UK clock, so a gas day reads here as the day before it.',
  ],
  datasets: [
    {
      id: 'cmp_unavailable_firm_capacity',
      body: 'events',
      label: 'Statements',
      title: 'Statements per point',
      timeLabel: 'Dated',
      columns: [
        { field: 'point_key', label: 'Point', format: 'id' },
        { field: 'operator_key', label: 'Operator', format: 'id' },
        { field: 'allocation_process', label: 'Allocation process' },
        { field: 'general_remarks', label: 'Remarks' },
      ],
      filters: ['operator_key'],
    },
  ],
})

export default view
