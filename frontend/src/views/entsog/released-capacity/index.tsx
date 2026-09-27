/**
 * ENTSO-G's released capacity (v0.4 P4-0 reference batch): four daily
 * series of statements, one per interconnection point, shown as tables.
 * They hold text, not quantities. Read one direction at a time they form one
 * series per point; read whole, the backend can't tell the series apart
 * (`ambiguous_series`), so the config supplies the split and the filter.
 */
import type { QuerySpec, SeriesView } from '../../define'
import { defineView } from '../../define'
import { DirectionControl } from './DirectionControl'

const byDirection = (params: URLSearchParams): QuerySpec => ({ group: 'point_key', filters: { direction_key: params.get('direction') === 'exit' ? 'exit' : 'entry' } })

/** One released-capacity dataset: its statements per point, entry or exit. */
function released(id: string, label: string, title: string, caveats: string[] = []): SeriesView {
  return {
    id,
    body: 'series',
    label,
    title,
    values: [{ column: 'default_sentence', label: 'Statement' }],
    query: byDirection,
    controls: DirectionControl,
    chart: false,
    caveats,
  }
}

const view = defineView({
  title: 'Released capacity',
  sub: 'What each gas network point’s operator states about capacity released through congestion management, day by day.',
  caveats: [
    'ENTSO-G publishes no quantity in these rows: each is the operator’s standard statement for the point, stored again each day.',
    'Each gas day is dated midnight Central European time, 23:00 the evening before on the UK clock, so a gas day reads here as the day before it.',
  ],
  datasets: [
    released('available_through_oversubscription', 'Oversubscription', 'Capacity released through oversubscription', [
      'Its exit statements differ by operator as well as by point, and this page can split by one of them only, so Exit shows nothing for it yet.',
    ]),
    released('available_through_surrender', 'Surrender', 'Capacity released through surrender'),
    released('available_through_uioli_long_term', 'Use it or lose it, long term', 'Capacity released through long-term use it or lose it'),
    released('available_through_uioli_short_term', 'Use it or lose it, short term', 'Capacity released through short-term use it or lose it'),
  ],
})

export default view
