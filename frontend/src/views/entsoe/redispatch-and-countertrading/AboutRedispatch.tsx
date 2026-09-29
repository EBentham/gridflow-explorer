/**
 * The side panel: the template's About, then what redispatching is, what the
 * family's datasets that aren't held would show (the toolbar names them; this
 * says what each is, in words), and where GB stands.
 */
import { About } from '../../_template/panels'
import { notHeldText } from '../../_template/text'
import { listText } from '../../../design/format'
import type { PageContext } from '../../define'

/** What each of the family's other datasets holds, in words. */
const WORDS: Record<string, string> = {
  redispatching_cross_border: 'redispatching across a border',
  countertrading: 'countertrading',
  congestion_management_costs: 'the cost of congestion management',
}

const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export function AboutRedispatch({ ctx }: { ctx: PageContext }) {
  const others = ctx.family.datasets.filter((d) => !d.held)
  const causes = [...new Set(others.map((d) => notHeldText(d.not_held_cause, { many: others.length > 1 })))]
  const names = others.map((d) => WORDS[d.id] ?? d.id)
  return (
    <>
      <About ctx={ctx} />
      <p className="gf-hint">Redispatching is a grid operator changing the planned output of generation, or of demand, to relieve a congested part of its grid. The rows held here are redispatching inside a zone.</p>
      {others.length > 0 && (
        <p className="gf-hint">
          {upperFirst(listText(names))} {others.length > 1 ? 'belong' : 'belongs'} to the same family but {others.length > 1 ? 'aren’t' : 'isn’t'} held:{' '}
          {causes.length === 1 ? causes[0] : 'each for its own reason, named in the toolbar'}.
        </p>
      )}
      <p className="gf-hint">No GB rows are held. The Netherlands and Belgium are GB’s neighbours across the BritNed and Nemo links.</p>
    </>
  )
}
