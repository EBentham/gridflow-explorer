/**
 * The side panel: the template's About, then every area code the rows drawn
 * name, each with gridflow's name for it, and how the page reads ENTSO-E's
 * in and out areas.
 */
import { About } from '../../_template/panels'
import type { PageContext } from '../../define'
import { areaName, isNamed } from './areas'
import { besideOf, besideState, bordersOf } from './model'

/** The area codes in the rows drawn: the filters' and every split's values, a measure read beside counting only when drawn. */
function codesOf(ctx: PageContext): string[] {
  const out = new Set<string>()
  const add = (v: unknown) => {
    if (typeof v === 'string' && v) out.add(v)
  }
  for (const v of Object.values(ctx.response?.filters ?? {})) add(v)
  for (const d of ctx.series?.all ?? []) if (d.count > 0) add(d.group)
  // Named areas first, in name order; unnamed codes after.
  return [...out].sort((a, b) => Number(!isNamed(a)) - Number(!isNamed(b)) || areaName(a).localeCompare(areaName(b)))
}

export function AboutFamily({ ctx }: { ctx: PageContext }) {
  const codes = codesOf(ctx)
  const first = bordersOf(ctx)[0]
  const example = first ? `, ${first.name} for in area ${areaName(first.inArea)} and out area ${areaName(first.out)},` : ''
  const drawn = besideOf(ctx).filter((m) => besideState(ctx, m) === 'drawn')
  return (
    <>
      <About ctx={ctx} />
      {codes.length > 0 && (
        <dl className="gf-facts">
          <div>
            <dt>Area codes in these rows</dt>
            <dd>
              {/* One code to a line: a code broken across two lines reads as two. */}
              {codes.map((c) => (
                <div key={c}>
                  <span>
                    <code>{c}</code> {isNamed(c) ? areaName(c) : 'an area gridflow doesn’t name'}
                  </span>
                </div>
              ))}
            </dd>
          </div>
        </dl>
      )}
      <p className="gf-hint">
        ENTSO-E names each border by an in area and an out area. The page names a border in that order{example} and doesn’t say which way the capacity runs.
        {drawn.length ? ' A measure drawn beside it is read under the same in and out area codes.' : ''}
      </p>
    </>
  )
}
