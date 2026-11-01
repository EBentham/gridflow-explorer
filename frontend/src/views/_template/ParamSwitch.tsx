/**
 * A page's own two-way toolbar switch over one of its URL parameters: the
 * first option is the default and leaves the parameter out of the URL, the
 * second writes it (`?country=all`), and the view's `query` reads it.
 */
import type { ComponentType } from 'react'
import { Segmented } from '../../design/frame'
import type { PageContext } from '../define'

/** The control for a dataset view's `controls`: `paramSwitch('country', 'Country', ['uk', 'UK'], ['all', 'All countries'])`. */
export function paramSwitch(param: string, label: string, [byDefault, defaultLabel]: [string, string], [other, otherLabel]: [string, string]): ComponentType<{ ctx: PageContext }> {
  const options = [
    { value: byDefault, label: defaultLabel },
    { value: other, label: otherLabel },
  ]
  return function ParamSwitch({ ctx }) {
    const on = ctx.param(param) === other
    return <Segmented label={label} options={options} value={on ? other : byDefault} onChange={(v) => ctx.setParam(param, v === other ? other : null)} />
  }
}
