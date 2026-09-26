import type { ReactElement } from 'react'
import { ResponsiveContainer } from 'recharts'

interface ChartCardProps {
  title: string
  children: ReactElement
}

/**
 * Wraps a Recharts chart with a title and a fixed-height container.
 *
 * `ResponsiveContainer` measures its parent's height — a parent with `auto`
 * height renders the chart at zero height while `tsc`/`npm run build` and
 * every API test still pass (P1-PLAN.md T5, the one failure no gate catches).
 * The explicit `height: 420` below is that fix.
 */
export function ChartCard({ title, children }: ChartCardProps) {
  return (
    <section className="chart-card">
      <h2>{title}</h2>
      <div style={{ height: 420 }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </section>
  )
}
