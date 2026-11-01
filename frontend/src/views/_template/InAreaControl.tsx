/**
 * Which in area a cross-border page's borders are read for (`borders.ts`):
 * GB's by default, or another in area the dataset holds pairs for, written
 * as `?in=`. A dataset held for one in area only gets no control.
 */
import type { ComponentType } from 'react'
import { Segmented } from '../../design/frame'
import type { PageContext } from '../define'
import { IN_PARAM, type InArea } from './borders'

/** The control for a dataset view's `controls`, offering the in areas `areasOf` gives for the open dataset. */
export function inAreaControl(areasOf: (ctx: PageContext) => InArea[]): ComponentType<{ ctx: PageContext }> {
  return function InAreaControl({ ctx }) {
    const areas = areasOf(ctx)
    if (areas.length < 2) return null
    const value = areas.find((a) => a.param === ctx.param(IN_PARAM))?.param ?? 'gb'
    return (
      <div className="gf-range">
        <span className="gf-toolbar-note">In area</span>
        <Segmented label="In area" options={areas.map((a) => ({ value: a.param, label: a.label }))} value={value} onChange={(v) => ctx.setParam(IN_PARAM, v === 'gb' ? null : v)} />
      </div>
    )
  }
}
