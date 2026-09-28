/**
 * A panel's note for a related read that failed: what the panel is drawn
 * without, then the read's error in plain words. Nothing when the read
 * answered, as a value missing then is a gap in what is held, which the
 * panels say in their own words.
 */
import type { ReactNode } from 'react'
import { ErrorWords } from '../../_template/panels'
import type { PageContext } from '../../define'
import { readFailed } from './figures'

export function UnreadNote({ ctx, overlay, className, children }: { ctx: PageContext; overlay: string; className?: string; children: ReactNode }) {
  if (!readFailed(ctx, overlay)) return null
  return (
    <p className={className}>
      {children} <ErrorWords error={ctx.related[overlay]?.error ?? null} />
    </p>
  )
}
