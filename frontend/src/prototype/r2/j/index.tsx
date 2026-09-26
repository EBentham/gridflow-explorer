import { DEFAULT_LANGUAGE } from '../../../design/charts'
import type { ShellProps, VariantDef } from '../../context'
import { ProtoLink } from '../../controls'
import './tokens.css'

/** Slot j starter shell. The owning agent replaces this file's contents. */
function Shell({ nav, children }: ShellProps) {
  return (
    <div style={{ padding: 32 }}>
      <nav style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        {nav.map((n) => (
          <ProtoLink key={n.to} to={n.to}>
            {n.label}
          </ProtoLink>
        ))}
      </nav>
      {children}
    </div>
  )
}

export const variant: VariantDef = {
  key: 'j',
  name: 'Slot j',
  line: 'Not built yet.',
  language: DEFAULT_LANGUAGE,
  Shell,
  keyPlacement: 'aside',
  round: 2,
}
