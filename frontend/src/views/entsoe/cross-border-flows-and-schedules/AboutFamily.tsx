/**
 * The side panel: the template's About, then every area code the rows name,
 * each with gridflow's name for it (or the placeholder, which names none),
 * and how the page reads ENTSO-E's in and out areas.
 */
import { About } from '../../_template/panels'
import type { PageContext } from '../../define'
import { areaName, isNamed, REGION } from './areas'
import { NET_POSITIONS } from './model'

/** The area codes in the rows read: the filters' and every split's values. */
function codesOf(ctx: PageContext): string[] {
  const out = new Set<string>()
  const add = (v: unknown) => {
    if (typeof v === 'string' && v) out.add(v)
  }
  for (const v of Object.values(ctx.response?.filters ?? {})) add(v)
  for (const d of ctx.series?.all ?? []) if (d.count > 0) add(d.group)
  for (const rel of Object.values(ctx.related)) {
    for (const v of Object.values(rel.response?.filters ?? {})) add(v)
    for (const d of rel.series?.all ?? []) if (d.count > 0) add(d.group)
  }
  // Named areas first, in name order; the placeholder and unnamed codes after.
  return [...out].sort((a, b) => Number(!isNamed(a)) - Number(!isNamed(b)) || areaName(a).localeCompare(areaName(b)))
}

export function AboutFamily({ ctx }: { ctx: PageContext }) {
  const codes = codesOf(ctx)
  const net = ctx.view.id === NET_POSITIONS
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
                    <code>{c}</code> {isNamed(c) ? areaName(c) : c === REGION ? 'a placeholder that names no area' : 'an area gridflow doesn’t name'}
                  </span>
                </div>
              ))}
            </dd>
          </div>
        </dl>
      )}
      {net ? (
        <p className="gf-hint">
          Each row names the zone as the in area or as the out area, with <code>{REGION}</code> on the other side. The page keeps the two sides apart until the sign is confirmed.
        </p>
      ) : (
        <p className="gf-hint">
          ENTSO-E names each border by an in area and an out area. The page names a border in that order, GB–France for in area Great Britain and out area France, and doesn’t say which way the power moves.
        </p>
      )}
    </>
  )
}
