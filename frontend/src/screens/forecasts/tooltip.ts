import type { CSSProperties } from 'react'

/** Recharts `<Tooltip />` style props for the forecast screen, on the tooltip tokens. */
export const tooltipContentStyle: CSSProperties = {
  background: 'var(--tip-bg)',
  border: '1px solid var(--tip-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--tip-ink)',
  padding: '4px 8px',
  fontSize: 12,
  lineHeight: 1.35,
}

export const tooltipLabelStyle: CSSProperties = {
  color: 'var(--tip-ink)',
  fontSize: 12,
  marginBottom: 2,
}

export const tooltipItemStyle: CSSProperties = {
  padding: 0,
}
