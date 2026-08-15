import type { CSSProperties } from 'react'

/** Shared Recharts `<Tooltip />` style props — compact, theme-correct hover box. */
export const tooltipContentStyle: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 12,
  lineHeight: 1.35,
}

export const tooltipLabelStyle: CSSProperties = {
  color: 'var(--text-h)',
  fontSize: 12,
  marginBottom: 2,
}

export const tooltipItemStyle: CSSProperties = {
  padding: 0,
}
