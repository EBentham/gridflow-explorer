/**
 * The page's own toolbar controls, after Chart | Table.
 *
 * - The clearing view's price axis (`?scale=full`): by default it spans the
 *   market index and the prices the stack set, so they stay readable, and
 *   the half-hours at the model's price floor run off its foot; Whole range
 *   spans every value held.
 * - A link to the whole published window (the days the run covers), on the
 *   clearing and residual views. The template's own range is kept as it is:
 *   the link sets its custom window, as a reader could.
 * - The supply curve's half-hour (`?at=`, an epoch-ms time the window
 *   holds), with steps to the one before and after; by default the latest.
 */
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Segmented } from '../../../design/frame'
import { rangeText } from '../../../design/time'
import { periodName } from '../../_template/seriesModel'
import type { PageContext } from '../../define'
import { chosenTime, curveTimes, ownRows, publishedSearch } from './figures'

const SCALE_OPTIONS = [
  { value: 'stack', label: 'Stack prices' },
  { value: 'full', label: 'Whole range' },
]

function PublishedWindow({ ctx }: { ctx: PageContext }) {
  const [params] = useSearchParams()
  const first = ctx.dataset.coverage?.first_day
  const last = ctx.dataset.coverage?.last_day
  if (!first || !last || !ctx.window) return null
  const text = rangeText(first, last)
  if (ctx.window.start === first && ctx.window.end === last) return <span className="gf-toolbar-note">The whole published window, {text}</span>
  return (
    <Link className="gf-view-link gf-stack-link" to={{ search: publishedSearch(params, first, last) }}>
      Show the whole published window, {text}
    </Link>
  )
}

export function ClearingControls({ ctx }: { ctx: PageContext }) {
  const full = ctx.param('scale') === 'full'
  return (
    <>
      {/* No axis to set when the window holds nothing to draw. */}
      {ctx.mode === 'chart' && ctx.state !== 'empty' && (
        <span className="gf-stack-control">
          <span className="gf-toolbar-note">Price axis</span>
          <Segmented label="Price axis" options={SCALE_OPTIONS} value={full ? 'full' : 'stack'} onChange={(v) => ctx.setParam('scale', v === 'full' ? 'full' : null)} />
        </span>
      )}
      <PublishedWindow ctx={ctx} />
    </>
  )
}

export function ResidualControls({ ctx }: { ctx: PageContext }) {
  return <PublishedWindow ctx={ctx} />
}

export function PeriodControl({ ctx }: { ctx: PageContext }) {
  const rows = ownRows(ctx)
  const times = useMemo(() => curveTimes(rows), [rows])
  const model = ctx.series
  if (ctx.state === 'loading' || ctx.state === 'refreshing') return <span className="gf-toolbar-note">Reading the half-hours…</span>
  // Means over buckets aren't a merit order: the main panel says so, and there is no half-hour to choose.
  if (!model || model.bucketed || !times.length) return null
  const at = chosenTime(ctx.param('at'), times) ?? times[times.length - 1]
  const i = times.indexOf(at)
  const latest = times[times.length - 1]
  // The latest held is the default, so choosing it clears the parameter.
  const go = (t: number) => ctx.setParam('at', t === latest ? null : String(t))
  return (
    <span className="gf-stack-control">
      <label className="gf-stack-period">
        <span className="gf-toolbar-note">Half-hour</span>
        <select className="gf-select gf-stack-select" value={at} onChange={(e) => go(Number(e.target.value))}>
          {times.map((t) => (
            <option key={t} value={t}>
              {periodName(t, model.stepMs, model.settlement)}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="gf-stack-step" disabled={i <= 0} onClick={() => go(times[i - 1])}>
        Earlier
      </button>
      <button type="button" className="gf-stack-step" disabled={i >= times.length - 1} onClick={() => go(times[i + 1])}>
        Later
      </button>
    </span>
  )
}
