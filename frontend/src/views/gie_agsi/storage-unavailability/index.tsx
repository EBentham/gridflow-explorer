/**
 * GIE AGSI+'s storage unavailability (`unavailability`): planned and
 * unplanned outages at European gas storage sites, as a table of events
 * (v0.4 P4-0 reference batch). Country and site arrive as JSON text, read
 * here by the name inside; the figures arrive as text, shown as published.
 */
import { jsonName } from '../../_template/codes'
import { defineView } from '../../define'

const view = defineView({
  title: 'Storage unavailability',
  sub: 'Outages at European gas storage sites, planned and unplanned, with the injection, withdrawal and volume they take out.',
  caveats: [
    'A known fault in gridflow’s import stores every outage again each day it is fetched (a fix is written but not yet in use), so one outage repeats down the table.',
    'The outages’ start and end times aren’t in this read yet; each row is dated by its event time.',
    'The figures’ units aren’t confirmed, so they show as published.',
  ],
  datasets: [
    {
      id: 'unavailability',
      body: 'events',
      label: 'Outages',
      title: 'Storage outages',
      timeLabel: 'Event time',
      columns: [
        { field: 'facility', label: 'Site', text: jsonName },
        { field: 'country', label: 'Country', text: jsonName },
        { field: 'type', label: 'Type' },
        { field: 'end_flag', label: 'End' },
        { field: 'withdrawal', label: 'Withdrawal', format: 'number' },
        { field: 'injection', label: 'Injection', format: 'number' },
        { field: 'volume', label: 'Volume', format: 'number' },
      ],
      filters: ['country', 'type', 'end_flag'],
    },
  ],
})

export default view
