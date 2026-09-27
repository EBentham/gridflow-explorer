/**
 * The side panel: what the dataset is and how this page reads it. It takes
 * the place of the template's About, which lists every column one by one; NESO
 * publishes 33, so they are named here in groups: the eleven fuels and the
 * carbon intensity drawn, then the total, NESO's own groupings and its
 * per-cent columns, which the page leaves out, and why.
 */
import { Fragment } from 'react'
import type { PageContext } from '../../define'
import { cadenceOf, depthText, meansText, notHeldText, sourceName } from '../../_template/text'
import { CI, FUELS } from './fuels'
import { clockOf } from './periods'

const GROUPINGS = ['low_carbon', 'zero_carbon', 'renewable', 'fossil']

function Ids({ ids }: { ids: string[] }) {
  return ids.map((id, i) => (
    <Fragment key={id}>
      {i > 0 && (i === ids.length - 1 ? ' and ' : ', ')}
      <code>{id}</code>
    </Fragment>
  ))
}

export function MixAbout({ ctx }: { ctx: PageContext }) {
  const d = ctx.dataset
  const held = new Set(d.values.map((v) => v.column))
  const pct = d.values.filter((v) => v.column.endsWith('_pct')).map((v) => v.column)
  const groupings = GROUPINGS.filter((c) => held.has(c))
  const bucket = ctx.response?.truncation?.bucket_ms ?? null
  const clock = clockOf(ctx.window)
  return (
    <dl className="gf-facts">
      <div>
        <dt>Dataset</dt>
        <dd>
          <code>{d.id}</code>, from {sourceName(ctx.source)} ({ctx.source.host})
        </dd>
      </div>
      <div>
        <dt>Drawn</dt>
        <dd>
          The eleven fuels, <Ids ids={FUELS.map((f) => f.column)} />: MW, shown as GW and stacked. Then <code>{CI}</code>, gCO₂/kWh, below them.
        </dd>
      </div>
      <div>
        <dt>Left out</dt>
        <dd>
          <code>generation</code>, NESO’s total, which the fuels add up to. NESO’s groupings, <Ids ids={groupings} />, as the page draws the fuels themselves; in the rows held,{' '}
          <code>renewable</code> counts storage. And the {pct.length} per-cent columns, such as <code>{pct[0] ?? 'gas_pct'}</code>: the zero-carbon share doesn’t match the zero-carbon MW over the total, so shares here are
          worked out from the MW.
        </dd>
      </div>
      <div>
        <dt>Cadence</dt>
        <dd>{cadenceOf(null, d)}</dd>
      </div>
      <div>
        <dt>Read as</dt>
        <dd>
          {bucket
            ? `${meansText(bucket)[0].toUpperCase()}${meansText(bucket).slice(1)}: a window this long comes back as means, not half-hours.`
            : clock === 'native'
              ? 'Every half-hour, as published.'
              : 'Every half-hour, as published; the chart draws their means.'}
        </dd>
      </div>
      <div>
        <dt>Held locally</dt>
        <dd>{d.held ? (depthText(d.coverage) ?? 'rows with no day range') : `Nothing: ${notHeldText(d.not_held_cause, { layer: ctx.source.layer })}`}</dd>
      </div>
      <div>
        <dt>Fetched</dt>
        <dd>
          {d.schedule ? `${d.schedule[0].toUpperCase()}${d.schedule.slice(1)}, by gridflow.` : 'By gridflow.'} Each download carries NESO’s whole history, which NESO revises; gridflow keeps every download, and this
          page reads the latest.
        </dd>
      </div>
    </dl>
  )
}
